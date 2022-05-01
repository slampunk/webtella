import { uuid } from "../lib/utils.js";

export default class SessionService {
    constructor({ emitter }) {
        this.emitter = emitter;
        this.sessionProperties = ['username'];

        this.attachEvents();
        this.init();
        
    }

    attachEvents() {
        this.emitter.on('username.set', this.saveUsername);
        this.emitter.on('username.get', this.getUsername);
    }

    init() {
        if (!localStorage.getItem('token')) {
            localStorage.setItem('token', uuid());
        }

        this.notifyUserDetails();
    }

    saveUsername = username => {
        localStorage.setItem('username', username);
        this.notifyUserDetails(username);
    }

    notifyUserDetails(eventedUsername) {
        const username = eventedUsername || localStorage.getItem('username');

        if (!username) {
            return this.emitter.emit('setup');
        }

        const token = localStorage.getItem('token');
        this.emitter.emit('session.user.details', { username, token });
    }

    getUsername = () => {
        return localStorage.getItem('username');
    }
}
