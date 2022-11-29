var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Ticker: () => Ticker,
  UPDATE_PRIORITY: () => UPDATE_PRIORITY
});
module.exports = __toCommonJS(src_exports);

// src/const.ts
var UPDATE_PRIORITY = /* @__PURE__ */ ((UPDATE_PRIORITY2) => {
  UPDATE_PRIORITY2[UPDATE_PRIORITY2["HIGH"] = 25] = "HIGH";
  UPDATE_PRIORITY2[UPDATE_PRIORITY2["NORMAL"] = 0] = "NORMAL";
  UPDATE_PRIORITY2[UPDATE_PRIORITY2["LOW"] = -25] = "LOW";
  UPDATE_PRIORITY2[UPDATE_PRIORITY2["UTILITY"] = -50] = "UTILITY";
  return UPDATE_PRIORITY2;
})(UPDATE_PRIORITY || {});

// src/TickerListener.ts
var TickerListener = class {
  constructor(fn, context = null, priority = 0, once = false) {
    this.next = null;
    this.previous = null;
    this._destroyed = false;
    this.fn = fn;
    this.context = context;
    this.priority = priority;
    this.once = once;
  }
  match(fn, context = null) {
    return this.fn === fn && this.context === context;
  }
  emit(deltaTime) {
    if (this.fn) {
      if (this.context) {
        this.fn.call(this.context, deltaTime);
      } else {
        this.fn(deltaTime);
      }
    }
    const redirect = this.next;
    if (this.once) {
      this.destroy(true);
    }
    if (this._destroyed) {
      this.next = null;
    }
    return redirect;
  }
  connect(previous) {
    this.previous = previous;
    if (previous.next) {
      previous.next.previous = this;
    }
    this.next = previous.next;
    previous.next = this;
  }
  destroy(hard = false) {
    this._destroyed = true;
    this.fn = null;
    this.context = null;
    if (this.previous) {
      this.previous.next = this.next;
    }
    if (this.next) {
      this.next.previous = this.previous;
    }
    const redirect = this.next;
    this.next = hard ? null : redirect;
    this.previous = null;
    return redirect;
  }
};

