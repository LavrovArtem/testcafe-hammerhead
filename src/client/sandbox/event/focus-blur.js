import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import SandboxBase from '../base';
import ActiveWindowTracker from '../event/active-window-tracker';
import nativeMethods from '../native-methods';
import * as browserUtils from '../../utils/browser';
import * as domUtils from '../../utils/dom';
import * as styleUtils from '../../utils/style';
import { functionProto, arrayProto, stringProto } from '../../../protos';

const INTERNAL_FOCUS_FLAG = 'hammerhead|internal-focus';
const INTERNAL_BLUR_FLAG  = 'hammerhead|internal-blur';

export default class FocusBlurSandbox extends SandboxBase {
    constructor (listeners, eventSimulator, messageSandbox, shadowUI, timersSandbox, elementEditingWatcher) {
        super();

        this.shouldDisableOuterFocusHandlers = false;
        this.topWindow                       = null;
        this.lastFocusedElement              = null;

        this.eventSimulator        = eventSimulator;
        this.activeWindowTracker   = new ActiveWindowTracker(messageSandbox);
        this.shadowUI              = shadowUI;
        this.listeners             = listeners;
        this.elementEditingWatcher = elementEditingWatcher;
        this.timersSandbox         = timersSandbox;
    }

    static _getNativeMeth (el, event) {
        if (domUtils.isSVGElement(el)) {
            if (event === 'focus')
                return nativeMethods.svgFocus;
            else if (event === 'blur')
                return nativeMethods.svgBlur;
        }

        return nativeMethods[event];
    }

    static _restoreElementScroll (el, scroll) {
        var newScroll = styleUtils.getElementScroll(el);

        if (newScroll.left !== scroll.left)
            styleUtils.setScrollLeft(el, scroll.left);

        if (newScroll.top !== scroll.top)
            styleUtils.setScrollTop(el, scroll.top);
    }

    _onChangeActiveElement (activeElement) {
        if (this.lastFocusedElement === activeElement)
            return;

        if (this.lastFocusedElement &&
            functionProto.call(nativeMethods.getAttribute, this.lastFocusedElement, INTERNAL_ATTRS.focusPseudoClass))
            functionProto.call(nativeMethods.removeAttribute, this.lastFocusedElement, INTERNAL_ATTRS.focusPseudoClass);

        if (domUtils.isElementFocusable(activeElement) &&
            !(domUtils.isBodyElement(activeElement) &&
            activeElement.getAttribute('tabIndex') === null)) {
            this.lastFocusedElement = activeElement;
            functionProto.call(nativeMethods.setAttribute, activeElement, INTERNAL_ATTRS.focusPseudoClass, true);
        }
        else
            this.lastFocusedElement = null;
    }


