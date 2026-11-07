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

  /**
   * Triumphant Brass Fanfare Chords in D-Major for 50ft Holy Grail
   */
  playHolyGrailFanfare() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Master Fanfare Gain & Limiter
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.85, now + 0.05);
      masterGain.gain.setValueAtTime(0.85, now + 2.4);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);
      masterGain.connect(ctx.destination);

      // Warm Brass Lowpass Filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(4200, now + 0.1);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 2.0);
      filter.Q.setValueAtTime(2.5, now);
      filter.connect(masterGain);

      // 4-Chord Fanfare Sequence in D Major
      const chords = [
        { time: 0.00, dur: 0.28, notes: [293.66, 369.99, 440.00, 587.33] },
        { time: 0.32, dur: 0.28, notes: [392.00, 493.88, 587.33, 783.99] },
        { time: 0.64, dur: 0.35, notes: [440.00, 554.37, 659.25, 880.00] },
        { time: 1.05, dur: 2.10, notes: [293.66, 440.00, 587.33, 739.99, 880.00, 1174.66] }
      ];

      chords.forEach(({ time, dur, notes }) => {
        const chordStart = now + time;
        notes.forEach((freq, idx) => {
          [-4, 4].forEach((detuneCents) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, chordStart);
            osc.detune.setValueAtTime(detuneCents, chordStart);

            const noteGain = ctx.createGain();
            const amp = idx === notes.length - 1 ? 0.35 : 0.22;
            noteGain.gain.setValueAtTime(0.001, chordStart);
            noteGain.gain.exponentialRampToValueAtTime(amp, chordStart + 0.03);
            noteGain.gain.setValueAtTime(amp * 0.8, chordStart + dur * 0.6);
            noteGain.gain.exponentialRampToValueAtTime(0.001, chordStart + dur);

            osc.connect(noteGain);
            noteGain.connect(filter);

            osc.start(chordStart);
            osc.stop(chordStart + dur);
          });
        });
      });

      // Chain Peter Pan Rooster Crow right after fanfare peak
      setTimeout(() => {
        this.playPeterPanRoosterCrow();
      }, 1200);

    } catch (e) {
      console.warn('[Audio] Holy Grail fanfare failed silently:', e);
    }
  }

  /**
   * Peter Pan Rooster Crow ("Cock-a-doodle-doo!" synthesis)
   */
  playPeterPanRoosterCrow() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const crowGain = ctx.createGain();
      crowGain.gain.setValueAtTime(0.001, now);
      crowGain.gain.exponentialRampToValueAtTime(0.75, now + 0.05);
      crowGain.gain.setValueAtTime(0.75, now + 1.2);
      crowGain.gain.exponentialRampToValueAtTime(0.001, now + 1.55);
      crowGain.connect(ctx.destination);

      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(1350, now);
      f1.Q.setValueAtTime(4.2, now);

      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.setValueAtTime(2850, now);
      f2.Q.setValueAtTime(5.8, now);

      f1.connect(crowGain);
      f2.connect(crowGain);

      // Syllables: "Cock" -> "a" -> "doodle" -> "Doooo!"
      const syllables = [
        { start: 0.00, dur: 0.14, f0: 440, f1: 587 },
        { start: 0.16, dur: 0.08, f0: 494, f1: 494 },
        { start: 0.26, dur: 0.28, f0: 659, f1: 784, vibrato: true },
        { start: 0.58, dur: 0.95, f0: 880, f1: 1175, fEnd: 1046, vibrato: true, peak: true }
      ];

      syllables.forEach((s) => {
        const sylStart = now + s.start;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';

        osc.frequency.setValueAtTime(s.f0, sylStart);
        if (s.fEnd) {
          osc.frequency.exponentialRampToValueAtTime(s.f1, sylStart + s.dur * 0.4);
          osc.frequency.exponentialRampToValueAtTime(s.fEnd, sylStart + s.dur);
        } else {
          osc.frequency.linearRampToValueAtTime(s.f1, sylStart + s.dur);
        }

        if (s.vibrato) {
          const lfo = ctx.createOscillator();
          lfo.frequency.setValueAtTime(s.peak ? 7.2 : 14.0, sylStart);
          const lfoGain = ctx.createGain();
          lfoGain.gain.setValueAtTime(s.peak ? 18.0 : 12.0, sylStart);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfo.start(sylStart);
          lfo.stop(sylStart + s.dur);
        }

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.001, sylStart);
        env.gain.exponentialRampToValueAtTime(s.peak ? 0.9 : 0.6, sylStart + 0.02);
        env.gain.setValueAtTime(s.peak ? 0.75 : 0.45, sylStart + s.dur * 0.7);
        env.gain.exponentialRampToValueAtTime(0.001, sylStart + s.dur);

        osc.connect(env);
        env.connect(f1);
        env.connect(f2);

        osc.start(sylStart);
        osc.stop(sylStart + s.dur);
      });
    } catch (e) {
      console.warn('[Audio] Rooster crow failed silently:', e);
    }
  }

  /**
   * Tier 1 Shallow Rejection Buzzer (<10ft)
   */
  playRejectionBuzzer() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [110.0, 116.54].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.35);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(450, now);

        osc.connect(filt);
        filt.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.38);
      });
    } catch (e) {}
  }

  /**
   * Tier 3 Hazard Alarm Siren (>50ft Boundary)
   */
  playHazardSiren() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(2.5, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(225, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.frequency.setValueAtTime(875, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.4, now + 0.08);
      gain.gain.setValueAtTime(0.4, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      lfo.start(now);
      lfo.stop(now + 1.1);
      osc.start(now);
      osc.stop(now + 1.1);
    } catch (e) {}
  }

  /**
   * Geothermal Geyser Launch Sound
   */
  playGeyserSound() {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.4);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    } catch (e) {}
  }
}
