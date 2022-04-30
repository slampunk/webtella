const fns = {
    trace: 'trace',
    debug: 'log',
    log: 'log',
    warn: 'warn',
    error: 'error'
}

const chromiumRegex = /\/([^\/\)]+)\)/g;
const firefoxRegex = /\/([^\/]+)$/g;

export default class Logger {
    constructor(logLevel) {
        const level = logLevel || 'error';
        this.levels = ['error', 'warn', 'log', 'debug', 'trace'];
        this.logLevel = this.levels.indexOf(level);
    }

    _performLog(level, args) {
        const err = new Error();
        const caller = `[${level.toUpperCase()}] (${this._getCaller(err.stack)})`;
        
        console[fns[level]].apply(null, [ caller ].concat(args));
    }

    log() {
        const args = Array.prototype.slice.call(arguments);

        if (this.logLevel >= this.levels.indexOf('log')) {
            this._performLog('log', args);
        }
    }

    debug() {
        const args = Array.prototype.slice.call(arguments);

        if (this.logLevel >= this.levels.indexOf('debug')) {
            this._performLog('debug', args);
        }
    }

    trace() {
        const args = Array.prototype.slice.call(arguments);

        if (this.logLevel >= this.levels.indexOf('trace')) {
            this._performLog('trace', args);
        }
    }

    warn() {
        const args = Array.prototype.slice.call(arguments);

        if (this.logLevel >= this.levels.indexOf('warn')) {
            this._performLog('warn', args);
        }
    }

    error() {
        const args = Array.prototype.slice.call(arguments);

        if (this.logLevel >= this.levels.indexOf('error')) {
            this._performLog('error', args);
        }
    }

    _getCaller = text =>
        !!window.InstallTrigger
        ? this._getFirefoxCaller(text)
        : this._getChromiumCaller(text);

    _getChromiumCaller = (text) =>
        ((text.split("\n")[3] || '').match(chromiumRegex) || ' ')[0]
                .replace('/', '').replace(')', '');

    _getFirefoxCaller = (text) =>
        ((text.split("\n")[2] || '').match(firefoxRegex) || ' ')[0]
            .replace("/", '');
}
