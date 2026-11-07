/**
 * src/core/input.js
 * Modular Keyboard and Mouse Input Management for Kevin Tighe: Lakeside Retreat 3D
 */

export class InputManager {
  constructor(options = {}) {
    this.domElement = options.domElement || (typeof window !== 'undefined' ? window : null);
    
    // Core action keys dictionary matching game controller contract
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false
    };

    // Raw key set and event callbacks
    this.pressedKeys = new Set();
    this.callbacks = new Map();

    // Mouse tracking state
    this.mousePosition = { x: 0, y: 0 };
    this.mouseDelta = { x: 0, y: 0 };
    this.isMouseDown = false;
    this.isPointerLocked = false;

    // Bound handlers for clean disposal
    this._onKeyDown = this.handleKeyDown.bind(this);
    this._onKeyUp = this.handleKeyUp.bind(this);
    this._onMouseMove = this.handleMouseMove.bind(this);
    this._onMouseDown = this.handleMouseDown.bind(this);
    this._onMouseUp = this.handleMouseUp.bind(this);

    this.attach();
  }

  attach() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  detach() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
  }

  handleKeyDown(e) {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    const code = e.code;
    this.pressedKeys.add(code);

    if (code === 'KeyW' || code === 'ArrowUp') this.keys.forward = true;
    if (code === 'KeyS' || code === 'ArrowDown') this.keys.backward = true;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = true;
    if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = true;
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.sprint = true;

    if (code === 'Space') {
      e.preventDefault();
      if (!this.keys.jump) {
        this.keys.jump = true;
        this.emit('jump', e);
      }
    }

    if (code === 'KeyH' || code === 'KeyE') {
      e.preventDefault();
      this.emit('sonar', e);
    }

    if (code === 'KeyF') {
      e.preventDefault();
      this.emit('flight', e);
    }

    this.emit('keydown', e);
  }

  handleKeyUp(e) {
    const code = e.code;
    this.pressedKeys.delete(code);

    if (code === 'KeyW' || code === 'ArrowUp') this.keys.forward = false;
    if (code === 'KeyS' || code === 'ArrowDown') this.keys.backward = false;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = false;
    if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = false;
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.sprint = false;

    if (code === 'Space') {
      this.keys.jump = false;
      this.emit('jumpRelease', e);
    }

    this.emit('keyup', e);
  }

  handleMouseMove(e) {
    this.mouseDelta.x = e.movementX || (e.clientX - this.mousePosition.x);
    this.mouseDelta.y = e.movementY || (e.clientY - this.mousePosition.y);
    this.mousePosition.x = e.clientX;
    this.mousePosition.y = e.clientY;
    this.emit('mousemove', e);
  }

  handleMouseDown(e) {
    this.isMouseDown = true;
    this.emit('mousedown', e);
  }

  handleMouseUp(e) {
    this.isMouseDown = false;
    this.emit('mouseup', e);
  }

  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.callbacks.has(event)) return;
    const list = this.callbacks.get(event).filter(fn => fn !== callback);
    this.callbacks.set(event, list);
  }

  emit(event, data) {
    if (!this.callbacks.has(event)) return;
    const list = this.callbacks.get(event);
    for (const fn of list) {
      try {
        fn(data);
      } catch (err) {
        console.error('[InputManager error]', err);
      }
    }
  }

  isPressed(codeOrAction) {
    if (this.keys.hasOwnProperty(codeOrAction)) {
      return this.keys[codeOrAction];
    }
    return this.pressedKeys.has(codeOrAction);
  }

  reset() {
    this.pressedKeys.clear();
    for (const key in this.keys) {
      this.keys[key] = false;
    }
    this.mouseDelta = { x: 0, y: 0 };
    this.isMouseDown = false;
  }

  dispose() {
    this.detach();
    this.callbacks.clear();
    this.reset();
  }
}