// src/Ticker.ts
var import_timers = require("timers");
var lastTime = 0;
var requestAnimationFrame = (callback) => {
  const currentTime = performance.now();
  const timeToCall = Math.max(0, 16 - (currentTime - lastTime));
  const id = setTimeout(() => {
    callback(currentTime + timeToCall);
  }, timeToCall);
  lastTime = currentTime + timeToCall;
  return id;
};
var cancelAnimationFrame = (requestId) => (0, import_timers.clearTimeout)(requestId);
var _Ticker = class {
  constructor() {
    this.autoStart = false;
    this.deltaTime = 1;
    this.lastTime = -1;
    this.speed = 1;
    this.started = false;
    this._requestId = null;
    this._maxElapsedMS = 100;
    this._minElapsedMS = 0;
    this._protected = false;
    this._lastFrame = -1;
    this._head = new TickerListener(null, null, Infinity);
    this.deltaMS = 1 / _Ticker.targetFPMS;
    this.elapsedMS = 1 / _Ticker.targetFPMS;
    this._tick = (time) => {
      this._requestId = null;
      if (this.started) {
        this.update(time);
        if (this.started && this._requestId === null && this._head.next) {
          this._requestId = requestAnimationFrame(this._tick);
        }
      }
    };
  }
  _requestIfNeeded() {
    if (this._requestId === null && this._head.next) {
      this.lastTime = performance.now();
      this._lastFrame = this.lastTime;
      this._requestId = requestAnimationFrame(this._tick);
    }
  }
  _cancelIfNeeded() {
    if (this._requestId !== null) {
      cancelAnimationFrame(this._requestId);
      this._requestId = null;
    }
  }
  _startIfPossible() {
    if (this.started) {
      this._requestIfNeeded();
    } else if (this.autoStart) {
      this.start();
    }
  }
  add(fn, context, priority = 0 /* NORMAL */) {
    return this._addListener(new TickerListener(fn, context, priority));
  }
  addOnce(fn, context, priority = 0 /* NORMAL */) {
    return this._addListener(new TickerListener(fn, context, priority, true));
  }
  _addListener(listener) {
    let current = this._head.next;
    let previous = this._head;
    if (!current) {
      listener.connect(previous);
    } else {
      while (current) {
        if (listener.priority > current.priority) {
          listener.connect(previous);
          break;
        }
        previous = current;
        current = current.next;
      }
      if (!listener.previous) {
        listener.connect(previous);
      }
    }
    this._startIfPossible();
    return this;
  }
  remove(fn, context) {
    let listener = this._head.next;
    while (listener) {
      if (listener.match(fn, context)) {
        listener = listener.destroy();
      } else {
        listener = listener.next;
      }
    }
    if (!this._head.next) {
      this._cancelIfNeeded();
    }
    return this;
  }
  get count() {
    if (!this._head) {
      return 0;
    }
    let count = 0;
    let current = this._head;
    while (current = current.next) {
      count++;
    }
    return count;
  }
  start() {
    if (!this.started) {
      this.started = true;
      this._requestIfNeeded();
    }
  }
  stop() {
    if (this.started) {
      this.started = false;
      this._cancelIfNeeded();
    }
  }
  destroy() {
    if (!this._protected) {
      this.stop();
      let listener = this._head.next;
      while (listener) {
        listener = listener.destroy(true);
      }
      this._head.destroy();
      this._head = null;
    }
  }
  update(currentTime = performance.now()) {
    let elapsedMS;
    if (currentTime > this.lastTime) {
      elapsedMS = this.elapsedMS = currentTime - this.lastTime;
      if (elapsedMS > this._maxElapsedMS) {
        elapsedMS = this._maxElapsedMS;
      }
      elapsedMS *= this.speed;
      if (this._minElapsedMS) {
        const delta = currentTime - this._lastFrame | 0;
        if (delta < this._minElapsedMS) {
          return;
        }
        this._lastFrame = currentTime - delta % this._minElapsedMS;
      }
      this.deltaMS = elapsedMS;
      this.deltaTime = this.deltaMS * _Ticker.targetFPMS;
      const head = this._head;
      let listener = head.next;
      while (listener) {
        listener = listener.emit(this.deltaTime);
      }
      if (!head.next) {
        this._cancelIfNeeded();
      }
    } else {
      this.deltaTime = this.deltaMS = this.elapsedMS = 0;
    }
    this.lastTime = currentTime;
  }
  get FPS() {
    return 1e3 / this.elapsedMS;
  }
  get minFPS() {
    return 1e3 / this._maxElapsedMS;
  }
  set minFPS(fps) {
    const minFPS = Math.min(this.maxFPS, fps);
    const minFPMS = Math.min(Math.max(0, minFPS) / 1e3, _Ticker.targetFPMS);
    this._maxElapsedMS = 1 / minFPMS;
  }
  get maxFPS() {
    if (this._minElapsedMS) {
      return Math.round(1e3 / this._minElapsedMS);
    }
    return 0;
  }
  set maxFPS(fps) {
    if (fps === 0) {
      this._minElapsedMS = 0;
    } else {
      const maxFPS = Math.max(this.minFPS, fps);
      this._minElapsedMS = 1 / (maxFPS / 1e3);
    }
  }
  static get shared() {
    if (!_Ticker._shared) {
      const shared = _Ticker._shared = new _Ticker();
      shared.autoStart = true;
      shared._protected = true;
    }
    return _Ticker._shared;
  }
  static get system() {
    if (!_Ticker._system) {
      const system = _Ticker._system = new _Ticker();
      system.autoStart = true;
      system._protected = true;
    }
    return _Ticker._system;
  }
};
var Ticker = _Ticker;
Ticker.targetFPMS = 0.06;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Ticker,
  UPDATE_PRIORITY
});
