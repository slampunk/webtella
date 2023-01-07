import DirectoryChooser  from "./directoryChooser.js";
import DirectoryList from "./directoryList.js";
import PeerList from "./peerList.js";
import TransferList from "./transferList.js";
import MobileFileChooser from "./mobileFileChooser.js";

export default class ComponentLoader {
    constructor(props) {
        this.directoryChooser = new DirectoryChooser(props);
        this.directoryList = new DirectoryList(props);
        this.peerList = new PeerList(props);
        this.transferList = new TransferList(props);
        this.mobileFileChooser = new MobileFileChooser(props);
    }
}
