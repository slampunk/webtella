import { getFileSize, uuid } from "../lib/utils.js";

export default class DirectoryList {
    constructor({ emitter, logger }) {
        this.emitter = emitter;
        this.logger = logger;
        this.directoryListElement = document.getElementById('local-view');
        this.remoteDirectoryListElement = document.getElementById('remote-directories');
        this.lastRequestId = '';
        this.downloads = {};
        console.log(this.downloads);
        this.addListeners();
    }

    addListeners() {
        this.emitter.on('directory.content', this.listDirectoryContentIn(this.directoryListElement));
        this.emitter.on('peer.directory.list', this.listPeerDirectories);
        this.emitter.on('peer.directory.content', this.handlePeerDirectoryResponse);
        this.emitter.on('file.incoming.details', this.logDownloadingFile);
        this.emitter.on('peer.directories.request, peer.directory.get.request, peer.file.get.request', this.logRequestId);
        this.emitter.on('file.transfer.progress.details', this.updateTransferProgress);
    }

    listDirectoryContentIn = (parent, peerId = '') => directoryContent => {
        const { hierarchy, content } = directoryContent;
        const elementId = `${peerId}${hierarchy[0]}`;
        const el = document.getElementById(elementId) || document.createElement('div');
        el.className = 'directory flex space-between align-center wrap';
        el.id = elementId;

        if (el.textContent) {
            el.innerHTML = '';
            el.classList.add('active');
        }

        const hierarchyElement = document.createElement('div');
        hierarchyElement.className = 'directory-hierarchy';
        hierarchy.forEach(this.appendHierarchyLinkTo(hierarchyElement, peerId));

        const minMaxButton = document.createElement('button');
        minMaxButton.className = 'min-max';

        const contentList = document.createElement('ul');
        content.forEach(this.appendContentItemTo(contentList, peerId));

        el.appendChild(hierarchyElement);
        el.appendChild(minMaxButton);
        el.appendChild(contentList);
        parent.appendChild(el);
        minMaxButton.addEventListener('click', this.minMaxDirectory, false);
    }

    handlePeerDirectoryResponse = ({ directory, requestId, id: peerId }) => {
        if (requestId != this.lastRequestId) {
            return this.logger.debug('skipping old request', requestId, 'current', this.lastRequestId);
        }

        this.listDirectoryContentIn(this.remoteDirectoryListElement, peerId)(directory);
    }

    minMaxDirectory = e => {
        const parent = e.currentTarget.parentNode;
        const isMaximised = parent.classList.contains('active');
        if (isMaximised) {
            parent.classList.remove('active');
        }
        else {
            parent.classList.add('active');
        }
    }

    appendHierarchyLinkTo = (parent, peerId) => (item, index, origArray) => {
        const link = document.createElement('a');
        link.textContent = item;
        link.setAttribute('data-path', JSON.stringify(origArray.slice(0, index + 1)));
        link.setAttribute('data-kind', 'directory');
        if (peerId) {
            link.setAttribute('data-peer', peerId);
        }

        if (index < origArray.length - 1) {
            link.addEventListener('click', this.handlePathClick, { once: true });
        }

        parent.appendChild(link);
    }

    appendContentItemTo = (parent, peerId) => ({ name, kind, path, size = 0 }) => {
        const itemElement = document.createElement('li');
        itemElement.className = 'flex align-center';
        if (kind === 'directory') {
            this.createDirectoryLinkElementIn(itemElement)(name, path, peerId);
        }
        else {
            this.createFileLinkElementIn(itemElement)(name, size, path, peerId);
        }

        parent.appendChild(itemElement);
    }

    createDirectoryLinkElementIn = itemElement => (name, path, peerId) => {
        const handleLink = document.createElement('a');
        handleLink.textContent = name;
        handleLink.setAttribute('data-path', JSON.stringify(path));
        handleLink.setAttribute('data-kind', 'directory');

        if (peerId) {
            handleLink.setAttribute('data-peer', peerId);
        }

        handleLink.addEventListener('click', this.handlePathClick, { once: true });
        
        itemElement.appendChild(handleLink);
        itemElement.setAttribute('data-kind', 'directory');
    }

