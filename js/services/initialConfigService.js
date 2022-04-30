export default class InitialConfigService {
    constructor({ emitter }) {
        this.emitter = emitter;

        this.attachEvents();
    }

    attachEvents() {
        this.emitter.on('setup', this.initiateSetup);
        this.emitter.on('directory.content', this.logChosenDirectory);
        document.getElementById('setupDirectory')
            .addEventListener('click', this.setupDirectory);
        document.querySelector('#setup form')
            .addEventListener('submit', this.completeSetup);
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
}
