import { bufferFromString } from "../lib/utils.js";

const WEBTELLA_DOWNLOAD_DIR = 'webtella-downloads';

export default class MobileFileService {
    constructor({ emitter, logger }) {
        this.emitter = emitter;
        this.logger = logger;
        this.files = [];
        this.outgoingFiles = {};
        this.headerByteLength = 72;

        this.init();
    }

    init() {
        this.emitter.on('mobile.files.add', this.addFiles);
        this.emitter.on('directory.list', this.getFiles);
        this.emitter.on('file.get', this.getFileDetails);
        this.emitter.on('file.outgoing.prepare', this.prepareOutgoingFile);
        this.emitter.on('file.chunk.request', this.sendNextFileChunk);
        
    }

    addFiles = files => {
        this.emitter.emit('directory.clear');
        this.files.push(...files);
        const displayFiles = this.files.map(({ name, size }) => ( { name, size, kind: 'file', path: '/' }));
        this.emitter.emit('directory.content', { hierarchy: [''], content: displayFiles });
    }

    getFiles = () => {
        const content = this.files.map(({ name, size }) => ({ name, kind: 'file', path: ['files', name ], size }));
        return {
            name: 'files',
            kind: 'directory',
            hierarchy: ['files'],
            content
        }
    }

    getFileDetails = path => {
        const { name, size } = this.files.filter(f => f.name === path[1])[0];
        return { name, size };
    }

    prepareOutgoingFile = async({ path, requestId, chunkSize, headerByteLength }) => {
        const file = this.files.filter(f => f.name === path[1])[0];
        if (!file) {
            return this.logger.debug('cannot get file at path for request', { path, requestId });
        }

        this.outgoingFiles[requestId] = {
            file,
            chunkSize,
            header: bufferFromString(requestId, headerByteLength)
        }
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
}