    createFileLinkElementIn = itemElement => (name, size, path, peerId) => {
        const fileNameElement = document.createElement('span');
        fileNameElement.textContent = name;
        const fileSizeElement = document.createElement('span');
        fileSizeElement.textContent = getFileSize(size);
        const streamElement = document.createElement('a');
        streamElement.className = 'stream';
        streamElement.setAttribute('data-path', JSON.stringify(path));
        streamElement.setAttribute('data-kind', 'file');
        streamElement.title = 'stream (under construction)';
        const downloadElement = document.createElement('a');
        downloadElement.setAttribute('data-path', JSON.stringify(path));
        downloadElement.setAttribute('data-kind', 'file');
        downloadElement.setAttribute('data-name', name);
        downloadElement.className = 'download';
        downloadElement.title = `download ${name}`;
        if (this.downloads[name]) {
            this.attachDownloadData(downloadElement, this.downloads[name]);
        }
        else {
            console.log(name);
        }

        if (peerId) {
            streamElement.setAttribute('data-peer', peerId);
            downloadElement.setAttribute('data-peer', peerId);
        }

        downloadElement.addEventListener('click', this.handlePathClick, { once: true });

        itemElement.appendChild(fileNameElement);
        itemElement.appendChild(fileSizeElement);
        itemElement.appendChild(streamElement);
        itemElement.appendChild(downloadElement);
        itemElement.setAttribute('data-kind', 'file');
    }

    attachDownloadData = (element, requestId) => {
        element.classList.add('downloading');
        element.setAttribute('data-downloadid', requestId);
    }

    handlePathClick = e => {
        const isPeerLink = !!e.currentTarget.getAttribute('data-peer');

        if (isPeerLink) {
            return this.handleRemotePathClick(e);
            
        }
        else {
            return this.handleLocalPathClick(e);
        }
        
    }

    handleLocalPathClick = e => {
        const handleType = e.currentTarget.getAttribute('data-kind');
        const path = JSON.parse(e.currentTarget.getAttribute('data-path'));
        if (handleType == 'directory') {
            this.emitter.emit('directory.change', path);
        }
    }

    handleRemotePathClick = e => {
        if (e.currentTarget.classList.contains('downloading')) {
            return;
        }

        const requestId = uuid();
        const id = e.currentTarget.getAttribute('data-peer');
        const handleType = e.currentTarget.getAttribute('data-kind');
        const path = JSON.parse(e.currentTarget.getAttribute('data-path'));
        if (handleType == 'directory') {
            this.emitter.emit('peer.directory.get.request', { id, path, requestId });
        }
        else {
            this.emitter.emit('peer.file.get.request', { id, path, requestId });
            e.currentTarget.setAttribute('data-downloadid', requestId);
        }
    }

    downloadFile = file => {
        this.emitter.emit('file.create', file[0]);
    }

    logRequestId = (data, requestId) => {
        const newRequestId = requestId || data.requestId;
        this.lastRequestId = newRequestId;
    }

    listPeerDirectories = ({ directories, requestId, id: peerId }) => {
        if (requestId != this.lastRequestId) {
            return this.logger.debug('skipping old request', requestId, 'current', this.lastRequestId);
        }

        const peerName = document.querySelector(`.peers li[data-peer="${peerId}"] a`).textContent;

        this.remoteDirectoryListElement.textContent = '';
        this.remoteDirectoryListElement.setAttribute('data-peername', peerName);

        directories.forEach(this.listDirectoryContentIn(this.remoteDirectoryListElement, peerId));
    }

    logDownloadingFile = ({ name, requestId }) => {
        this.downloads[name] = requestId;
        this.downloads[requestId] = name;
        const downloadButton = this.remoteDirectoryListElement.querySelector(`a[data-downloadid="${requestId}"]`);
        if (downloadButton) {
            this.attachDownloadData(downloadButton, requestId);
        }
        else console.log('no such download button');
    }

    updateTransferProgress = ({ requestId, perc }) => {
        const downloadButton = this.remoteDirectoryListElement.querySelector(`a[data-downloadid="${requestId}"]`);
        if (!downloadButton) {
            return;
        }

        const oldPerc = +(downloadButton.getAttribute('data-perc'));
        if (oldPerc === perc) {
            return;
        }

        downloadButton.setAttribute('data-perc', perc);
        downloadButton.style.background = `conic-gradient(#8cf, #8cf ${perc/100}turn, transparent ${Math.min(1, (perc + 2)/100)}turn),
            white
        `;
    }
}
