export type InputSource = 'microphone' | 'tab' | 'audioFile' | 'videoFile';

export interface AudioInputConfig {
  source: InputSource;
  sampleRate?: number;
  bufferSize?: number;
  file?: File;
  videoElement?: HTMLVideoElement;
}

export class AudioInputManager {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private onAudioChunk?: (pcm: Float32Array, sampleRate: number) => void;

  async initialize(config: AudioInputConfig): Promise<void> {
    this.audioContext = new AudioContext({
      sampleRate: config.sampleRate ?? 44100,
      latencyHint: 'interactive',
    });

    switch (config.source) {
      case 'microphone':
        await this.initMicrophone();
        break;
      case 'tab':
        await this.initTabCapture();
        break;
      case 'audioFile':
        if (!config.file) throw new Error('File required for audioFile mode');
        await this.initAudioFile(config.file);
        break;
      case 'videoFile':
        if (!config.videoElement) throw new Error('Video element required for videoFile mode');
        this.initVideoFile(config.videoElement);
        break;
    }
  }

  private async initMicrophone(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    this.sourceNode = this.audioContext!.createMediaStreamSource(this.stream);
    await this.connectWorklet();
  }

  private async initTabCapture(): Promise<void> {
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: false,
    } as MediaStreamConstraints);
    this.sourceNode = this.audioContext!.createMediaStreamSource(this.stream);
    await this.connectWorklet();
  }

  private async initAudioFile(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    const sourceNode = this.audioContext!.createBufferSource();
    sourceNode.buffer = audioBuffer;
    this.sourceNode = sourceNode;
    await this.connectWorklet();
    sourceNode.start();
  }

  private initVideoFile(videoElement: HTMLVideoElement): void {
    const sourceNode = this.audioContext!.createMediaElementSource(videoElement);
    this.sourceNode = sourceNode;
    this.connectWorklet();
  }

  private async connectWorklet(): Promise<void> {
    if (!this.audioContext || !this.sourceNode) return;

    const bufferSize = 2048;
    const scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    scriptProcessor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const pcm = new Float32Array(inputData.length);
      pcm.set(inputData);
      this.onAudioChunk?.(pcm, this.audioContext!.sampleRate);
    };

    this.workletNode = scriptProcessor as unknown as AudioWorkletNode;
    this.sourceNode.connect(scriptProcessor);
    scriptProcessor.connect(this.audioContext.destination);
  }

  setOnAudioChunk(callback: (pcm: Float32Array, sampleRate: number) => void): void {
    this.onAudioChunk = callback;
  }

  async stop(): Promise<void> {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    await this.audioContext?.close();
    this.stream = null;
    this.workletNode = null;
    this.sourceNode = null;
    this.audioContext = null;
  }

  get context(): AudioContext | null {
    return this.audioContext;
  }
}
