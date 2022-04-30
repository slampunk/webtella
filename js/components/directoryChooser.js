export default class DirectoryChooser {
    constructor({ emitter }) {
        this.emitter = emitter;
        document.getElementById('directoryChooser').addEventListener('click', this.handleClick, false);
    }

    handleClick = () => this.emitter.emit('directory.choose');
}