    _raiseEvent (el, type, callback, withoutHandlers, isAsync, forMouseEvent, preventScrolling) {
        // NOTE: We cannot use Promise because 'resolve' will be called async, but we need to resolve
        // immediately in IE9 and IE10.

        // NOTE: The focus and blur events should be raised after activeElement is changed (B237489)
        // in MSEdge, the focus/blur events are executed  synchronously.
        var simulateEvent = () => {
            if (browserUtils.isIE && browserUtils.version < 12) {
                this.window.setTimeout(() => {
                    this.window.setTimeout(() => {
                        if (el[FocusBlurSandbox.getInternalEventFlag(type)])
                            delete el[FocusBlurSandbox.getInternalEventFlag(type)];
                    }, 0);
                }, 0);
            }
            else if (el[FocusBlurSandbox.getInternalEventFlag(type)])
                delete el[FocusBlurSandbox.getInternalEventFlag(type)];

            if (!withoutHandlers) {
                if (isAsync)
                    this.timersSandbox.deferFunction(() => this.eventSimulator[type](el));
                else
                    this.eventSimulator[type](el);
            }

            callback();
        };

        // NOTE: T239149 - TD15.1? - An error occurs during assertion creation on
        // http://knockoutjs.com/examples/helloWorld.html in IE9.
        if (browserUtils.isIE9 && this.shadowUI.getRoot() === el && (type === 'focus' || type === 'blur'))
            callback();

        if (el[type]) {
            // NOTE: We should guarantee that activeElement will be changed, therefore we need to call the native
            // focus/blur event. To guarantee that all focus/blur events are raised, we need to raise them manually.
            var windowScroll                     = null;
            var elementParents                   = [];
            var nonScrollableParents             = [];
            var nonScrollableParentsScrollValues = [];

            if (preventScrolling)
                windowScroll = styleUtils.getElementScroll(this.window);

            if (browserUtils.isIE) {
                elementParents = domUtils.getParents(el);

                for (var i = 0; i < elementParents.length; i++) {
                    if (styleUtils.get(elementParents[i], 'overflow') === 'hidden') {
                        arrayProto.push(nonScrollableParents, elementParents[i]);
                        arrayProto.push(nonScrollableParentsScrollValues, styleUtils.getElementScroll(elementParents[i]));
                    }
                }
            }

            var tempElement = null;

            if (type === 'focus' && el.tagName && stringProto.toLowerCase(el.tagName) === 'label' &&
                el.htmlFor) {
                tempElement = domUtils.findDocument(el).getElementById(el.htmlFor);
                if (tempElement)
                    el = tempElement;
                else {
                    callback();
                    return;
                }
            }

            el[FocusBlurSandbox.getInternalEventFlag(type)] = true;

            functionProto.call(FocusBlurSandbox._getNativeMeth(el, type), el);

            if (preventScrolling)
                FocusBlurSandbox._restoreElementScroll(this.window, windowScroll);

            if (browserUtils.isIE && nonScrollableParents.length) {
                arrayProto.forEach(nonScrollableParents, (parent, index) => {
                    FocusBlurSandbox._restoreElementScroll(parent, nonScrollableParentsScrollValues[index]);
                });
            }

            var curDocument   = domUtils.findDocument(el);
            var activeElement = domUtils.getActiveElement(curDocument);

            // NOTE: If the element was not focused and has a parent with tabindex, we focus this parent.
            var parent             = el.parentNode;
            var parentWithTabIndex = parent === document ? null : domUtils.closest(parent, '[tabindex]');

            if (type === 'focus' && activeElement !== el && parentWithTabIndex && forMouseEvent) {
                // NOTE: In WebKit, Safari and MSEdge, calling the native focus event for a parent element
                // raises page scrolling. We can't prevent it. Therefore, we need to restore a page scrolling value.
                var needPreventScrolling = browserUtils.isWebKit || browserUtils.isSafari || browserUtils.isIE;

                this._raiseEvent(parentWithTabIndex, 'focus', simulateEvent, false, false, forMouseEvent, needPreventScrolling);
            }
            // NOTE: Some browsers don't change document.activeElement after calling element.blur() if a browser
            // window is in the background. That's why we call body.focus() without handlers. It should be called
            // synchronously because client scripts may expect that document.activeElement will be changed immediately
            // after element.blur() is called.
            else if (type === 'blur' && activeElement === el && el !== curDocument.body)
                this._raiseEvent(curDocument.body, 'focus', simulateEvent, true);
            else
                simulateEvent();
        }
        else
            simulateEvent();
    }

    static getInternalEventFlag (type) {
        return type === 'focus' ? INTERNAL_FOCUS_FLAG : INTERNAL_BLUR_FLAG;
    }

    attach (window) {
        super.attach(window);

        this.activeWindowTracker.attach(window);
        this.topWindow = domUtils.isCrossDomainWindows(window, window.top) ? window : window.top;

        this.listeners.addInternalEventListener(window, ['focus', 'blur'], () => this._onChangeActiveElement(this.document.activeElement));
    }

    _callFocusCallback (callback, el) {
        // NOTE: In MSEdge, the 'selectionchange' event doesn't occur immediately (it occurs with a some delay)
        // so we should raise it right after the 'focus' event is raised.
        if (browserUtils.isIE && browserUtils.version > 11 && el && domUtils.isTextEditableElement(el))
            this.eventSimulator.selectionchange(el);

        if (typeof callback === 'function')
            callback();
    }

