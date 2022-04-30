import { camelise } from "../lib/utils.js";

export default class WebsocketTransport {
    constructor({ emitter, logger }) {
        this.emitter = emitter;
        this.logger = logger;
        this.socket = new WebSocket('wss://1v4j1j98ob.execute-api.ap-south-1.amazonaws.com/beta');
        this.handleSocketEvents();
        this.attachEvents();

        this.queue = [];
    }

    handleSocketEvents() {
        this.socket.onopen = e => {
            this.logger.trace('opened', e, this.socket);
            this.emitter.emit('ws.open');
            this.queue.splice(0).forEach(this.sendMessage);
        };

        this.socket.onclose = e => {
            this.logger.log('socket closed', e);
        };

        this.socket.onerror = e => {
            this.logger.log('socket error', e);
        };

        this.socket.onmessage = e => {
            try {
                let message = JSON.parse(e.data);
                if (Array.isArray(message.payload)) {
                    message.payload.forEach(camelise);
                }
                else if (message.payload && typeof message.payload == 'object') {
                    camelise(message.payload);
                }
                this.logger.debug(message);
                this.emitter.emit(message.action, message.payload);
            } catch (e) {
            }
        };
    }

    attachEvents() {
        this.emitter.on('ws.send', this.sendMessage);
    }

    sendMessage = data => {
        if (!data) {
            return;
        }

        data.action = data.action || data.event;
        delete data.event;

        if (!this.socket.readyState) {
            return this.queue.push(data);
        }

        let payload = typeof data == 'string' ? data : JSON.stringify(data);
        this.socket.send(payload);
    }
}