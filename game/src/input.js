// Keyboard and mouse input for Skyhook Courier: one job, raw state only.
// The game reads this each frame; nothing here knows about missions.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered: cleared each frame by consume()
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false; // edge-triggered click
    this.anyGesture = false;
    this.attach();
  }

  attach() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
      this.anyGesture = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => this.keys.clear());
    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * this.canvas.width;
      this.mouseY = ((e.clientY - r.top) / r.height) * this.canvas.height;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.anyGesture = true;
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * this.canvas.width;
      this.mouseY = ((e.clientY - r.top) / r.height) * this.canvas.height;
    });
    window.addEventListener('mouseup', () => {
      if (this.mouseDown) this.clicked = true;
      this.mouseDown = false;
    });
  }

  down(key) {
    return this.keys.has(key.toLowerCase());
  }

  // True once, on the frame the key went down.
  hit(key) {
    return this.pressed.has(key.toLowerCase());
  }

  get pitchUp() {
    return this.down('arrowup');
  }
  get pitchDown() {
    return this.down('arrowdown');
  }
  get rollLeft() {
    return this.down('arrowleft');
  }
  get rollRight() {
    return this.down('arrowright');
  }
  get throttleUp() {
    return this.down('w') || this.down('shift');
  }
  get throttleDown() {
    return this.down('s') || this.down('control');
  }
  get brake() {
    return this.down(' ');
  }

  // Mouse steer: hold the mouse button and push left/right to bank.
  get mouseSteer() {
    if (!this.mouseDown) return 0;
    const cx = this.canvas.width / 2;
    return Math.max(-1, Math.min(1, (this.mouseX - cx) / (cx * 0.55)));
  }

  // Call at the end of each frame.
  consume() {
    this.pressed.clear();
    this.clicked = false;
  }
}
