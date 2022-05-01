export default class InitialConfigService {
    constructor({ emitter }) {
        this.emitter = emitter;

        this.attachEvents();
    }

    attachEvents() {
        this.emitter.on('setup', this.initiateSetup);
        this.emitter.on('directory.content', this.logChosenDirectory);
        this.emitter.on('room.new', this.createNewRoom);
        document.getElementById('setupDirectory')
            .addEventListener('click', this.setupDirectory);
        document.querySelector('#setup form')
            .addEventListener('submit', this.completeSetup);
        window.addEventListener('popstate', this.handleNewRoom);
    }

    initiateSetup = () => {
        document.getElementById('setup').showModal();
    }

    setupDirectory = () => this.emitter.emit('directory.choose');

    logChosenDirectory = ({ name }) => {
        const item = document.createElement('li');
        item.textContent = name;
        document.querySelector('dialog .directory-setup')
            .appendChild(item);
    }

    completeSetup = e => {
        const username = e.target.querySelector('input').value;
        this.emitter.emit('username.set', username);
    }

    createNewRoom = newRoom => {
        const room = newRoom.replace(/[\s|_]/g, '-').toLowerCase();
        history.pushState({ room }, '', `/room/${room}`);
        dispatchEvent(new PopStateEvent('popstate', { room }));
    }

    handleNewRoom = async(e) => {
        await this.emitter.emitAwait('room.leave');
        const roomMatch = window.location.pathname.match(/room\/([a-zA-Z0-9\-]+)/);
        const room = roomMatch ? roomMatch[1] : '';
        this.emitter.emit('room.join', room);
    }
}
