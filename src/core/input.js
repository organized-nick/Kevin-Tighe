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
      sprint: false,
      camLeft: false,
      camRight: false,
      descend: false
    };

    // Raw key set and event callbacks
    this.pressedKeys = new Set();
    this.callbacks = new Map();

    // Mouse tracking state
    this.mousePosition = { x: 0, y: 0 };
    this.mouseDelta = { x: 0, y: 0 };
    this.isMouseDown = false;
    this.isPointerLocked = false;
    this.enabled = true;

    // Bound handlers for clean disposal
    this._onKeyDown = this.handleKeyDown.bind(this);
    this._onKeyUp = this.handleKeyUp.bind(this);
    this._onMouseMove = this.handleMouseMove.bind(this);
    this._onMouseDown = this.handleMouseDown.bind(this);
    this._onMouseUp = this.handleMouseUp.bind(this);
    this._onBlur = this.reset.bind(this);

    this.attach();
  }

  attach() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }

  handleKeyDown(e) {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (!this.enabled) return;

    const code = e.code;
    this.pressedKeys.add(code);

    if (code === 'KeyW' || code === 'ArrowUp') {
      if (code === 'ArrowUp') e.preventDefault();
      this.keys.forward = true;
    }
    if (code === 'KeyS' || code === 'ArrowDown') {
      if (code === 'ArrowDown') e.preventDefault();
      this.keys.backward = true;
    }
    if (code === 'KeyA' || code === 'ArrowLeft') {
      if (code === 'ArrowLeft') e.preventDefault();
      this.keys.left = true;
    }
    if (code === 'KeyD' || code === 'ArrowRight') {
      if (code === 'ArrowRight') e.preventDefault();
      this.keys.right = true;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.keys.sprint = true;
    }
    if (code === 'KeyQ' || code === 'BracketLeft') {
      this.keys.camLeft = true;
    }
    if (code === 'KeyE' || code === 'BracketRight') {
      this.keys.camRight = true;
    }
    if (code === 'KeyC' || code === 'ControlLeft' || code === 'ControlRight') {
      this.keys.descend = true;
    }

    if (code === 'Space') {
      e.preventDefault();
      if (!this.keys.jump) {
        this.keys.jump = true;
        this.emit('jump', e);
      }
    }

    if (code === 'KeyH' || code === 'KeyR') {
      e.preventDefault();
      this.emit('sonar', e);
    }

    if (code === 'KeyF') {
      e.preventDefault();
      this.emit('flight', e);
    }

    if (code === 'KeyM') {
      e.preventDefault();
      this.emit('mute', e);
    }

    if (code === 'KeyL') {
      e.preventDefault();
      this.emit('pointerLock', e);
    }

    this.emit('keydown', e);
  }

  handleKeyUp(e) {
    const code = e.code;
    this.pressedKeys.delete(code);

    if (code === 'KeyW' || code === 'ArrowUp') {
      this.keys.forward = this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp');
    }
    if (code === 'KeyS' || code === 'ArrowDown') {
      this.keys.backward = this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown');
    }
    if (code === 'KeyA' || code === 'ArrowLeft') {
      this.keys.left = this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft');
    }
    if (code === 'KeyD' || code === 'ArrowRight') {
      this.keys.right = this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight');
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.keys.sprint = this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight');
    }
    if (code === 'KeyQ' || code === 'BracketLeft') {
      this.keys.camLeft = this.pressedKeys.has('KeyQ') || this.pressedKeys.has('BracketLeft');
    }
    if (code === 'KeyE' || code === 'BracketRight') {
      this.keys.camRight = this.pressedKeys.has('KeyE') || this.pressedKeys.has('BracketRight');
    }
    if (code === 'KeyC' || code === 'ControlLeft' || code === 'ControlRight') {
      this.keys.descend = this.pressedKeys.has('KeyC') || this.pressedKeys.has('ControlLeft') || this.pressedKeys.has('ControlRight');
    }

    if (code === 'Space') {
      this.keys.jump = false;
      this.emit('jumpRelease', e);
    }

    this.emit('keyup', e);
  }

  handleMouseMove(e) {
    this.mouseDelta.x = e.movementX !== undefined ? e.movementX : (e.clientX - this.mousePosition.x);
    this.mouseDelta.y = e.movementY !== undefined ? e.movementY : (e.clientY - this.mousePosition.y);
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
    if (Object.prototype.hasOwnProperty.call(this.keys, codeOrAction)) {
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
