// Web Worker for onset detection using HFC (High Frequency Content)
export interface OnsetResult {
  onsets: number[]; // sample indices
  timeOffset: number;
}

export interface WorkerMessage {
  type: 'detect' | 'configure';
  payload: unknown;
}

function hfcOnsetDetection(
  buffer: Float32Array,
  _sampleRate: number,
  hopSize: number,
  threshold: number
): number[] {
  const onsets: number[] = [];
  const frameSize = hopSize * 2;

  let prevHFC = 0;

  for (let i = 0; i + frameSize <= buffer.length; i += hopSize) {
    const frame = buffer.slice(i, i + frameSize);

    let hfc = 0;
    for (let j = 0; j < frame.length; j++) {
      hfc += Math.abs(frame[j]) * (j + 1);
    }
    hfc /= frame.length;

    const delta = hfc - prevHFC;
    if (delta > threshold && prevHFC > 0) {
      onsets.push(i);
    }
    prevHFC = hfc;
  }

  return onsets;
}

let sampleRate = 44100;
let hopSize = 512;
let threshold = 0.01;

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === 'configure') {
    const cfg = payload as { sampleRate?: number; hopSize?: number; threshold?: number };
    sampleRate = cfg.sampleRate ?? 44100;
    hopSize = cfg.hopSize ?? 512;
    threshold = cfg.threshold ?? 0.01;
    self.postMessage({ type: 'ready', payload: {} });
    return;
  }

  if (type === 'detect') {
    const { pcm, timeOffset } = payload as { pcm: ArrayBuffer; timeOffset: number };
    const buffer = new Float32Array(pcm);

    const onsets = hfcOnsetDetection(buffer, sampleRate, hopSize, threshold);

    self.postMessage({
      type: 'result',
      payload: { onsets, timeOffset } as OnsetResult,
    });
  }
};

export {};
