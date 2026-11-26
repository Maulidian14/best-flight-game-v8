// Synthesised sound for Skyhook Courier: no audio files, everything is
// WebAudio oscillators and filtered noise, built on the first user gesture.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.started = false;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.buildEngine();
    this.buildWind();
    this.started = true;
  }

  buildEngine() {
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 2;
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 58;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 87;
    const g2 = ctx.createGain();
    g2.gain.value = 0.4;
    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(g2);
    g2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  buildWind() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = buf;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 700;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(ctx.destination);
    this.windSource.start();
  }

  // Called every frame while flying: throttle 0..1, speed m/s.
  update(throttle, speed, airborne) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const rpm = 0.45 + throttle * 0.85 + (speed / 118) * 0.25;
    this.engineOsc1.frequency.setTargetAtTime(58 * rpm, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(87 * rpm, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.075 : 0.035, t, 0.1);
    const wind = Math.max(0, (speed - 30) / 90);
    this.windGain.gain.setTargetAtTime(wind * 0.11, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.15);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, t, 0.05);
    if (this.windGain) this.windGain.gain.setTargetAtTime(0, t, 0.05);
  }

  blip(freq = 660, dur = 0.07, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  ringChime() {
    this.blip(880, 0.16, 'sine', 0.16);
    setTimeout(() => this.blip(1318, 0.22, 'sine', 0.14), 70);
  }

  landThud() {
    this.blip(90, 0.25, 'sine', 0.3);
    setTimeout(() => this.blip(180, 0.12, 'triangle', 0.12), 90);
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start();
    this.blip(55, 0.5, 'sine', 0.35);
  }

  warning() {
    this.blip(440, 0.1, 'square', 0.07);
    setTimeout(() => this.blip(440, 0.1, 'square', 0.07), 140);
  }
}
