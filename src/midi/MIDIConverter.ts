import type { MIDINote } from '../store/useStore';
import type { PitchResult } from '../pitch/PitchDetectionWorker';

export interface NoteEvent {
  type: 'noteOn' | 'noteOff';
  note: number;
  velocity: number;
  time: number;
  channel: number;
}

export class MIDIConverter {
  private activeNotes: Map<number, { startTime: number; velocity: number; confidence: number }> = new Map();
  private minConfidence: number;
  private minNoteDurationMs: number;
  private onNoteEvent?: (event: NoteEvent) => void;
  private onNoteCompleted?: (note: MIDINote) => void;

  constructor(options: {
    minConfidence?: number;
    minNoteDurationMs?: number;
    quantizeGridMs?: number;
  } = {}) {
    this.minConfidence = options.minConfidence ?? 0.5;
    this.minNoteDurationMs = options.minNoteDurationMs ?? 50;
  }

  processPitchResult(result: PitchResult): void {
    const { midiNote, confidence, timeOffset } = result;

    if (confidence < this.minConfidence || midiNote === 0) {
      this.activeNotes.forEach((noteData, note) => {
        const duration = (timeOffset - noteData.startTime) * 1000;
        if (duration >= this.minNoteDurationMs) {
          this.onNoteEvent?.({
            type: 'noteOff',
            note,
            velocity: noteData.velocity,
            time: timeOffset,
            channel: 0,
          });
          this.onNoteCompleted?.({
            pitch: note,
            velocity: noteData.velocity,
            startTime: noteData.startTime,
            duration: duration / 1000,
            confidence,
          });
        }
        this.activeNotes.delete(note);
      });
      return;
    }

    const currentActive = this.activeNotes;

    currentActive.forEach((noteData, note) => {
      if (note !== midiNote) {
        const duration = (timeOffset - noteData.startTime) * 1000;
        if (duration >= this.minNoteDurationMs) {
          this.onNoteEvent?.({
            type: 'noteOff',
            note,
            velocity: noteData.velocity,
            time: timeOffset,
            channel: 0,
          });
          this.onNoteCompleted?.({
            pitch: note,
            velocity: noteData.velocity,
            startTime: noteData.startTime,
            duration: duration / 1000,
            confidence: noteData.confidence,
          });
        }
        this.activeNotes.delete(note);
      }
    });

    if (!this.activeNotes.has(midiNote)) {
      const velocity = Math.round(Math.min(127, confidence * 127));
      this.activeNotes.set(midiNote, { startTime: timeOffset, velocity, confidence });
      this.onNoteEvent?.({
        type: 'noteOn',
        note: midiNote,
        velocity,
        time: timeOffset,
        channel: 0,
      });
    }
  }

  flushActiveNotes(currentTime: number): void {
    this.activeNotes.forEach((noteData, note) => {
      const duration = (currentTime - noteData.startTime) * 1000;
      this.onNoteEvent?.({
        type: 'noteOff',
        note,
        velocity: noteData.velocity,
        time: currentTime,
        channel: 0,
      });
      this.onNoteCompleted?.({
        pitch: note,
        velocity: noteData.velocity,
        startTime: noteData.startTime,
        duration: Math.max(duration / 1000, this.minNoteDurationMs / 1000),
        confidence: noteData.confidence,
      });
    });
    this.activeNotes.clear();
  }

  setOnNoteEvent(cb: (event: NoteEvent) => void): void { this.onNoteEvent = cb; }
  setOnNoteCompleted(cb: (note: MIDINote) => void): void { this.onNoteCompleted = cb; }

  updateOptions(options: { minConfidence?: number; minNoteDurationMs?: number; quantizeGridMs?: number }): void {
    if (options.minConfidence !== undefined) this.minConfidence = options.minConfidence;
    if (options.minNoteDurationMs !== undefined) this.minNoteDurationMs = options.minNoteDurationMs;
  }
}
