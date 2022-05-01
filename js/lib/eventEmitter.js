export default class EventEmitter {
    constructor() {
  
        let _listener = {};
        let _onceListener = {};
        Object.defineProperty(this, 'listener', {
            get: () => _listener
        });
        Object.defineProperty(this, 'onceListener', {
            get: () => _onceListener
        });
    }
  
    on(ev, fnObj) {
        fnObj = typeof fnObj == 'function' ? {fn: fnObj, scope: null} : fnObj;

        let tokens = ev.split(',')
            .map(this._subscribe(fnObj));

        if (tokens.length === 1) {
            return tokens[0];
        }

        return tokens;
    }

    once(ev, fnObj) {
        fnObj = typeof fnObj == 'function' ? {fn: fnObj, scope: null} : fnObj;

        let tokens = ev.split(',')
            .map(this._subscribeOnce(fnObj));

        if (tokens.length === 1) {
            return tokens[0];
        }

        return tokens;
    }
  
    _subscribe = (fnObj) => (ev) => {
        ev = ev.trim();
        if (!this.listener[ev]) {
            this.listener[ev] = {};
        }

        let token = '';
        do {
            token = (Math.random() + 1).toString(36).substring(2, 10);
        } while (!!this.listener[ev][token]);

        this.listener[ev][token] = fnObj;
        return token;
    }

    _subscribeOnce = (fnObj) => (ev) => {
        ev = ev.trim();
        if (!this.onceListener[ev]) {
            this.onceListener[ev] = {};
        }

        let token = '';
        do {
            token = (Math.random() + 1).toString(36).substring(2, 10);
        } while (!!this.onceListener[ev][token]);

        this.onceListener[ev][token] = fnObj;
        return token;
    }
  
    off(ev, token) {
        ev.split(',')
            .map(singleEv => singleEv.trim())
            .forEach(e => {
                if (this.listener[e] && this.listener[e][token]) {
                    delete this.listener[e][token];
                }
                if (this.onceListener[e] && this.onceListener[e][token]) {
                    delete this.onceListener[e][token];
                }
            });
    }
  
    emit() {
        let args = Array.prototype.slice.call(arguments);
        let ev = args.splice(0, 1)[0];

        if (this.onceListener[ev]) {
            for (let token in this.onceListener[ev]) {
                try {
                    let fn = this.onceListener[ev][token].fn;
                    let scope = this.onceListener[ev][token].scope || null;
                    fn.apply(scope, args);
                } catch(e) {
                    console.log(e, ev, this.onceListener[ev]);
                }
            }

            delete this.onceListener[ev];
        }

        if (this.listener[ev]) {
            for (let token in this.listener[ev]) {
                try {
                    let fn = this.listener[ev][token].fn;
                    let scope = this.listener[ev][token].scope || null;
                    fn.apply(scope, args);
                } catch(e) {
                    console.log(e, ev, this.listener[ev]);
                }
            }
        }
    }

    query() {
        let args = Array.prototype.slice.call(arguments);
        let ev = args.splice(0, 1)[0];

        if (!this.listener[ev]) {
            return;
        }

        for (let token in this.listener[ev]) {
            try {
                let fn = this.listener[ev][token].fn;
                let scope = this.listener[ev][token].scope || null;
                return fn.apply(scope, args);
            } catch(e) {
                console.log(e, ev, this.listener[ev]);
            }
        }
    }

    async emitAwait() {
        let args = Array.prototype.slice.call(arguments);
        let ev = args.splice(0, 1)[0];

        let resultsArray = [];

        if (this.onceListener[ev]) {
            for (let token in this.onceListener[ev]) {
                try {
                    let fn = this.onceListener[ev][token].fn;
                    let scope = this.onceListener[ev][token].scope || null;
                    const result = fn.constructor.name === 'AsyncFunction'
                        ? await fn.apply(scope, args)
                        : fn.apply(scope, args);
    
                    resultsArray.push(result);
                } catch(e) {
                    console.log(e, ev, this.onceListener[ev]);
                }
            }

            delete this.onceListener[ev];
        }

        if (this.listener[ev]) {
            for (let token in this.listener[ev]) {
                try {
                    let fn = this.listener[ev][token].fn;
                    let scope = this.listener[ev][token].scope || null;
                    const result = fn.constructor.name === 'AsyncFunction'
                        ? await fn.apply(scope, args)
                        : fn.apply(scope, args);
    
                    resultsArray.push(result);
                } catch(e) {
                    console.log(e, ev, this.listener[ev]);
                }
            }
        }

        return Promise.resolve(resultsArray);
    }

    scopeTo = scope => ({
        on: (ev, fnObj) => {
            const scopedEvent = ev.split(',')
                .map(subEv => `${scope}.${subEv}`)
                .join(',')

            return this.on(scopedEvent, fnObj);
        },
        once: (ev, fnObj) => {
            const scopedEvent = ev.split(',')
                .map(subEv => `${scope}.${subEv}`)
                .join(',')

            return this.once(scopedEvent, fnObj);
        },
        off: (ev, token) => {
            const scopedEvent = ev.split(',')
                .map(subEv => `${scope}.${subEv}`)
                .join(',')

            return this.off(scopedEvent, token);
        },
        emit: function() {
            const args = Array.prototype.slice.call(arguments);
            args[0] = `${scope}.${args[0]}`;

            return this.emit.apply(this, args);
        }.bind(this),
        emitAwait: function() {
            const args = Array.prototype.slice.call(arguments);
            args[0] = `${scope}.${args[0]}`;

            return this.emitAwait.apply(this, args);
        }.bind(this),
        query: function() {
            const args = Array.prototype.slice.call(arguments);
            args[0] = `${scope}.${args[0]}`;

            return this.query.apply(this, args);
        }.bind(this),
        unscoped: this
    })
}