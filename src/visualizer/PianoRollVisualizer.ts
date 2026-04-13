import type { MIDINote } from '../store/useStore';

export interface PianoRollOptions {
  canvas: HTMLCanvasElement;
  viewDurationSec?: number;
  pixelsPerSecond?: number;
  noteHeight?: number;
}

const NOTE_COLORS = {
  white: '#4ade80',
  black: '#22c55e',
  active: '#f59e0b',
};

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export class PianoRollVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private notes: MIDINote[] = [];
  private currentTime = 0;
  private animFrameId: number | null = null;
  private pixelsPerSecond: number;
  private noteHeight: number;
  private viewDurationSec: number;

  constructor(options: PianoRollOptions) {
    this.canvas = options.canvas;
    this.ctx = options.canvas.getContext('2d')!;
    this.pixelsPerSecond = options.pixelsPerSecond ?? 100;
    this.noteHeight = options.noteHeight ?? 8;
    this.viewDurationSec = options.viewDurationSec ?? 10;
  }

  setNotes(notes: MIDINote[]): void {
    this.notes = notes;
  }

  setCurrentTime(time: number): void {
    this.currentTime = time;
  }

  start(): void {
    const draw = () => {
      this.render();
      this.animFrameId = requestAnimationFrame(draw);
    };
    this.animFrameId = requestAnimationFrame(draw);
  }

  stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private render(): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    this.drawGrid(width, height);

    const timeWindow = this.viewDurationSec;
    const startTime = this.currentTime - timeWindow * 0.2;
    const endTime = this.currentTime + timeWindow * 0.8;

    for (const note of this.notes) {
      if (note.startTime + note.duration < startTime || note.startTime > endTime) continue;

      const x = (note.startTime - startTime) * this.pixelsPerSecond;
      const noteWidth = Math.max(4, note.duration * this.pixelsPerSecond);
      const y = height - ((note.pitch - 21) * this.noteHeight) - this.noteHeight;

      const isBlack = BLACK_KEYS.has(note.pitch % 12);
      const isActive = note.startTime <= this.currentTime &&
                       note.startTime + note.duration >= this.currentTime;

      ctx.globalAlpha = 0.3 + note.confidence * 0.7;
      ctx.fillStyle = isActive ? NOTE_COLORS.active : (isBlack ? NOTE_COLORS.black : NOTE_COLORS.white);
      ctx.fillRect(x, y, noteWidth, this.noteHeight - 1);

      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = isActive ? '#fbbf24' : '#16a34a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, noteWidth, this.noteHeight - 1);
    }

    ctx.globalAlpha = 1;

    const playheadX = timeWindow * 0.2 * this.pixelsPerSecond;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    this.drawPianoKeys(height);
  }

  private drawGrid(width: number, height: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    for (let pitch = 21; pitch <= 108; pitch++) {
      const y = height - ((pitch - 21) * this.noteHeight) - this.noteHeight;
      if (BLACK_KEYS.has(pitch % 12)) {
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, y, width, this.noteHeight);
      }
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const startTime = this.currentTime - this.viewDurationSec * 0.2;
    for (let t = Math.floor(startTime); t < startTime + this.viewDurationSec; t++) {
      const x = (t - startTime) * this.pixelsPerSecond;
      ctx.strokeStyle = t % 4 === 0 ? '#334155' : '#1e293b';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  private drawPianoKeys(height: number): void {
    const ctx = this.ctx;
    const keyWidth = 24;

    for (let pitch = 21; pitch <= 108; pitch++) {
      const y = height - ((pitch - 21) * this.noteHeight) - this.noteHeight;
      const isBlack = BLACK_KEYS.has(pitch % 12);

      ctx.fillStyle = isBlack ? '#1e293b' : '#334155';
      ctx.fillRect(0, y, keyWidth, this.noteHeight - 1);

      if (pitch % 12 === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '7px monospace';
        ctx.fillText(`C${Math.floor(pitch / 12) - 1}`, 2, y + this.noteHeight - 2);
      }
    }
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
