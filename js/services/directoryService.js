import { bufferFromString, stringFromBuffer } from "../lib/utils.js";

const WEBTELLA_DOWNLOAD_DIR = 'webtella-downloads';

export default class DirectoryService {
    constructor({ emitter, logger }) {
        this.emitter = emitter;
        this.logger = logger;
        this.directories = [];
        this.incomingFiles = {};
        this.outgoingFiles = {};
        this.downloadDirectory = null;
        this.headerByteLength = 72;
        window.appDirectories = this.directories;

        if (window.location.search.indexOf('debug') > -1) {
            window.outgoingFiles = this.outgoingFiles;
            window.incomingFiles = this.incomingFiles;
        }


        this.init();
    }

    init() {
        this.emitter.on('directory.choose', async() => await this.chooseDirectory());
        this.emitter.on('directory.change', this.changeDirectory);
        this.emitter.on('directory.list', this.getDirectories);
        this.emitter.on('directory.get', this.getDirectory);
        this.emitter.on('file.get', this.getFileDetails);
        this.emitter.on('file.create', this.createFile);
        this.emitter.on('file.outgoing.prepare', this.prepareOutgoingFile);
        this.emitter.on('file.incoming.prepare', this.prepareIncomingFile);
        this.emitter.on('file.chunk.request', this.sendNextFileChunk);
        this.emitter.on('file.incoming.chunk', this.handleIncomingChunk);
        this.emitter.on('file.incoming.complete', this.handleIncomingCompleted);
    }

    async chooseDirectory() {
        const newDirectory = await window.showDirectoryPicker();
        if (newDirectory) {
            this.directories.push(newDirectory);
        }

        if (this.directories.length === 1 && newDirectory == this.directories[0]) {
            this.downloadDirectory = await newDirectory.getDirectoryHandle(WEBTELLA_DOWNLOAD_DIR, { create: true });
        }

        const { name, kind } = newDirectory;
        const hierarchy = [ name ];
        const content = await this.getDirectoryContent(newDirectory, hierarchy);
        this.emitter.emit('directory.content', { name, hierarchy, kind, content });
    }

    changeDirectory = async (originalPath) => {
        const path = [ ...originalPath ];
        const rootDirectory = this.directories.find(d => d.name === path.shift());
        if (!rootDirectory) {
            return;
        }

        let targetDirectory = rootDirectory;

        while (targetDirectory && path.length) {
            targetDirectory = await targetDirectory.getDirectoryHandle(path.shift());
        }

        if (!targetDirectory) {
            return;
        }

        const { name, kind } = targetDirectory;
        const content = await this.getDirectoryContent(targetDirectory, originalPath);
        this.emitter.emit('directory.content', { name, hierarchy: originalPath, kind, content });
    }

    getDirectories = async () => {
        const directories = [];
        for (let i = 0, len = this.directories.length; i < len; i++) {
            directories.push(await this.packDirectoryForPeer(this.directories[i])());
        }

        return directories;
    }

    getDirectory = async (path) => {
        const hierarchy = [ ...path ];
        const baseDirName = path.shift();
        const baseDir = this.directories.find(dir => dir.name === baseDirName);

        if (!baseDir) {
            return;
        }

        const targetDir = await this.traverseDirectories(baseDir, path);

        if (!targetDir) {
            return;
        }

        const directory = await this.packDirectoryForPeer(targetDir, hierarchy)();

        return directory;
    }

    traverseDirectories = async (baseDir, pathArr = []) => {
        if (!pathArr.length) {
            return baseDir;
        }

        const nextDirName = pathArr.shift();
        let nextDirectory;

        for await (let [name, handle] of baseDir) {
            if (name === nextDirName) {
                nextDirectory = handle;
                break;
            }
        }

        return await this.traverseDirectories(nextDirectory, pathArr);
    }

    packDirectoryForPeer = (dir, hierarchy = []) => async() => {
        if (!hierarchy.length) {
            hierarchy.push(dir.name);
        }

        const content = await this.getDirectoryContent(dir, hierarchy);
        return {
            name: dir.name,
            kind: dir.kind,
            hierarchy,
            content
        }
    };

    async getDirectoryContent(directoryOrString, hierarchy = []) {
        const directory = directoryOrString instanceof FileSystemDirectoryHandle
            ? directoryOrString
            : this.getDirectoryFromStringName(directoryOrString);

        const content = [];
        for await (let [name, handle] of directory) {
            const { kind } = handle;
            const handleMetadata = {
                name, kind, path: [ ...hierarchy ].concat([ name ])
            }

            if (kind == 'file') {
                const { size, type }= await handle.getFile();
                handleMetadata.size = size;
                handleMetadata.type = type;
            }

            content.push(handleMetadata)
        }

        const directories = content.filter(c => c.kind === 'directory')
            .sort((a, b) => a.name > b.name ? 1 : (a.name < b.name ? -1 : 0));
        const files = content.filter(c => c.kind === 'file')
            .sort((a, b) => a.name > b.name ? 1 : (a.name < b.name ? -1 : 0));

        return directories.concat(files);
    }

