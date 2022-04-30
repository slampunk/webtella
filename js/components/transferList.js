import { durationFromSeconds, getFileSize } from "../lib/utils.js";

export default class TransferList {
    constructor({ emitter, logger }) {
        this.emitter = emitter;
        this.logger = logger;
        this.transferListElement = document.querySelector('ul.transfers');

        this.attachEvents();
    }

    attachEvents() {
        this.emitter.on('file.outgoing.details', this.createOutgoingTransferElement);
        this.emitter.on('file.incoming.details', this.createIncomingTransferElement);
        this.emitter.on('file.transfer.progress.details', this.updateTransferProgress);
    }

    createOutgoingTransferElement = payload => {
        this.createTransferElement({ direction: 'upload', ...payload });
    }

    createIncomingTransferElement = payload => {
        this.createTransferElement({ direction: 'download', ...payload });
    }

    createTransferElement = ({ direction, name, size, requestId, peerId }) => {
        const transferElement = document.createElement('li');
        transferElement.setAttribute('data-type', direction);
        const downloadName = document.createElement('span');
        downloadName.textContent = name;
        const progress = document.createElement('progress');
        progress.value = '0';
        progress.max = '100';
        const downloaded = document.createElement('span');
        downloaded.textContent = getFileSize();
        downloaded.setAttribute('data-totalsize', getFileSize(size));
        const rate = document.createElement('span');
        rate.textContent = '0 B/s';
        rate.setAttribute('data-rate', 'true');
        const duration = document.createElement('span');
        duration.textContent = '0 B/s';
        duration.setAttribute('data-duration', 'true');

        transferElement.id = requestId;
        transferElement.setAttribute('data-peer', peerId);

        transferElement.appendChild(downloadName);
        transferElement.appendChild(progress);
        transferElement.appendChild(downloaded);
        transferElement.appendChild(rate);
        transferElement.appendChild(duration);

        this.transferListElement.prepend(transferElement);
    }

    updateTransferProgress = ({ requestId, perc, rate, transferredBytes, remainingSeconds }) => {
        const transferElement = document.getElementById(requestId);
        if (!transferElement) {
            return;
        }

        transferElement.querySelector('progress').value = perc;
        transferElement.querySelector('span[data-totalsize]').textContent = getFileSize(transferredBytes);
        transferElement.querySelector('span[data-rate]').textContent = rate;
        transferElement.querySelector('span[data-duration]').textContent = durationFromSeconds(remainingSeconds);
    }
}