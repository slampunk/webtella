import PeerConnection from "./peerConnection.js";
import { getFileSize } from "./utils.js";

export default class Peer extends PeerConnection {
    constructor({ emitter, id, initiate = false, pc_config, logger, name }) {
        super({ emitter, id, initiate, pc_config, logger, name });

        this.incomingFiles = {};
        this.outgoingFiles = {};
        this.alwaysAccept = false;
        this.fileChunkSize = 65536;
        this.headerByteLength = 72;
        this.historicRateWeight = 1;

        this.pauseTransfers = false;
        this.bufferHighWaterMark = 32768;

        this.attachLocalEvents();
        initiate && this.attachChannelEvents();
    }

    /* Listens for a number of peer-scoped local emitter events
     *
     * @params null
     * @returns void
     */
    attachLocalEvents() {
        this.emitter.on(`directory.list.request`, this.forwardDirectories);
        this.emitter.on(`directory.list.response`, this.handlePeerDirectoryList);
        this.emitter.on(`directory.get.request`, this.forwardDirectory);
        this.emitter.on(`directory.get.response`, this.handlePeerDirectoryResponse);
        this.emitter.on(`file.get.request`, this.forwardFileDetails);
        this.emitter.on(`file.get.response`, this.storeIncomingFileDetails);
        this.emitter.on('file.prepare.outgoing', this.storeOutgoingFileDetails);
        this.emitter.on(`file.transfer.complete`, this.finaliseFileTransfer);
        this.emitter.on('datachannel.open', this.attachChannelEvents);
        this.emitter.on('file.transfer.proceed', this.transferFileChunk);
    }

    /* Sets up listeners for events originating over data channel
     *
     * @params null
     * @returns void
     */
    attachChannelEvents = () => {
        this.logger.debug('setting up datachannel events');
        this.channel.onmessage = this.handleChannelMessage;

        this.channel.onopen = e => {
            this.emitter.emit('connection.established', this.id, this.initiate);
            return this.channel.send('ping');
        }

        this.channel.onerror = e => this.logger.error('channel error', e);

        this.channel.onclose = e => this.logger.log('channel closed', e);
    }

    /* Handles incoming messages and distributes them to various functions
     *
     * @params {RTCDataChannelEvent<e>} - message intercepted over data channel
     * @returns null
     */
    handleChannelMessage = (e) => {
        if (e.data instanceof ArrayBuffer) {
            return this.handleBinaryData(e.data);
        }

        let event = e.data;
        let data = {};

        try {
            data = JSON.parse(e.data);
            event = data.event;
            this.logger.debug(data);
            this.emitter.emit(event, data.payload || data);
        } catch (e) {
        }
    }

    /* Produces notifications for binary chunks received
     *
     * @params {ArrayBuffer<data>} - binary data. includes a 20-byte header which denotes
     *                               the token of the file undergoing transfer.
     *
     *                               Parses the header to get the token, then lobs off the
     *                               remaining chunk to the `buildIncomingFile` method.
     */
    handleBinaryData = async(data) => this.emitter.emit('peer.binary.data', { data, id: this.id });//{
        // const header = stringFromBuffer(...new Uint16Array(data.slice(0, this.headerByteLength))).replace(/\0/g, '');
        // const fileMetadata = this.incomingFiles[header];

        // if (!fileMetadata) {
        //     return this.logger.debug('unknown incoming file transfer', header);
        // }

        // if (fileMetadata) {
        //     const chunk = data.slice(this.headerByteLength);
        //     await this.notifyFileChunk(fileMetadata, chunk);
        //     this.updateFileMetadata(fileMetadata, chunk);
        // }
    //}

    /* Notifies of a received binary chunk
     *
     * @param {object<fileMetadata>}
     * @param {ArrayBuffer<chunk>}   - binary chunk to be appended to file.
     */
    notifyFileChunk = async (fileMetadata, data) =>
        await this.emitter.emitAwait(`file.${token}.chunk`,
            fileMetadata, data.slice(this.headerByteLength));

    /* Updates progress of the corresponding file for a given binary chunk
     *
     * @param {object<fileMetadata>}
     * @param {ArrayBuffer<chunk>} - binary chunk to be appended to file.
     */
    updateFileMetadata = (fileObj, requestId, transferredBytes) => {
        const fileMetadata = fileObj[requestId];
        const prevTransferredBytes = fileMetadata.transferredBytes;
        fileMetadata.transferredBytes = transferredBytes;
        const currentTime = (new Date()).getTime();
        fileMetadata.startTime = fileMetadata.startTime || currentTime;
        fileMetadata.lastTime = fileMetadata.lastTime || currentTime;
        const elapsedTime = (currentTime - fileMetadata.startTime) / 1000;
        const deltaTimeFromLastTransfer = (currentTime - fileMetadata.lastTime) / 1000;
        const historicRate = elapsedTime > 0 ? fileMetadata.transferredBytes / elapsedTime : 0;
        const deltaRate = deltaTimeFromLastTransfer > 0 ? (transferredBytes - prevTransferredBytes) / deltaTimeFromLastTransfer : 0;
        const aggregatedRate = this.historicRateWeight * historicRate + (1 - this.historicRateWeight) * deltaRate;
        const rate = elapsedTime > 0 ? getFileSize(aggregatedRate) + '/s' : '0 B/s';
        fileMetadata.lastTime = currentTime;
        const perc = ~~(fileMetadata.transferredBytes / fileMetadata.size * 100);
        const remainingSeconds = ~~(aggregatedRate > 0 ? (fileMetadata.size - transferredBytes) / aggregatedRate : 0);
        this.emitter.emit(`file.transfer.progress`, { requestId, perc, rate, transferredBytes, remainingSeconds });
    }

