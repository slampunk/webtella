import { uuid } from "../lib/utils.js";

export default class PeerList {
    constructor({ emitter, logger }) {
        this.emitter = emitter;
        this.logger = logger;
        this.userListEl = document.querySelector('ul.peers');
        this.lastRequestId = '';

        this.attachEvents();
    }

    attachEvents() {
        this.emitter.on('user.list', this.handleUserList);
        this.emitter.on('user.remove', this.removeUser);
        this.emitter.on('user.update', this.addOrUpdateUser);
        this.emitter.on('peerconnection', this.triggerConnection);
        this.emitter.on('peer.connected', this.handleConnectedPeer);
        this.emitter.on('peer.directories.request, peer.directory.get.request, peer.file.get.request', this.logRequestId);
    }

    handleUserList = data => {
        const validUsers = data.filter(({ userId, username }) => userId && username);
        validUsers.forEach(this.createUserLink);
    }

    createUserLink = ({ userId, username }) => {
        const userItem = document.createElement('li');
        userItem.setAttribute('data-peer', userId);
        const userLink = document.createElement('a');
        userLink.textContent = username;
        userItem.appendChild(userLink);
        this.userListEl.appendChild(userItem);

        userLink.addEventListener('click', this.handleUserLink, false);
    }

    handleUserLink = e => {
        const peerId = e.currentTarget.parentNode.getAttribute('data-peer');

        const isPeerConnected = this.emitter.query('peer.check', peerId);

        if (isPeerConnected) {
            this.requestDirectories(peerId);
        }
        else {
            this.connectUser(peerId);
        }
    }

    requestDirectories = peerId => {
        const requestId = uuid();
        this.emitter.emit('peer.directories.request', peerId, requestId);
    }

    connectUser = peerId => {
        this.userListEl.querySelector(`li[data-peer="${peerId}"]`).classList.add('connecting');
        this.emitter.emit('peer.connect', peerId);
    }

    removeUser = async(data) => {
        const userItem = document.querySelector(`li[data-peer="${data.userId}"]`);
        if (!userItem) {
            return;
        }

        userItem.removeEventListener('click', this.connectUser);
        userItem.remove();
    }

    addOrUpdateUser = async(data) => {
        const userItem = document.querySelector(`li[data-peer="${data.userId}"]`);
        if (userItem) {
            return;
        }

        this.createUserLink(data);
    }

    triggerConnection = data => {
        const { details: { type }, target } = data;
        this.logger.trace(data);

        if (type !== 'offer') {
            return;
        }

        const userItem = document.querySelector(`li[data-peer="${target}"]`);
        if (!userItem) {
            return;
        }

        userItem.classList.add('connecting');
    }

    handleConnectedPeer = (peerId, wasInitiated) => {
        const userItem = document.querySelector(`li[data-peer="${peerId}"]`);
        if (!userItem) {
            return this.logger.debug('unknown peer connected', peerId);
        }

        userItem.classList.remove('connecting');
        userItem.classList.add('connected');
        
        if (wasInitiated) {
            this.requestDirectories(peerId);
        }
    }

    logRequestId = (data, requestId) => {
        const newRequestId = requestId || data.requestId;
        this.lastRequestId = newRequestId;
    }
}
