/**
 * InputSystem — keyboard and mouse input for the local player.
 *
 * Pointer Lock API:
 *   The canvas must be clicked by the user to capture the mouse.
 *   While locked, mousemove deltas are used to update yaw/pitch.
 *   ESC automatically releases the lock (browser default).
 *
 * Key codes used:
 *   W / ArrowUp    — forward  (dz = +1)
 *   S / ArrowDown  — backward (dz = −1)
 *   A / ArrowLeft  — strafe left  (dx = −1)
 *   D / ArrowRight — strafe right (dx = +1)
 *   ShiftLeft / ShiftRight — sprint
 */
export class InputSystem {
  constructor() {
    this._keys = {};

    /** Horizontal camera/player rotation (radians). Decreases on mouse-right. */
    this.yaw   = 0;
    /** Vertical camera tilt (radians). Clamped to avoid flipping. */
    this.pitch = 0;

    this._locked      = false;
    this._sensitivity = 0.002;
    this._pitchMin    = -Math.PI / 5;   // ~−36° (look up limit)
    this._pitchMax    =  Math.PI / 4;   // ~ 45° (look down limit)

    this._canvas = null;

    // Bind once so we can remove them later
    this._onKeyDown       = this._onKeyDown.bind(this);
    this._onKeyUp         = this._onKeyUp.bind(this);
    this._onMouseMove     = this._onMouseMove.bind(this);
    this._onLockChange    = this._onLockChange.bind(this);
    this._onCanvasClick   = this._onCanvasClick.bind(this);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /** Attach to the game canvas and begin listening. */
  init(canvas) {
    this._canvas = canvas;
    document.addEventListener('keydown',            this._onKeyDown,    { passive: true });
    document.addEventListener('keyup',              this._onKeyUp,      { passive: true });
    document.addEventListener('mousemove',          this._onMouseMove,  { passive: true });
    document.addEventListener('pointerlockchange',  this._onLockChange);
    canvas.addEventListener('click',                this._onCanvasClick);
  }

  /** Remove all listeners (call on component unmount). */
  dispose() {
    document.removeEventListener('keydown',           this._onKeyDown);
    document.removeEventListener('keyup',             this._onKeyUp);
    document.removeEventListener('mousemove',         this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    this._canvas?.removeEventListener('click',        this._onCanvasClick);
    this._canvas = null;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  get isLocked() { return this._locked; }

  /**
   * Sample the current input state.
   * Returns a snapshot — safe to call multiple times per frame.
   *
   * @returns {{ dx: number, dz: number, sprint: boolean, yaw: number, pitch: number }}
   */
  getInput() {
    const right   = this._keys['KeyD']      || this._keys['ArrowRight'] ? 1 : 0;
    const left    = this._keys['KeyA']      || this._keys['ArrowLeft']  ? 1 : 0;
    const forward = this._keys['KeyW']      || this._keys['ArrowUp']    ? 1 : 0;
    const back    = this._keys['KeyS']      || this._keys['ArrowDown']  ? 1 : 0;
    const sprint  = this._keys['ShiftLeft'] || this._keys['ShiftRight'] ? true : false;

    return {
      dx:     right - left,
      dz:     forward - back,
      sprint,
      yaw:    this.yaw,
      pitch:  this.pitch,
    };
  }

  // ─── Private handlers ────────────────────────────────────────────────────────

  _onKeyDown(e) {
    this._keys[e.code] = true;
    // Prevent browser scrolling on game keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this._keys[e.code] = false;
  }

  _onMouseMove(e) {
    if (!this._locked) return;
    // Mouse right → yaw decreases (clockwise rotation from above = turning right)
    this.yaw   -= e.movementX * this._sensitivity;
    this.pitch -= e.movementY * this._sensitivity;
    this.pitch  = Math.max(this._pitchMin, Math.min(this._pitchMax, this.pitch));
  }

  _onLockChange() {
    this._locked = document.pointerLockElement === this._canvas;
  }

  _onCanvasClick() {
    if (!this._locked) {
      this._canvas?.requestPointerLock();
    }
  }
}