    finaliseFileTransfer = ({ requestId }) => {
        this.logger.debug('received file finalisation message', requestId);

        this.emitter.emit('file.incoming.complete', { requestId });
    }

    sendMessage = (event, payload) => {
        this.send({ event, payload });
    }

    sendBinaryData = (requestId, data) => {
        this.channel.send(data);
        if (!this.outgoingFiles[requestId]) {
            return;
        }

        const newByteLength = this.outgoingFiles[requestId].transferredBytes + data.byteLength;

        this.updateFileMetadata(this.outgoingFiles, requestId, newByteLength);
    }

    updateOutgoingFileMetadata = (requestId, data) => {
        if (!this.outgoingFiles[requestId]) {
            return this.logger.trace('unknown outgoing file transfer', requestId);
        }
    }

    send = (data) => {
        data = typeof data === 'string' ? data : JSON.stringify(data);
        this.channel.send(data);
    }

    bufferFromString(str, bufferLength) {
        let strLen = str.length;

        let buf = new ArrayBuffer(bufferLength);
        let bufView = new Uint16Array(buf);
        for (let i = 0; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }

        for (let pad = strLen; pad < bufferLength; pad++) {
            bufView[pad] = "\0".charCodeAt(0);
        }

        return bufView.buffer;
    }

    sendCommunication(evtName, data) {
        if (this.channel && this.channel.readyState === 'open') {
            this.logger.debug('sending', evtName, data);
            return this.send({ event: evtName, payload: data });
        }

        this.sendCommunicationFallback(evtName, data);
    }

    requestDirectories = ({ event = 'directory.list.request', requestId }) => this.sendCommunication(event, { requestId });

    requestDirectory = ({ event = 'directory.get.request', requestId, path }) => this.sendCommunication(event, { requestId, path });

    forwardDirectories = async({ requestId }) => {
        const directories = (await this.emitter.emitAwait('peer.directory.list.request')).flat();
        this.sendCommunication('directory.list.response', { directories, requestId });
    }

    forwardDirectory = async({ requestId, path }) => {
        const directory = ((await this.emitter.emitAwait('peer.directory.get.request', path)).flat())[0];
        this.sendCommunication('directory.get.response', { directory, requestId });
    }

    handlePeerDirectoryList = (payload) =>
        this.emitter.emit('peer.directories.response', {
            id: this.id,
            name: this.name,
            ...payload
        });

    handlePeerDirectoryResponse = payload => this.emitter.emit('peer.directory.get.response', { id: this.id, ...payload });

    requestFile = ({ event = 'file.get.request', path, requestId }) => {
        this.incomingFiles[requestId] = {};
        return this.sendCommunication(event, { path, requestId, requestedChunkSize: this.fileChunkSize });
    }

    forwardFileDetails = async({ requestId, path, requestedChunkSize }) => {
        const preparePath = [ ...path ];
        if (this.outgoingFiles[requestId]) {
            return this.logger.debug('file already outgoing', requestId, this.outgoingFiles[requestId]);
        }

        const file = (((await this.emitter.emitAwait('peer.file.get.request', { path, requestId }))).flat())[0];

        const { name, size } = file;
        await this.emitter.emitAwait('file.prepare.outgoing', {
            path: preparePath,
            peerId: this.id,
            name,
            size,
            requestId,
            headerByteLength: this.headerByteLength,
            chunkSize: Math.min(requestedChunkSize, this.fileChunkSize)
        });

        const responseObject = {
            ...file, requestId, chunkSize: Math.min(requestedChunkSize, this.fileChunkSize)
        };

        if (requestedChunkSize > this.fileChunkSize) {
            responseObject.chunkSize = this.fileChunkSize;
        }

        this.sendCommunication('file.get.response', responseObject);
    }

    storeIncomingFileDetails = async(payload) => {
        const { requestId } = payload;
        if (!this.incomingFiles[requestId]) {
            return;
        }

        this.incomingFiles[requestId] = {
            ...payload,
            startPosition: 0,
            transferredBytes: 0,
            startTime: 0,
            lastTime: 0
        };

        await this.emitter.emitAwait('file.prepare.incoming', {
            ...payload,
            requestId,
            headerByteLength: this.headerByteLength
        });

        this.sendCommunication('file.transfer.proceed', { requestId, recvBytes: 0 });
    }

    storeOutgoingFileDetails = (payload) => {
        const { requestId } = payload;
        if (this.outgoingFiles[requestId]) {
            return this.logger.debug('already have an outgoing file registered', requestId);
        }

        this.outgoingFiles[requestId] = {
            ...payload,
            startPosition: 0,
            transferredBytes: 0,
            startTime: 0,
            lastTime: 0
        }
    }

    transferFileChunk = ({ requestId, recvBytes }) => this.emitter.emit('file.chunk.request', { peerId: this.id, requestId, recvBytes });

    handlePersistedChunk = ({ recvBytes, requestId }) => {
        if (!this.incomingFiles[requestId]) {
            return;
        }

        this.updateFileMetadata(this.incomingFiles, requestId, recvBytes);
        this.sendCommunication('file.transfer.proceed', { requestId, recvBytes });
    }

    handleOutgoingTransferCompleted = ({ requestId }) => {
        this.logger.debug('sending file transfer finalisation to peer', this.id, requestId);

        this.sendCommunication('file.transfer.complete', { requestId });
    }
}
