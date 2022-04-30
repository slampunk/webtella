import { resolveSequentially } from "./utils.js";

export default class PeerConnection {
    constructor({ emitter, id, initiate = false, pc_config, logger }) {
        this.emitter = emitter.scopeTo(`peer.${id}`);
        this.logger = logger;
        this.id = id;
        this.candidatesQueue = [];
        this.pc = new RTCPeerConnection(pc_config);
        this.initiate = initiate;

        this.handleRTCEvents();

        initiate && this.initiateConnection();
    }

    initiateConnection() {
        this.channel = this.pc.createDataChannel('channel');
        this.sendOffer();
    }

    handleRTCEvents() {
        this.pc.onicecandidate = this.handleIceCandidate;
        this.pc.oniceconnectionstatechange = this.handleIceStateChange;
        this.pc.ondatachannel = this.setupDataChannel;
        this.emitter.on(`connection.remote.config`, this.handleRemoteDescriptionAvailable);
        this.emitter.on(`request.offer`, this.handleOffer);
        this.emitter.on(`request.answer`, this.handleAnswer);
        this.emitter.on(`request.candidate`, this.addRemoteCandidate);
    }

    handleIceCandidate = (e) => {
        if (e.candidate) {
            const details = {
                ...e.candidate.toJSON(),
                type: 'candidate'
            };
            this.sendCommunication('connection.local.config', { target: this.id, details: details });
        }
    }

    handleIceStateChange = (e) => {
        // const isConnected = ['connected', 'completed'].find(state => state === this.pc.iceConnectionState);
        // if (isConnected) {
        //     this.emitter.emit('connection.established', this.id, this.initiate);
        // }

        this.logger.debug(this.pc.iceConnectionState);
    }

    handleRemoteDescriptionAvailable = () =>
        resolveSequentially(
            this.candidatesQueue.splice(0)
                .map(candidate => () => this.pc.addIceCandidate(candidate))
        );

    setupDataChannel = (e) => {
        if (!this.channel) {
            this.channel = e.channel;
            this.emitter.emit('datachannel.open');
        }

        this.channel.binaryType = 'arraybuffer';
    }

    sendOffer() {
        this.pc.createOffer()
            .then(offer => {
                this.pc.setLocalDescription(offer);
                this.sendCommunication('connection.local.config', { target: this.id, details: offer });
            });
    }

    sendAnswer = async() => {
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        return this.sendCommunication('connection.local.config', { target: this.id, details: answer });
    }

    sendCommunication(evtName, data) {
    }

    sendCommunicationFallback = (evtName, data) =>
        this.emitter.emit('connection.mediate', { event: 'peerconnection', payload: data });

    handleOffer = async(details) => {
        if (!this.pc.remoteDescription || !this.pc.remoteDescription.sdp) {
            await this.pc.setRemoteDescription(new RTCSessionDescription(details));
            await this.emitter.emitAwait(`connection.remote.config`);
        }

        return await this.sendAnswer();
    }

    handleAnswer = async (details) =>
        await this.pc.setRemoteDescription(new RTCSessionDescription(details));

    addRemoteCandidate = async (details) => {
        const candidate = new RTCIceCandidate(details);

        if (this.pc.remoteDescription) {
            return await this.pc.addIceCandidate(candidate);
        }

        this.candidatesQueue.push(candidate);
    }

    handleRemoteRequest(data) {
        const { details } = data;
        this.emitter.emit(`peer.${this.id}.request.${details.type}`, details);
    }
}