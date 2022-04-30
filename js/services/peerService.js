import Peer from "../lib/peer.js";

const pc_config = {
    iceServers:[
        { urls: 'stun:stun.sipgate.net:3478' },
        { urls: 'stun:stun.sip.us:3478' }
    ]
};

export default class PeerService {
    constructor({ emitter, logger }) {
        this.emitter = emitter;
        this.logger = logger;
        this.peers = {};
        if (window.location.search.indexOf('debug') > -1) {
            window.peers = this.peers;
        }

        this.on = {
            offer: {
                handle: this.handleOffer
            },
            answer: {
                handle: this.handleAnswer
            },
            candidate: {
                handle: this.handleCandidate
            }
        }

        this.attachEvents();
    }

    attachEvents() {
        this.emitter.on('peer.connect', this.connectPeer);
        this.emitter.on('peerconnection', this.handlePeerConnection);
        this.emitter.on('peer.check', this.checkPeer);
        this.emitter.on('peer.directories.request', this.requestPeerDirectories);
        this.emitter.on('peer.directory.get.request', this.requestPeerDirectory);
        this.emitter.on('peer.file.get.request', this.requestFile);
        this.emitter.on('file.outgoing.chunk', this.handleFileChunkResponse);
        this.emitter.on('file.incoming.chunk.persisted', this.handleFileChunkPersisted);
        this.emitter.on('file.outgoing.complete', this.handleCompletedOutgoingFile);
        this.emitter.on('file.prepare.incoming', this.handleIncomingFilePreparation);
        this.emitter.on('file.prepare.outgoing', this.handleOutgoingFilePreparation);
    }

    connectPeer = (id, name) => {
        if (this.peers.hasOwnProperty(id)) {
            return;
        }

        this.attachPeerEvents(id);
        this.peers[id] = new Peer({ id, name, pc_config, emitter: this.emitter, initiate: true, logger: this.logger });
    }

    attachPeerEvents = peerId => {
        const scopedEmitter = this.emitter.scopeTo(`peer.${peerId}`);
        scopedEmitter.on('connection.mediate', this.mediateConnection);
        scopedEmitter.on('connection.established', this.notifySuccessfulConnection);
        scopedEmitter.on('peer.directory.list.request', this.getDirectories);
        scopedEmitter.on('peer.directories.response', this.handlePeerDirectories);
        scopedEmitter.on('peer.directory.get.request', this.getDirectory);
        scopedEmitter.on('peer.directory.get.response', this.handlePeerDirectory);
        scopedEmitter.on('peer.file.get.request', this.getFileDetails);
        scopedEmitter.on('file.prepare.outgoing', this.handleOutgoingFilePreparation);
        scopedEmitter.on('file.prepare.incoming', this.handleIncomingFilePreparation);
        scopedEmitter.on('file.prepare.outgoing', this.prepareOutgoingFile);
        scopedEmitter.on('file.prepare.incoming', this.prepareIncomingFile);
        scopedEmitter.on('file.chunk.request', this.handleFileChunkRequest);
        scopedEmitter.on('peer.binary.data', this.handleBinaryData);
        scopedEmitter.on('file.incoming.complete', this.handleCompletedFile);
        scopedEmitter.on('file.transfer.progress', this.handleTransferProgress);
        
    }

    mediateConnection = data => {
        this.emitter.emit('peer.connection', data);
    }

    handlePeerConnection = data => {
        const { details: { type: peerConnectionType } } = data;
        this.on[peerConnectionType].handle(data);
    }

    handleOffer = ({ target: id, details }) => {
        if (this.peers.hasOwnProperty(id)) {
            return;
        }

        this.attachPeerEvents(id);
        this.peers[id] = new Peer({ id, pc_config, emitter: this.emitter, initiate: false, logger: this.logger });
        this.peers[id].handleOffer(details);
    }

