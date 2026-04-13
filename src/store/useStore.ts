import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type InputMode = 'microphone' | 'tab' | 'audioFile' | 'videoFile';
export type DetectionMode = 'essentia' | 'crepe' | 'yin';
export type AppStatus = 'idle' | 'recording' | 'processing' | 'error';

export interface MIDINote {
  pitch: number;
  velocity: number;
  startTime: number;
  duration: number;
  confidence: number;
}

export interface Settings {
  detectionMode: DetectionMode;
  minConfidence: number;
  quantizeGrid: number; // ms
  velocityScale: number;
  sampleRate: number;
  hopSize: number;
  minNoteMs: number;
}

export interface UIState {
  inputMode: InputMode;
  status: AppStatus;
  errorMessage: string | null;
  isProcessing: boolean;
  progress: number; // 0-100
  progressLabel: string;
  notes: MIDINote[];
  currentTime: number;
  isPlaying: boolean;
  settings: Settings;
  webMIDIAvailable: boolean;
  selectedMIDIOutput: string | null;
  availableMIDIOutputs: string[];
}

const defaultSettings: Settings = {
  detectionMode: 'yin',
  minConfidence: 0.5,
  quantizeGrid: 50,
  velocityScale: 1.0,
  sampleRate: 44100,
  hopSize: 512,
  minNoteMs: 50,
};

interface UIActions {
  setInputMode: (mode: InputMode) => void;
  setStatus: (status: AppStatus, error?: string) => void;
  setProcessing: (processing: boolean, progress?: number, label?: string) => void;
  addNote: (note: MIDINote) => void;
  setNotes: (notes: MIDINote[]) => void;
  clearNotes: () => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  setWebMIDI: (available: boolean, outputs: string[], selected?: string) => void;
  setSelectedMIDIOutput: (id: string | null) => void;
}

export const useStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      inputMode: 'microphone',
      status: 'idle',
      errorMessage: null,
      isProcessing: false,
      progress: 0,
      progressLabel: '',
      notes: [],
      currentTime: 0,
      isPlaying: false,
      settings: defaultSettings,
      webMIDIAvailable: false,
      selectedMIDIOutput: null,
      availableMIDIOutputs: [],

      setInputMode: (mode) => set({ inputMode: mode }),
      setStatus: (status, error) => set({ status, errorMessage: error ?? null }),
      setProcessing: (processing, progress = 0, label = '') =>
        set({ isProcessing: processing, progress, progressLabel: label }),
      addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),
      setNotes: (notes) => set({ notes }),
      clearNotes: () => set({ notes: [] }),
      setCurrentTime: (time) => set({ currentTime: time }),
      setPlaying: (playing) => set({ isPlaying: playing }),
      updateSettings: (settings) =>
        set((state) => ({ settings: { ...state.settings, ...settings } })),
      setWebMIDI: (available, outputs, selected) =>
        set({ webMIDIAvailable: available, availableMIDIOutputs: outputs, selectedMIDIOutput: selected ?? outputs[0] ?? null }),
      setSelectedMIDIOutput: (id) => set({ selectedMIDIOutput: id }),
    }),
    {
      name: 'audio-midi-bridge-settings',
      partialize: (state) => ({ settings: state.settings, selectedMIDIOutput: state.selectedMIDIOutput }),
    }
  )
);
