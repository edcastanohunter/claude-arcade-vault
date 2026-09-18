import type { SfxEvent } from "../types";

const MUTE_KEY = "av_muted";

// Preferencia como store externo (para useSyncExternalStore). Si localStorage
// no está disponible, la preferencia vive solo en memoria durante la sesión.
let memMuted = false;
const listeners = new Set<() => void>();

export function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return memMuted;
  }
}

export function writeMuted(muted: boolean) {
  memMuted = muted;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // sin almacenamiento: queda en memoria
  }
  listeners.forEach((l) => l());
}

export function subscribeMuted(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface AudioEngine {
  play(e: SfxEvent): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}

type AudioCtor = typeof AudioContext;

/**
 * Efectos sintetizados con Web Audio (sin archivos). El AudioContext se crea
 * en el primer gesto del usuario (tecla o click); antes de eso no existe, y si
 * el navegador no soporta Web Audio el juego simplemente queda en silencio.
 */
export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let muted = false;

  function unlock() {
    try {
      if (!ctx) {
        const Ctor: AudioCtor | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: AudioCtor })
            .webkitAudioContext;
        if (!Ctor) return;
        ctx = new Ctor();
      }
      if (ctx.state === "suspended") void ctx.resume();
    } catch {
      ctx = null;
    }
  }

  window.addEventListener("keydown", unlock);
  window.addEventListener("pointerdown", unlock);

  function tone(
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    vol: number,
    delay = 0,
  ) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  function noise(dur: number, cutoff: number, vol: number) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(cutoff / 4, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  return {
    play(e) {
      if (muted || !ctx || ctx.state !== "running") return;
      switch (e) {
        case "shoot":
          tone("square", 880, 220, 0.12, 0.06);
          break;
        case "explode-large":
          noise(0.55, 900, 0.35);
          break;
        case "explode-medium":
          noise(0.35, 1400, 0.28);
          break;
        case "explode-small":
          noise(0.2, 2200, 0.22);
          break;
        case "powerup":
          tone("triangle", 440, 660, 0.12, 0.12);
          tone("triangle", 660, 990, 0.16, 0.12, 0.1);
          break;
        case "ship-death":
          noise(0.9, 1000, 0.4);
          tone("sawtooth", 220, 40, 0.8, 0.1);
          break;
      }
    },
    setMuted(m) {
      muted = m;
    },
    destroy() {
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerdown", unlock);
      void ctx?.close();
      ctx = null;
    },
  };
}