    focus (el, callback, silent, forMouseEvent, isNativeFocus) {
        if (this.shouldDisableOuterFocusHandlers && !domUtils.isShadowUIElement(el))
            return null;

        var isElementInIframe = domUtils.isElementInIframe(el);
        var iframeElement     = isElementInIframe ? domUtils.getIframeByElement(el) : null;
        var curDocument       = domUtils.findDocument(el);
        var isBodyElement     = el === curDocument.body;

        var activeElement         = domUtils.getActiveElement();
        var activeElementDocument = domUtils.findDocument(activeElement);

        var withoutHandlers = false;
        var needBlur        = false;
        var needBlurIframe  = false;

        var isContentEditable     = domUtils.isContentEditableElement(el);
        var isCurrentWindowActive = this.activeWindowTracker.isCurrentWindowActive();

        if (activeElement === el)
            withoutHandlers = !(isBodyElement && isContentEditable && !isCurrentWindowActive);
        else
            withoutHandlers = isBodyElement && !(isContentEditable || browserUtils.isIE);

        // NOTE: In IE, if you call focus() or blur() methods from script, an active element is changed immediately,
        // but events are raised asynchronously after some timeout.
        var isAsync         = false;
        var raiseFocusEvent = () => {
            if (!isCurrentWindowActive && !domUtils.isShadowUIElement(el))
                this.activeWindowTracker.makeCurrentWindowActive();

            this._raiseEvent(el, 'focus', () => {
                if (!silent)
                    this.elementEditingWatcher.watchElementEditing(el);

                // NOTE: If we call focus for an unfocusable element (like 'div' or 'image') in iframe, we should
                // specify document.active for this iframe manually, so we call focus without handlers.
                if (isElementInIframe && iframeElement && this.topWindow.document.activeElement !== iframeElement)
                    this._raiseEvent(iframeElement, 'focus', () => this._callFocusCallback(callback, el), true, isAsync);
                else
                    this._callFocusCallback(callback, el);

            }, withoutHandlers || silent, isAsync, forMouseEvent);
        };

        if (isNativeFocus && browserUtils.isIE) {
            // NOTE: In IE, the focus() method does not have any effect if it is called in the focus event handler
            // during the  second event phase.
            if ((this.eventSimulator.isSavedWindowsEventsExists() || browserUtils.isIE && browserUtils.version > 10) &&
                this.window.event &&
                this.window.event.type === 'focus' && this.window.event.srcElement === el) {
                this._callFocusCallback(callback);

                return null;
            }

            // NOTE: In MSEdge, the focus/blur events are executed synchronously.
            if (browserUtils.version < 12)
                isAsync = true;
        }

        if (activeElement && activeElement.tagName) {
            if (activeElement !== el) {
                // NOTE: B253685
                if (curDocument !== activeElementDocument && activeElement === activeElementDocument.body)
                    needBlur = false;
                else if (activeElement === curDocument.body) {
                    // NOTE: The Blur event is raised for the body only in IE. In addition, we must not call the
                    // blur function for the body because this moves the browser window into the background.
                    if (!silent && browserUtils.isIE) {
                        var simulateBodyBlur = functionProto.bind(this.eventSimulator.blur, this.eventSimulator, activeElement);

                        if (isAsync)
                            functionProto.call(this.timersSandbox.setTimeout, this.window, simulateBodyBlur, 0);
                        else
                            simulateBodyBlur();
                    }
                }
                else
                    needBlur = true;
            }

            // NOTE: B254260
            needBlurIframe = curDocument !== activeElementDocument &&
                             domUtils.isElementInIframe(activeElement, activeElementDocument);
        }
        // NOTE: We always call blur for iframe manually without handlers (B254260).
        if (needBlurIframe && !needBlur) {
            if (browserUtils.isIE) {
                // NOTE: We should call blur for iframe with handlers in IE but we can't call the method 'blur'
                // because activeElement !== element and handlers will not be called.
                this.eventSimulator.blur(domUtils.getIframeByElement(activeElement));
                raiseFocusEvent();
            }
            else
                this.blur(domUtils.getIframeByElement(activeElement), raiseFocusEvent, true, isNativeFocus);
        }
        else if (needBlur) {
            this.blur(activeElement, () => {
                if (needBlurIframe)
                    this.blur(domUtils.getIframeByElement(activeElement), raiseFocusEvent, true, isNativeFocus);
                else
                    raiseFocusEvent();
            }, silent, isNativeFocus);
        }
        else
            raiseFocusEvent();
    }

    disableOuterFocusHandlers () {
        this.shouldDisableOuterFocusHandlers = true;
    }

    enableOuterFocusHandlers () {
        this.shouldDisableOuterFocusHandlers = false;
    }

    blur (el, callback, withoutHandlers, isNativeBlur) {
        var activeElement = domUtils.getActiveElement(domUtils.findDocument(el));
        // NOTE: In IE, if you call the focus() or blur() method from script, an active element is changed
        // immediately but events are raised asynchronously after some timeout (in MSEdgethe focus/blur methods
        // are executed synchronously).
        var isAsync = isNativeBlur && browserUtils.isIE && browserUtils.version < 12;

        if (activeElement !== el)
            withoutHandlers = true;

        if (!withoutHandlers) {
            this.elementEditingWatcher.processElementChanging(el);
            this.elementEditingWatcher.stopWatching(el);
        }

        this._raiseEvent(el, 'blur', () => {
            if (typeof callback === 'function')
                callback();
        }, withoutHandlers, isAsync);
    }
}
