export interface DecodeProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface DecodedChunk {
  pcm: Float32Array;
  sampleRate: number;
  startSample: number;
  endSample: number;
  timeOffset: number; // seconds
}

export class FileDecodeEngine {
  private audioContext: AudioContext;
  private chunkDurationSec: number;

  constructor(sampleRate = 44100, chunkDurationSec = 5) {
    this.audioContext = new AudioContext({ sampleRate });
    this.chunkDurationSec = chunkDurationSec;
  }

  async decode(
    file: File,
    onProgress?: (progress: DecodeProgress) => void
  ): Promise<DecodedChunk[]> {
    onProgress?.({ loaded: 0, total: 100, percentage: 0 });

    const arrayBuffer = await this.readFile(file, onProgress);

    onProgress?.({ loaded: 50, total: 100, percentage: 50 });

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    onProgress?.({ loaded: 80, total: 100, percentage: 80 });

    const chunks = this.splitIntoChunks(audioBuffer);

    onProgress?.({ loaded: 100, total: 100, percentage: 100 });

    return chunks;
  }

  private readFile(
    file: File,
    onProgress?: (progress: DecodeProgress) => void
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = (event.loaded / event.total) * 40;
          onProgress?.({ loaded: event.loaded, total: event.total, percentage: pct });
        }
      };

      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsArrayBuffer(file);
    });
  }

  private splitIntoChunks(audioBuffer: AudioBuffer): DecodedChunk[] {
    const sampleRate = audioBuffer.sampleRate;
    const totalSamples = audioBuffer.length;
    const chunkSamples = Math.floor(this.chunkDurationSec * sampleRate);
    const chunks: DecodedChunk[] = [];

    const monoData = this.toMono(audioBuffer);

    let offset = 0;
    while (offset < totalSamples) {
      const end = Math.min(offset + chunkSamples, totalSamples);
      const pcm = monoData.slice(offset, end);
      chunks.push({
        pcm,
        sampleRate,
        startSample: offset,
        endSample: end,
        timeOffset: offset / sampleRate,
      });
      offset = end;
    }

    return chunks;
  }

  private toMono(audioBuffer: AudioBuffer): Float32Array {
    if (audioBuffer.numberOfChannels === 1) {
      return audioBuffer.getChannelData(0).slice();
    }

    const length = audioBuffer.length;
    const mono = new Float32Array(length);
    const numChannels = audioBuffer.numberOfChannels;

    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / numChannels;
      }
    }

    return mono;
  }

  async close(): Promise<void> {
    await this.audioContext.close();
  }
}
