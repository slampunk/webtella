export default class MobileFileChooser {
    constructor({ emitter }) {
        this.emitter = emitter;
        this.fileContainer = document.getElementsByClassName('mobile-files')[0];
        this.fileContainer.querySelector('input.active').addEventListener('change', this.handleChange);
    }

    handleChange = (e) => {
        this.emitter.emit('mobile.files.add', e.target.files);
        e.target.className = '';
        const newFileInput = document.createElement('input');
        newFileInput.type = 'file';
        newFileInput.setAttribute('multiple', true);
        newFileInput.className = 'active';
        this.fileContainer.appendChild(newFileInput);
        newFileInput.addEventListener('change', this.handleChange);
    }
}