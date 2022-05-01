import EventEmitter from "./lib/eventEmitter.js";
import ComponentLoader from "./components/index.js";
import DirectoryService from "./services/directoryService.js";
import SessionService from "./services/sessionService.js";
import InitialConfigService from "./services/initialConfigService.js";
import TransportService from "./services/transportService.js";
import Logger from "./lib/logger.js";
import PeerService from "./services/peerService.js";
import UserService from "./services/userService.js";

const queryString = window.location.search.toLowerCase();
const urlParams = new URLSearchParams(queryString);
const isDebug = urlParams.get('loglevel') == 'debug';

class App {
    constructor() {
        const emitter = new EventEmitter();
        if (isDebug) { window.emitter = emitter; }
        const logger = new Logger(urlParams.get('loglevel'));
        this.componentLoader = new ComponentLoader({ emitter, logger });
        this.transportService = new TransportService({ emitter, logger });
        this.directoryService = new DirectoryService({ emitter, logger });
        this.userService = new UserService({ emitter, logger });
        this.initialConfigService = new InitialConfigService({ emitter, logger });
        this.sessionService = new SessionService({ emitter, logger });
        this.peerService = new PeerService({ emitter, logger });
    }
}

const app = new App();