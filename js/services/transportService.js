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
        this.emitter.on('username', this.handleUsernameChange);
        this.emitter.on('peer.connection', this.handlePeerConnectionRequest);
    }

    handleUsernameChange = username => {
        const data = {
            event: 'name',
            payload: username
        }

        this.defaultTransport.sendMessage(data);
    }

    handlePeerConnectionRequest = data => {
        this.defaultTransport.sendMessage(data);
    }
}