    handleAnswer = ({ target: id, details }) => {
        if (!this.peers.hasOwnProperty(id)) {
            return this.logger.warn('received an answer for unknown peer', id, details);
        }

        this.peers[id].handleAnswer(details);
    }

    handleCandidate = ({ target: id, details }) => {
        if (!this.peers.hasOwnProperty(id)) {
            return this.logger.warn('received an ice candidate for unknown peer', id, details);
        }

        this.peers[id].addRemoteCandidate(details);
    }

    notifySuccessfulConnection = (id, wasInitiated) => {
        this.emitter.emit('peer.connected', id, wasInitiated);
    }

    checkPeer = peerId => {
        return !!this.peers[peerId];
    }

    requestPeerDirectories = (peerId, requestId) => {
        if (!this.peers[peerId]) {
            return;
        }

        this.peers[peerId].requestDirectories({ requestId });
    }

    getDirectories = async() => (await this.emitter.emitAwait('directory.list')).flat();

    getDirectory = async(path) => (await this.emitter.emitAwait('directory.get', path)).flat();

    handlePeerDirectories = (response) => this.emitter.emit('peer.directory.list', response);

    handlePeerDirectory = (response) => this.emitter.emit('peer.directory.content', response);

    requestPeerDirectory = ({ id, path, requestId }) => {
        if (!this.peers[id]) {
            return this.logger.debug('unknown peer id provided', id);
        }

        this.peers[id].requestDirectory({ path, requestId });
    }

    requestFile = ({ id, path, requestId }) => {
        if (!this.peers[id]) {
            return this.logger.debug('unknown peer id provided', id);
        }

        this.peers[id].requestFile({ path, requestId });
    }

    getFileDetails = async({ path }) => (await this.emitter.emitAwait('file.get', path)).flat();

    prepareOutgoingFile = async ({ path, requestId, headerByteLength, chunkSize }) =>
        await this.emitter.emitAwait('file.outgoing.prepare', { path, requestId, headerByteLength, chunkSize });

    prepareIncomingFile = async ({ name, size, requestId, headerByteLength, chunkSize }) =>
        await this.emitter.emitAwait('file.incoming.prepare', { name, size, requestId, headerByteLength, chunkSize });

    handleFileChunkRequest = ({ peerId, requestId, recvBytes }) => this.emitter.emit('file.chunk.request', { peerId, requestId, recvBytes });

    handleFileChunkResponse = ({ requestId, peerId, buffer }) => {
        if (!this.peers[peerId]) {
            return this.logger.debug('unknown peer for file chunk response', peerId);
        }

        this.peers[peerId].sendBinaryData(requestId, buffer);
    }

    handleBinaryData = ({ data, id: peerId }) => this.emitter.emit('file.incoming.chunk', { data, peerId });

    handleFileChunkPersisted = ({ peerId, recvBytes, header: requestId }) => {
        if (!this.peers[peerId]) {
            return this.logger.debug('unknown peer for persisted chunk', peerId);
        }

        this.peers[peerId].handlePersistedChunk({ requestId, recvBytes });
    }

    handleCompletedOutgoingFile = ({ peerId, requestId }) => {
        if (!this.peers[peerId]) {
            return this.logger.debug('unknown peer for persisted chunk', peerId);
        }

        this.logger.debug('completing outgoing transfer', peerId, requestId);

        this.peers[peerId].handleOutgoingTransferCompleted({ requestId });
    }

    handleCompletedFile = ({ requestId }) => this.emitter.emit('file.incoming.complete', { requestId });

    handleOutgoingFilePreparation = payload => this.emitter.emit('file.outgoing.details', payload);

    handleIncomingFilePreparation = payload => this.emitter.emit('file.incoming.details', payload);

    handleTransferProgress = ({ requestId, perc, rate, transferredBytes, remainingSeconds }) =>
        this.emitter.emit('file.transfer.progress.details', { requestId, perc, rate, transferredBytes, remainingSeconds });
}