    getDirectoryFromStringName = (str) => this.directories.find(d => d.name === str);

    getFile = async (path) => {
        let targetDirectory = this.directories.find(d => d.name === path.shift());

        if (!targetDirectory) {
            return;
        }

        while (targetDirectory && path.length > 1) {
            targetDirectory = await targetDirectory.getDirectoryHandle(path.shift());
        }

        const fileHandle = await targetDirectory.getFileHandle(path.shift());

        if (fileHandle.kind === 'directory') {
            return;
        }

        return await fileHandle.getFile();
    }

    getFileDetails = async (path) => {
        const { name, size } = await this.getFile(path);
        return { name, size };
    }

    createFile = async (file) => {
        const dirHandle = await this.getDownloadDirectory();
        if (!dirHandle) {
            return console.log('returning');
        }

        const filename = `${(Math.random() + 1).toString(16).substring(2, 8)}-${file.name}`;
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const stream = await fileHandle.createWritable();
        await stream.write(file);
        stream.close();
    }

    getDownloadDirectory = async () => {
        const mainDir = this.directories.find(d => true);
        return mainDir
            ? await mainDir.getDirectoryHandle(WEBTELLA_DOWNLOAD_DIR)
            : null;
    }

    prepareOutgoingFile = async({ path, requestId, chunkSize, headerByteLength }) => {
        const file = await this.getFile(path);
        if (!file) {
            return this.logger.debug('cannot get file at path for request', { path, requestId });
        }

        this.outgoingFiles[requestId] = {
            file,
            chunkSize,
            header: bufferFromString(requestId, headerByteLength)
        }
    }

    prepareIncomingFile = async({ name, size, requestId, chunkSize, headerByteLength }) => {
        
        const dirHandle = await this.getDownloadDirectory();
        const fileHandle = await (dirHandle
            ? dirHandle.getFileHandle(name, { create: true })
            : window.showSaveFilePicker({ suggestedName: name }));

        const stream = await fileHandle.createWritable();
        await stream.write({ type: 'truncate', size });

        this.incomingFiles[requestId] = {
            stream,
            size,
            chunkSize,
            headerByteLength,
            recvBytes: 0
        }
        this.logger.trace('incoming file prepared', this.incomingFiles[requestId]);
    }

    sendNextFileChunk = async({ peerId, requestId, recvBytes }) => {
        if (!this.outgoingFiles[requestId]) {
            return this.logger.debug('no such file available', requestId, JSON.parse(JSON.stringify(this.outgoingFiles)));
        }

        const { file, header, chunkSize } = this.outgoingFiles[requestId];
        const trueChunkSize = Math.min(file.size - recvBytes, chunkSize - this.headerByteLength);

        
        if (trueChunkSize <= 0) {
            this.logger.trace('file upload completed', { peerId, requestId });
            return this.emitter.emit('file.outgoing.complete', { peerId, requestId });
        }

        const nextChunk = await file.slice(recvBytes, recvBytes + trueChunkSize).arrayBuffer();

        let data = new Uint8Array(this.headerByteLength + trueChunkSize);
        data.set(new Uint8Array(header), 0);
        data.set(new Uint8Array(nextChunk), this.headerByteLength);
        this.emitter.emit('file.outgoing.chunk', { requestId, peerId, buffer: data.buffer });
    }

    handleIncomingChunk = async({ data, peerId }) => {
        const header = String.fromCharCode(...(new Uint16Array(data.slice(0, this.headerByteLength))));
        if (!this.incomingFiles[header]) {
            return this.logger.debug('unknown incoming transfer', header);
        }

        const writableData = data.slice(this.headerByteLength);
        const { stream } = this.incomingFiles[header];
        await stream.write(data.slice(this.headerByteLength));
        this.incomingFiles[header].recvBytes += writableData.byteLength;
        this.emitter.emit('file.incoming.chunk.persisted', { peerId, recvBytes: this.incomingFiles[header].recvBytes, header })
    }

    handleIncomingCompleted = async({ requestId }) => {
        if (!this.incomingFiles[requestId]) {
            return this.logger.debug('unknown incoming transfer', header);
        }

        await this.incomingFiles[requestId].stream.close();
    }
}
