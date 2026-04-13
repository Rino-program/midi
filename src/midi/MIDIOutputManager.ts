/// <reference lib="dom" />
import type { NoteEvent } from './MIDIConverter';

export interface MIDIOutputInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export class MIDIOutputManager {
  private midiAccess: MIDIAccess | null = null;
  private selectedOutput: MIDIOutput | null = null;
  private onAvailable?: (outputs: MIDIOutputInfo[]) => void;

  async initialize(): Promise<MIDIOutputInfo[]> {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not available');
      return [];
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess.onstatechange = () => {
        const outputs = this.getOutputs();
        this.onAvailable?.(outputs);
      };
      return this.getOutputs();
    } catch (err) {
      console.warn('MIDI access denied:', err);
      return [];
    }
  }

  getOutputs(): MIDIOutputInfo[] {
    if (!this.midiAccess) return [];
    const outputs: MIDIOutputInfo[] = [];
    this.midiAccess.outputs.forEach((output) => {
      outputs.push({ id: output.id, name: output.name ?? 'Unknown', manufacturer: output.manufacturer ?? '' });
    });
    return outputs;
  }

  selectOutput(id: string): boolean {
    if (!this.midiAccess) return false;
    const output = this.midiAccess.outputs.get(id);
    if (!output) return false;
    this.selectedOutput = output;
    return true;
  }

  sendNoteEvent(event: NoteEvent): void {
    if (!this.selectedOutput) return;

    const channel = event.channel & 0x0f;
    if (event.type === 'noteOn') {
      this.selectedOutput.send([0x90 | channel, event.note, event.velocity]);
    } else {
      this.selectedOutput.send([0x80 | channel, event.note, 0]);
    }
  }

  sendAllNotesOff(): void {
    if (!this.selectedOutput) return;
    for (let ch = 0; ch < 16; ch++) {
      this.selectedOutput.send([0xb0 | ch, 123, 0]);
    }
  }

  setOnAvailable(cb: (outputs: MIDIOutputInfo[]) => void): void {
    this.onAvailable = cb;
  }
}
