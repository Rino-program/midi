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

// YIN pitch detection algorithm (simplified)
function yinPitch(buffer: Float32Array, sampleRate: number, threshold = 0.15): { frequency: number; confidence: number } {
  const bufferSize = buffer.length;
  const halfSize = Math.floor(bufferSize / 2);
  const yinBuffer = new Float32Array(halfSize);

  // Step 1: Difference function
  for (let tau = 0; tau < halfSize; tau++) {
    yinBuffer[tau] = 0;
    for (let j = 0; j < halfSize; j++) {
      const delta = buffer[j] - buffer[j + tau];
      yinBuffer[tau] += delta * delta;
    }
  }

  // Step 2: Cumulative mean normalized difference
  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfSize; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] *= tau / runningSum;
  }

  // Step 3: Absolute threshold
  let tau = 2;
  while (tau < halfSize) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 < halfSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      const frequency = sampleRate / tau;
      const confidence = 1 - yinBuffer[tau];
      return { frequency, confidence };
    }
    tau++;
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
