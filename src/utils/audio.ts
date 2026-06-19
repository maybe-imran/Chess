// High-fidelity web audio synthesize utilities for classical Chess game sounds
// Uses browser-native AudioContext to generate immediate, zero-latency sounds.

let audioCtx: AudioContext | null = null;

// Get or lazily create AudioContext on first user interaction
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  // If suspended, attempt to resume (browsers autoplay policy)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Persist user's audio preference
const MUTE_STORAGE_KEY = 'chess_sound_muted';
let isMuted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';

export function setMuteState(muted: boolean): void {
  isMuted = muted;
  localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
}

export function getMuteState(): boolean {
  return isMuted;
}

/**
 * Standard sound effect synthesizer
 */
export function playChessSound(type: 'move' | 'capture' | 'castle' | 'check' | 'gameover') {
  if (isMuted) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  // Make sure we keep the context active
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;

  switch (type) {
    case 'move': {
      // Gentle wooden organic block tick (rapid decay sine/triangle wave)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.13);
      break;
    }

    case 'capture': {
      // Snappy double wooden clack (rapid successive pulses)
      [0, 0.05].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth'; // Slightly metallic/abrasive
        // Lowpass filter to muffle sawtooth edge and make it woody
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now + delay);

        osc.frequency.setValueAtTime(260, now + delay);
        osc.frequency.exponentialRampToValueAtTime(80, now + delay + 0.08);
        
        gain.gain.setValueAtTime(0.18, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + delay);
        osc.stop(now + delay + 0.09);
      });
      break;
    }

    case 'castle': {
      // Double fluid sliding plucks for rook and king
      [0, 0.08].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        // Alternate harmonic step
        const freq = idx === 0 ? 350 : 520;
        osc.frequency.setValueAtTime(freq, now + delay);
        osc.frequency.exponentialRampToValueAtTime(freq - 100, now + delay + 0.15);
        
        gain.gain.setValueAtTime(0.1, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + delay);
        osc.stop(now + delay + 0.16);
      });
      break;
    }

    case 'check': {
      // Alerting dual-tone ringing chime with high visibility
      const freqs = [587.33, 880]; // D5 and A5 elegant fifth interval
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        // Subtle alarm vibrato
        osc.frequency.linearRampToValueAtTime(freq + (idx === 0 ? 10 : -10), now + 0.25);
        
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.35);
      });
      break;
    }

    case 'gameover': {
      // Grand minor-to-major ascending resolution sweep
      const baseNotes = [220, 261.63, 329.63, 440]; // Am chord (A3, C4, E4, A4)
      baseNotes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startDelay = idx * 0.08;
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + startDelay);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + startDelay + 0.4);
        
        gain.gain.setValueAtTime(0.08, now + startDelay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startDelay + 0.45);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + startDelay);
        osc.stop(now + startDelay + 0.5);
      });
      break;
    }
  }
}
