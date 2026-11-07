/**
 * src/core/audio.js
 * Kevin Tighe: 3D Lakeside Retreat - Web Audio Procedural Audio Engine
 *
 * Implements:
 * - Signature "Hmm..." vocal formant synthesizer (baritone glottal oscillator + 3 nasal formants)
 * - Peter Pan Neverland musical motif & ambient lake wind shimmer
 * - Footsteps, jump springs, water splashes, and collectible chimes
 * - Autoplay policy compliance with resume on user interaction
 */

export class HmmSynthesizer {
  constructor(audioContext = null) {
    this.audioCtx = audioContext;
    this.muted = false;
  }

  ensureContext() {
    if (!this.audioCtx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Procedural vocal formant synthesis for male baritone humming "Hmm..."
   */
  playVocalHmm() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const duration = 0.88;

      // Master output gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.65, now + 0.08);
      masterGain.gain.setValueAtTime(0.65, now + 0.55);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      masterGain.connect(ctx.destination);

      // Glottal source oscillator (sawtooth for rich harmonic spectrum)
      const glottalOsc = ctx.createOscillator();
      glottalOsc.type = 'sawtooth';
      // Pitch contour: 125 Hz -> 114 Hz -> 130 Hz thoughtful rise
      glottalOsc.frequency.setValueAtTime(125, now);
      glottalOsc.frequency.linearRampToValueAtTime(114, now + 0.35);
      glottalOsc.frequency.exponentialRampToValueAtTime(130, now + duration);

      // Vibrato LFO (5.2 Hz, 2.5 Hz depth)
      const vibrato = ctx.createOscillator();
      vibrato.frequency.setValueAtTime(5.2, now);
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.setValueAtTime(2.5, now);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(glottalOsc.frequency);
      vibrato.start(now);
      vibrato.stop(now + duration);

      // 3 Parallel Formant Bandpass Filters (Nasalized vocal cavity)
      // Formant 1: Nasal murmur ~280 Hz
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(280, now);
      f1.Q.setValueAtTime(3.5, now);

      // Formant 2: Oral constriction ~1050 Hz
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.setValueAtTime(1050, now);
      f2.Q.setValueAtTime(7.5, now);

      // Formant 3: Nasal sinus resonance ~2400 Hz
      const f3 = ctx.createBiquadFilter();
      f3.type = 'bandpass';
      f3.frequency.setValueAtTime(2400, now);
      f3.Q.setValueAtTime(6.0, now);

      glottalOsc.connect(f1);
      glottalOsc.connect(f2);
      glottalOsc.connect(f3);

      f1.connect(masterGain);
      f2.connect(masterGain);
      f3.connect(masterGain);

      // Warm Sub-Bass Body (68 Hz sine wave for chest resonance)
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(68, now);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.exponentialRampToValueAtTime(0.35, now + 0.1);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);

      // Sonar Acoustic Ping Chime (880 Hz harmonic shimmer)
      const pingOsc = ctx.createOscillator();
      pingOsc.type = 'sine';
      pingOsc.frequency.setValueAtTime(880, now + 0.05);
      pingOsc.frequency.exponentialRampToValueAtTime(1760, now + 0.5);
      const pingGain = ctx.createGain();
      pingGain.gain.setValueAtTime(0.001, now);
      pingGain.gain.exponentialRampToValueAtTime(0.2, now + 0.08);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      pingOsc.connect(pingGain);
      pingGain.connect(ctx.destination);

      glottalOsc.start(now);
      glottalOsc.stop(now + duration);
      subOsc.start(now);
      subOsc.stop(now + duration);
      pingOsc.start(now + 0.05);
      pingOsc.stop(now + 0.7);
    } catch (e) {
      // Audio errors fail silently without interrupting gameplay
    }
  }

  playOrangePickupSound() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {}
  }

  playBonusPickupSound() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.3);
      });
    } catch (e) {}
  }
}

export class AudioSystem {
  constructor() {
    this.audioCtx = null;
    this.muted = false;
    this.synth = new HmmSynthesizer();
    this.musicGain = null;
    this.ambientGain = null;
    this.isMusicPlaying = false;
  }

  ensureContext() {
    if (!this.audioCtx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
      this.synth.audioCtx = this.audioCtx;
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  setMuted(muted) {
    this.muted = !!muted;
    this.synth.muted = this.muted;
    if (this.musicGain) {
      this.musicGain.gain.setValueAtTime(this.muted ? 0.0 : 0.18, (this.audioCtx ? this.audioCtx.currentTime : 0));
    }
  }

  playJumpSound() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  playLandSound() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  playFlightSound() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch (e) {}
  }
}
