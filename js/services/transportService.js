import WebsocketTransport from "./wsTransport.js";

export default class TransportService {
    constructor({ emitter, logger }) {
        this.emitter = emitter;
        this.events = [];

        this.defaultTransportType = 'ws';

        this.ws = new WebsocketTransport({ emitter, logger });
        this.defaultTransport = this.ws;
        this.attachEvents();
    }

    attachEvents() {
        this.emitter.on('user.details', this.handleUserDetailsChange);
        this.emitter.on('peer.connection', this.handlePeerConnectionRequest);
        this.emitter.on('room.leave', this.leaveRoom);
        this.emitter.on('room.join', this.joinRoom);
    }

    handleUserDetailsChange = payload => {
        const data = {
            event: 'details',
            payload
        }

        this.defaultTransport.sendMessage(data);
    }

    handlePeerConnectionRequest = data => {
        this.defaultTransport.sendMessage(data);
    }

    leaveRoom = async () => await new Promise(resolve => {
        this.emitter.once('room.leave.complete', () => {
            resolve();
        });
        this.defaultTransport.sendMessage({ action: 'leave-room' });
    });

    joinRoom = room => this.defaultTransport.sendMessage({ action: 'join-room', payload: { room } });
}
