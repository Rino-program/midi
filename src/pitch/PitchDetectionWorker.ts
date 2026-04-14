// Web Worker for pitch detection
// Supports: YIN (built-in), with stubs for essentia.js and Crepe

export type DetectionMode = 'essentia' | 'crepe' | 'yin';

export interface PitchResult {
  pitchHz: number;
  confidence: number;
  midiNote: number;
  timeOffset: number;
}

export interface WorkerMessage {
  type: 'detect' | 'configure';
  payload: unknown;
}

export interface WorkerResponse {
  type: 'result' | 'error' | 'ready';
  payload: unknown;
}

// YIN pitch detection algorithm (optimized for MIDI note range)
function yinPitch(
  buffer: Float32Array,
  sampleRate: number,
  threshold = 0.15,
  minFrequencyHz = 27.5,
  maxFrequencyHz = 4186.01
): { frequency: number; confidence: number } {
  const bufferSize = buffer.length;
  const halfSize = Math.floor(bufferSize / 2);

  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequencyHz));
  const maxTau = Math.min(halfSize - 1, Math.floor(sampleRate / minFrequencyHz));

  if (maxTau <= minTau) {
    return { frequency: 0, confidence: 0 };
  }

  const yinBuffer = new Float32Array(maxTau + 1);
  const compareLength = bufferSize - maxTau;

  // Step 1: Difference function (restricted tau range for valid MIDI pitches)
  for (let tau = minTau; tau <= maxTau; tau++) {
    let sum = 0;
    for (let j = 0; j < compareLength; j++) {
      const delta = buffer[j] - buffer[j + tau];
      sum += delta * delta;
    }
    yinBuffer[tau] = sum;
  }

  // Step 2: Cumulative mean normalized difference
  let runningSum = 0;
  for (let tau = minTau; tau <= maxTau; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = runningSum > 0 ? (yinBuffer[tau] * tau) / runningSum : 1;
  }

  // Step 3: Absolute threshold
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (yinBuffer[tau] < threshold) {
      let bestTau = tau;
      while (bestTau + 1 <= maxTau && yinBuffer[bestTau + 1] < yinBuffer[bestTau]) {
        bestTau++;
      }

      const frequency = sampleRate / bestTau;
      const confidence = 1 - yinBuffer[bestTau];
      return { frequency, confidence };
    }
  }

  return { frequency: 0, confidence: 0 };
}

function hzToMidi(hz: number): number {
  if (hz <= 0) return 0;
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

let mode: DetectionMode = 'yin';
let sampleRate = 44100;

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === 'configure') {
    const cfg = payload as { mode?: DetectionMode; sampleRate?: number };
    mode = cfg.mode ?? 'yin';
    sampleRate = cfg.sampleRate ?? 44100;
    const response: WorkerResponse = { type: 'ready', payload: { mode, sampleRate } };
    self.postMessage(response);
    return;
  }

  if (type === 'detect') {
    const { pcm, timeOffset } = payload as { pcm: ArrayBuffer; timeOffset: number };
    const buffer = new Float32Array(pcm);

    try {
      let pitchHz = 0;
      let confidence = 0;

      const result = yinPitch(buffer, sampleRate);
      pitchHz = result.frequency;
      confidence = result.confidence;

      const midiNote = hzToMidi(pitchHz);

      const response: WorkerResponse = {
        type: 'result',
        payload: {
          pitchHz,
          confidence,
          midiNote: midiNote >= 21 && midiNote <= 108 ? midiNote : 0,
          timeOffset,
        } as PitchResult,
      };
      self.postMessage(response);
    } catch (err) {
      const response: WorkerResponse = {
        type: 'error',
        payload: { message: (err as Error).message },
      };
      self.postMessage(response);
    }
  }
};

export {};
