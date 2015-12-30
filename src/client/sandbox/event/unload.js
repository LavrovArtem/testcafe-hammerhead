import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import createPropertyDesc from '../../utils/create-property-desc.js';
import { isFirefox, isIE9, isIE10 } from '../../utils/browser';
import { objectStatic, stringProto, regExpProto, functionProto } from '../../../protos';

export default class UnloadSandbox extends SandboxBase {
    constructor (listeners) {
        super();

        this.BEFORE_UNLOAD_EVENT        = 'hammerhead|event|before-unload';
        this.BEFORE_BEFORE_UNLOAD_EVENT = 'hammerhead|event|before-before-unload';
        this.UNLOAD_EVENT               = 'hammerhead|event|unload';

        this.listeners = listeners;

        this.isFakeIEBeforeUnloadEvent     = false;
        this.storedBeforeUnloadReturnValue = '';
        this.prevented                     = false;
        this.storedBeforeUnloadHandler     = null;
    }

    // NOTE: This handler has to be called after others.
    _emitBeforeUnloadEvent () {
        this.emit(this.BEFORE_UNLOAD_EVENT, {
            returnValue:   this.storedBeforeUnloadReturnValue,
            prevented:     this.prevented,
            isFakeIEEvent: this.isFakeIEBeforeUnloadEvent
        });

        this.isFakeIEBeforeUnloadEvent = false;
    }

    _onBeforeUnloadHandler (e, originListener) {
        // NOTE: Overriding the returnValue property to prevent a native dialog.
        objectStatic.defineProperty(e, 'returnValue', createPropertyDesc({
            get: () => this.storedBeforeUnloadReturnValue,
            set: value => {
                // NOTE: In all browsers, if the property is set to any value, unload is prevented. In FireFox,
                // only if a value is set to an empty string, the unload operation is prevented.
                this.storedBeforeUnloadReturnValue = value;

                this.prevented = isFirefox ? value !== '' : true;
            }
        }));

        objectStatic.defineProperty(e, 'preventDefault', createPropertyDesc({
            get: () => () => this.prevented = true,
            set: () => void 0
        }));

        var res = originListener(e);

        if (typeof res !== 'undefined') {
            this.storedBeforeUnloadReturnValue = res;
            this.prevented                     = true;
        }
    }

    attach (window) {
        super.attach(window);

        var document  = window.document;
        var listeners = this.listeners;

        listeners.setEventListenerWrapper(window, ['beforeunload'], (e, listener) => this._onBeforeUnloadHandler(e, listener));
        listeners.addInternalEventListener(window, ['unload'], () => this.emit(this.UNLOAD_EVENT));

        functionProto.call(nativeMethods.addEventListener, document, 'click', e => {
            var target = e.target || e.srcElement;

            if ((isIE9 || isIE10) && target.tagName && stringProto.toLowerCase(target.tagName) === 'a') {
                var href = functionProto.call(nativeMethods.getAttribute, target, 'href');

                this.isFakeIEBeforeUnloadEvent = regExpProto.test(/(^javascript:)|(^mailto:)|(^tel:)|(^#)/, href);
            }
        });

        functionProto.call(nativeMethods.windowAddEventListener, window, 'beforeunload', () => this._emitBeforeUnloadEvent());

        listeners.addInternalEventListener(window, ['beforeunload'], () =>
                this.emit(this.BEFORE_BEFORE_UNLOAD_EVENT, {
                    isFakeIEEvent: this.isFakeIEBeforeUnloadEvent
                })
        );

        listeners.on(listeners.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.el === window && e.eventType === 'beforeunload') {
                // NOTE: reattach Listener, it'll be last in the queue.
                functionProto.call(nativeMethods.windowRemoveEventListener, window, 'beforeunload', () => this._emitBeforeUnloadEvent());
                functionProto.call(nativeMethods.windowAddEventListener, window, 'beforeunload', () => this._emitBeforeUnloadEvent());
            }
        });
    }

    setOnBeforeUnload (window, value) {
        if (typeof value === 'function') {

            this.storedBeforeUnloadHandler = value;

            window.onbeforeunload = e => this._onBeforeUnloadHandler(e, value);

            // NOTE: reattach Listener, it'll be last in the queue.
            functionProto.call(nativeMethods.windowRemoveEventListener, window, 'beforeunload', () => this._emitBeforeUnloadEvent());
            functionProto.call(nativeMethods.windowAddEventListener, window, 'beforeunload', () => this._emitBeforeUnloadEvent());
        }
        else {
            this.storedBeforeUnloadHandler = null;
            window.onbeforeunload          = null;
        }
    }

    getOnBeforeUnload () {
        return this.storedBeforeUnloadHandler;
    }
}
