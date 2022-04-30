export default class SessionService {
    constructor({ emitter }) {
        this.emitter = emitter;
        this.sessionProperties = ['username'];

        this.attachEvents();
        this.notifyUsername();
    }

    attachEvents() {
        this.emitter.on('username.set', this.saveUsername);
        this.emitter.on('username.get', this.getUsername);
    }

    saveUsername = username => {
        localStorage.setItem('username', username);
        this.notifyUsername(username);
    }

    notifyUsername(eventedUsername) {
        const username = eventedUsername || localStorage.getItem('username');

        if (!username) {
            return this.emitter.emit('setup');
        }

        this.emitter.emit('username', username);
    }

    getUsername = () => {
        return localStorage.getItem('username');
    }
}
