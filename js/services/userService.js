const roomMatch = window.location.pathname.match(/room\/([a-zA-Z0-9\-]+)/);
const room = roomMatch ? roomMatch[1] : '';

export default class UserService {
    constructor({ emitter, logger }) {
        this.emitter = emitter;
        this.logger = logger;
        this.details = {};

        this.attachEvents();
    }

    attachEvents() {
        this.emitter.on('session.user.details', this.setUserDetails);
    }

    setUserDetails = ({ username, token }) => {
        this.details = { username, token, room };
        this.emitter.emit('user.details', this.details);
    }
}
