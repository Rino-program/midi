export interface VideoSyncOptions {
  videoElement: HTMLVideoElement;
  onTimeUpdate?: (currentTime: number) => void;
  playbackRate?: number;
}

export class VideoSyncController {
  private video: HTMLVideoElement;
  private animationFrame: number | null = null;
  private onTimeUpdate?: (currentTime: number) => void;

  constructor(options: VideoSyncOptions) {
    this.video = options.videoElement;
    this.onTimeUpdate = options.onTimeUpdate;
    if (options.playbackRate) {
      this.video.playbackRate = options.playbackRate;
    }
  }

  seekTo(timeSeconds: number): void {
    this.video.currentTime = timeSeconds;
  }

  play(): void {
    this.video.play();
    this.startTimeTracking();
  }

  pause(): void {
    this.video.pause();
    this.stopTimeTracking();
  }

  setPlaybackRate(rate: number): void {
    this.video.playbackRate = rate;
  }

  private startTimeTracking(): void {
    const update = () => {
      this.onTimeUpdate?.(this.video.currentTime);
      this.animationFrame = requestAnimationFrame(update);
    };
    this.animationFrame = requestAnimationFrame(update);
  }

  private stopTimeTracking(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  destroy(): void {
    this.stopTimeTracking();
  }

  get currentTime(): number {
    return this.video.currentTime;
  }

  get duration(): number {
    return this.video.duration;
  }
}
