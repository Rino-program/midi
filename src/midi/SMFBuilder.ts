import type { MIDINote } from '../store/useStore';

export class SMFBuilder {
  private ppq: number;
  private tempo: number;

  constructor(ppq = 480, bpm = 120) {
    this.ppq = ppq;
    this.tempo = Math.round(60_000_000 / bpm);
  }

  build(notes: MIDINote[]): Uint8Array {
    const trackData = this.buildTrack(notes);
    return this.buildSMF(trackData);
  }

  private buildTrack(notes: MIDINote[]): number[] {
    const events: { tick: number; data: number[] }[] = [];

    events.push({
      tick: 0,
      data: [0xff, 0x51, 0x03,
        (this.tempo >> 16) & 0xff,
        (this.tempo >> 8) & 0xff,
        this.tempo & 0xff],
    });

    for (const note of notes) {
      const onTick = Math.round(note.startTime * this.ppq * 1_000_000 / this.tempo);
      const offTick = Math.round((note.startTime + note.duration) * this.ppq * 1_000_000 / this.tempo);
      const vel = Math.max(1, Math.min(127, Math.round(note.velocity)));

      events.push({ tick: onTick, data: [0x90, note.pitch, vel] });
      events.push({ tick: offTick, data: [0x80, note.pitch, 0] });
    }

    const maxTick = events.reduce((m, e) => Math.max(m, e.tick), 0);
    events.push({ tick: maxTick + this.ppq, data: [0xff, 0x2f, 0x00] });

    events.sort((a, b) => a.tick - b.tick);

    const track: number[] = [];
    let prevTick = 0;
    for (const event of events) {
      const delta = event.tick - prevTick;
      prevTick = event.tick;
      track.push(...this.encodeVarLen(delta), ...event.data);
    }

    return track;
  }

  private buildSMF(trackData: number[]): Uint8Array {
    const header = [
      0x4d, 0x54, 0x68, 0x64,
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x00,
      0x00, 0x01,
      (this.ppq >> 8) & 0xff, this.ppq & 0xff,
    ];

    const trackLength = trackData.length;
    const trackHeader = [
      0x4d, 0x54, 0x72, 0x6b,
      (trackLength >> 24) & 0xff,
      (trackLength >> 16) & 0xff,
      (trackLength >> 8) & 0xff,
      trackLength & 0xff,
    ];

    return new Uint8Array([...header, ...trackHeader, ...trackData]);
  }

  private encodeVarLen(value: number): number[] {
    const bytes: number[] = [];
    bytes.push(value & 0x7f);
    value >>= 7;
    while (value > 0) {
      bytes.unshift((value & 0x7f) | 0x80);
      value >>= 7;
    }
    return bytes;
  }

  private isValidSMF(data: Uint8Array): boolean {
    if (data.length < 14) return false;
    return (
      data[0] === 0x4d && // M
      data[1] === 0x54 && // T
      data[2] === 0x68 && // h
      data[3] === 0x64 // d
    );
  }

  download(notes: MIDINote[], filename = 'output.mid'): void {
    const data = this.build(notes);
    if (!this.isValidSMF(data)) {
      throw new Error('Generated file is not a valid MIDI SMF.');
    }

    const raw = Uint8Array.from(data).buffer;
    const blob = new Blob([raw], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
