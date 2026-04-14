import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { AudioInputManager } from '../audio/AudioInputManager';
import { FileDecodeEngine } from '../audio/FileDecodeEngine';
import { MIDIConverter } from '../midi/MIDIConverter';
import { SMFBuilder } from '../midi/SMFBuilder';
import { MIDIOutputManager } from '../midi/MIDIOutputManager';
import { PianoRollVisualizer } from '../visualizer/PianoRollVisualizer';
import type { MIDINote } from '../store/useStore';

const InputModeSelector: React.FC = () => {
  const { inputMode, setInputMode } = useStore();
  const modes = [
    { id: 'microphone', label: '🎤 Microphone', desc: 'Real-time mic input' },
    { id: 'tab', label: '🔊 Browser Tab', desc: 'Capture tab audio (Chrome)' },
    { id: 'audioFile', label: '🎵 Audio File', desc: 'MP3/WAV/FLAC/OGG/M4A' },
    { id: 'videoFile', label: '🎬 Video File', desc: 'MP4/WebM/MOV' },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => setInputMode(m.id)}
          className={`p-3 rounded-lg border text-left transition-all ${
            inputMode === m.id
              ? 'border-green-500 bg-green-500/20 text-green-400'
              : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
          }`}
        >
          <div className="font-medium text-sm">{m.label}</div>
          <div className="text-xs opacity-70 mt-1">{m.desc}</div>
        </button>
      ))}
    </div>
  );
};

const SettingsPanel: React.FC = () => {
  const { settings, updateSettings } = useStore();
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      <div>
        <label className="text-xs text-slate-400 block mb-1">Detection Mode</label>
        <select
          value={settings.detectionMode}
          onChange={(e) => updateSettings({ detectionMode: e.target.value as 'essentia' | 'crepe' | 'yin' })}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-300"
        >
          <option value="yin">YIN (Fast)</option>
          <option value="essentia">Essentia (Accurate)</option>
          <option value="crepe">Crepe (ML Model)</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Min Confidence: {settings.minConfidence.toFixed(2)}</label>
        <input
          type="range" min="0.1" max="0.9" step="0.05"
          value={settings.minConfidence}
          onChange={(e) => updateSettings({ minConfidence: parseFloat(e.target.value) })}
          className="w-full accent-green-500"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Quantize Grid (ms): {settings.quantizeGrid}</label>
        <input
          type="range" min="10" max="200" step="10"
          value={settings.quantizeGrid}
          onChange={(e) => updateSettings({ quantizeGrid: parseInt(e.target.value) })}
          className="w-full accent-green-500"
        />
      </div>
    </div>
  );
};

const PianoRollCanvas: React.FC<{ notes: MIDINote[]; currentTime: number }> = ({ notes, currentTime }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<PianoRollVisualizer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    visualizerRef.current = new PianoRollVisualizer({
      canvas,
      pixelsPerSecond: 100,
      noteHeight: 8,
    });
    visualizerRef.current.start();
    return () => visualizerRef.current?.stop();
  }, []);

  useEffect(() => {
    visualizerRef.current?.setNotes(notes);
  }, [notes]);

  useEffect(() => {
    visualizerRef.current?.setCurrentTime(currentTime);
  }, [currentTime]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-64 rounded-lg"
      style={{ background: '#0f172a' }}
    />
  );
};

const ProgressModal: React.FC = () => {
  const { isProcessing, progress, progressLabel } = useStore();
  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-slate-900 border border-slate-700 rounded-xl p-8 w-80"
          >
            <h3 className="text-white font-semibold mb-4">Processing...</h3>
            <div className="bg-slate-800 rounded-full h-2 mb-3">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-slate-400 text-sm">{progressLabel || `${Math.round(progress)}%`}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const App: React.FC = () => {
  const {
    inputMode, status, notes, currentTime, isPlaying, settings,
    setStatus, setProcessing, addNote, setNotes, clearNotes,
    setCurrentTime, setPlaying, setWebMIDI, webMIDIAvailable,
    availableMIDIOutputs, selectedMIDIOutput, setSelectedMIDIOutput,
    errorMessage,
  } = useStore();

  const audioManagerRef = useRef<AudioInputManager | null>(null);
  const midiConverterRef = useRef<MIDIConverter | null>(null);
  const midiOutputRef = useRef<MIDIOutputManager | null>(null);
  const smfBuilderRef = useRef<SMFBuilder>(new SMFBuilder(480, 120));
  const mediaElementRef = useRef<HTMLMediaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pitchWorkerRef = useRef<Worker | null>(null);
  const recordedNotesRef = useRef<MIDINote[]>([]);
  const startTimeRef = useRef<number>(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaDuration, setMediaDuration] = useState<number>(0);
  const [isMediaPlaying, setIsMediaPlaying] = useState<boolean>(false);

  useEffect(() => {
    const midiOut = new MIDIOutputManager();
    midiOutputRef.current = midiOut;
    midiOut.initialize().then((outputs) => {
      setWebMIDI(outputs.length > 0, outputs.map((o) => o.id));
    });
  }, [setWebMIDI]);

  useEffect(() => {
    const worker = new Worker(
      new URL('../pitch/PitchDetectionWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.postMessage({
      type: 'configure',
      payload: { mode: settings.detectionMode, sampleRate: settings.sampleRate },
    });

    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'result') {
        const result = event.data.payload;
        midiConverterRef.current?.processPitchResult(result);
        setCurrentTime(result.timeOffset);
      }
    };

    pitchWorkerRef.current = worker;
    return () => worker.terminate();
  }, [settings.detectionMode, settings.sampleRate, setCurrentTime]);

  useEffect(() => {
    const converter = new MIDIConverter({
      minConfidence: settings.minConfidence,
      minNoteDurationMs: settings.minNoteMs,
      quantizeGridMs: settings.quantizeGrid,
    });

    converter.setOnNoteEvent((event) => {
      midiOutputRef.current?.sendNoteEvent(event);
    });

    converter.setOnNoteCompleted((note) => {
      recordedNotesRef.current.push(note);
      addNote(note);
    });

    midiConverterRef.current = converter;
  }, [settings.minConfidence, settings.minNoteMs, settings.quantizeGrid, addNote]);

  const handleStart = useCallback(async () => {
    if (!pitchWorkerRef.current) return;

    try {
      clearNotes();
      recordedNotesRef.current = [];
      startTimeRef.current = Date.now() / 1000;

      const manager = new AudioInputManager();
      audioManagerRef.current = manager;

      if (inputMode === 'audioFile' || inputMode === 'videoFile') {
        fileInputRef.current?.click();
        return;
      }

      await manager.initialize({
        source: inputMode,
        sampleRate: settings.sampleRate,
      });

      let sampleCount = 0;
      manager.setOnAudioChunk((pcm, sr) => {
        const timeOffset = sampleCount / sr + startTimeRef.current;
        sampleCount += pcm.length;
        pitchWorkerRef.current?.postMessage({
          type: 'detect',
          payload: { pcm: pcm.buffer, timeOffset },
        }, [pcm.buffer]);
      });

      setStatus('recording');
      setPlaying(true);
    } catch (err) {
      setStatus('error', (err as Error).message);
    }
  }, [inputMode, settings, clearNotes, setStatus, setPlaying]);

  const handleStop = useCallback(async () => {
    await audioManagerRef.current?.stop();
    midiConverterRef.current?.flushActiveNotes(Date.now() / 1000 - startTimeRef.current);
    midiOutputRef.current?.sendAllNotesOff();
    setStatus('idle');
    setPlaying(false);
  }, [setStatus, setPlaying]);

  const handleFileProcess = useCallback(async (file: File) => {
    if (!pitchWorkerRef.current) return;

    clearNotes();
    recordedNotesRef.current = [];

    try {
      setProcessing(true, 0, 'Decoding file...');
      const engine = new FileDecodeEngine(settings.sampleRate);
      const chunks = await engine.decode(file, (p) => {
        setProcessing(true, p.percentage * 0.5, `Decoding: ${Math.round(p.percentage)}%`);
      });
      await engine.close();

      setProcessing(true, 50, 'Detecting pitch...');

      const analysisWindow = 2048;
      const hopSize = Math.max(128, settings.hopSize);
      let processedFrames = 0;

      const totalFrames = chunks.reduce((count, chunk) => {
        if (chunk.pcm.length <= analysisWindow) return count + 1;
        return count + Math.ceil((chunk.pcm.length - analysisWindow) / hopSize) + 1;
      }, 0);

      for (const chunk of chunks) {
        for (let frameStart = 0; frameStart < chunk.pcm.length; frameStart += hopSize) {
          const frameEnd = Math.min(frameStart + analysisWindow, chunk.pcm.length);
          const frame = new Float32Array(analysisWindow);
          frame.set(chunk.pcm.subarray(frameStart, frameEnd));

          await new Promise<void>((resolve) => {
            const worker = pitchWorkerRef.current!;

            const handler = (event: MessageEvent) => {
              if (event.data.type === 'result' || event.data.type === 'error') {
                worker.removeEventListener('message', handler);
                resolve();
              }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({
              type: 'detect',
              payload: {
                pcm: frame.buffer,
                timeOffset: chunk.timeOffset + frameStart / settings.sampleRate,
              },
            }, [frame.buffer]);
          });

          processedFrames++;
          setProcessing(
            true,
            50 + (processedFrames / Math.max(totalFrames, 1)) * 45,
            `Analyzing ${processedFrames}/${totalFrames} frames...`
          );

          if (frameEnd === chunk.pcm.length) break;
        }
      }

      const lastChunk = chunks[chunks.length - 1];
      const finalTime = lastChunk ? lastChunk.timeOffset + lastChunk.pcm.length / settings.sampleRate : 0;
      midiConverterRef.current?.flushActiveNotes(finalTime);

      setNotes([...recordedNotesRef.current]);
      setProcessing(true, 100, 'Complete!');

      setTimeout(() => {
        setProcessing(false);
        setStatus('idle');
      }, 500);

    } catch (err) {
      setProcessing(false);
      setStatus('error', (err as Error).message);
    }
  }, [settings.sampleRate, settings.hopSize, clearNotes, setProcessing, setNotes, setStatus]);

  const prepareMediaPreview = useCallback((file: File) => {
    setMediaUrl((previousUrl) => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return URL.createObjectURL(file);
    });
    setMediaDuration(0);
    setCurrentTime(0);
    setIsMediaPlaying(false);
  }, [setCurrentTime]);

  const handleFileSelected = useCallback((file: File) => {
    prepareMediaPreview(file);
    void handleFileProcess(file);
  }, [prepareMediaPreview, handleFileProcess]);

  const handleSeek = useCallback((nextTime: number) => {
    const media = mediaElementRef.current;
    if (!media) return;
    media.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [setCurrentTime]);

  const handleRestartPlay = useCallback(async () => {
    const media = mediaElementRef.current;
    if (!media) return;
    media.currentTime = 0;
    setCurrentTime(0);
    await media.play();
  }, [setCurrentTime]);

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  const handleDownloadMIDI = useCallback(() => {
    if (notes.length === 0) return;
    try {
      smfBuilderRef.current.download(notes, 'output.mid');
    } catch (err) {
      setStatus('error', (err as Error).message);
    }
  }, [notes, setStatus]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  }, [handleFileSelected]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <ProgressModal />

      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-black font-bold">M</div>
          <div>
            <h1 className="text-lg font-bold text-white">AudioMIDI Bridge Web</h1>
            <p className="text-xs text-slate-500">Audio → MIDI Converter</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === 'recording' && (
            <span className="flex items-center gap-1.5 text-red-400 text-sm">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              Recording
            </span>
          )}
          {status === 'error' && (
            <span className="text-red-400 text-sm">⚠️ {errorMessage}</span>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Input Source</h2>
          <InputModeSelector />
        </section>

        {(inputMode === 'audioFile' || inputMode === 'videoFile') && (
          <section
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center hover:border-green-500/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-4xl mb-3">{inputMode === 'videoFile' ? '🎬' : '🎵'}</div>
            <p className="text-slate-400">Drop {inputMode === 'videoFile' ? 'video' : 'audio'} file here or click to browse</p>
            <p className="text-slate-600 text-sm mt-1">
              {inputMode === 'videoFile' ? 'MP4, WebM, MOV' : 'MP3, WAV, FLAC, OGG, M4A, AAC'}
            </p>
          </section>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={inputMode === 'videoFile' ? 'video/*' : 'audio/*'}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
            e.target.value = '';
          }}
        />

        {(inputMode === 'audioFile' || inputMode === 'videoFile') && mediaUrl && (
          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            {inputMode === 'videoFile' ? (
              <video
                ref={(el) => {
                  mediaElementRef.current = el;
                }}
                src={mediaUrl}
                className="w-full rounded-lg bg-black max-h-64"
                onLoadedMetadata={(e) => {
                  const duration = Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0;
                  setMediaDuration(duration);
                  setCurrentTime(0);
                }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onPlay={() => setIsMediaPlaying(true)}
                onPause={() => setIsMediaPlaying(false)}
                onEnded={() => setIsMediaPlaying(false)}
              />
            ) : (
              <audio
                ref={(el) => {
                  mediaElementRef.current = el;
                }}
                src={mediaUrl}
                className="w-full"
                onLoadedMetadata={(e) => {
                  const duration = Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0;
                  setMediaDuration(duration);
                  setCurrentTime(0);
                }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onPlay={() => setIsMediaPlaying(true)}
                onPause={() => setIsMediaPlaying(false)}
                onEnded={() => setIsMediaPlaying(false)}
              />
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const media = mediaElementRef.current;
                  if (!media) return;
                  if (isMediaPlaying) {
                    media.pause();
                  } else {
                    void media.play();
                  }
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {isMediaPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                onClick={() => {
                  void handleRestartPlay();
                }}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ⏮ Play from Start
              </button>
              <span className="text-xs text-slate-400 min-w-28 text-right">
                {currentTime.toFixed(1)}s / {mediaDuration.toFixed(1)}s
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={mediaDuration || 0}
              step={0.01}
              value={Math.min(currentTime, mediaDuration || 0)}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              disabled={mediaDuration <= 0}
              className="w-full accent-green-500 disabled:opacity-40"
            />
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Piano Roll</h2>
            <span className="text-xs text-slate-600">{notes.length} notes</span>
          </div>
          <PianoRollCanvas notes={notes} currentTime={currentTime} />
        </section>

        <section className="flex items-center gap-3 flex-wrap">
          {!isPlaying && (inputMode === 'microphone' || inputMode === 'tab') && (
            <button
              onClick={handleStart}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
            >
              ▶ Start Recording
            </button>
          )}
          {isPlaying && (
            <button
              onClick={handleStop}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
            >
              ⏹ Stop
            </button>
          )}
          <button
            onClick={handleDownloadMIDI}
            disabled={notes.length === 0}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            ⬇ Export MIDI
          </button>
          <button
            onClick={() => { clearNotes(); recordedNotesRef.current = []; }}
            disabled={notes.length === 0}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 rounded-lg font-medium transition-colors"
          >
            🗑 Clear
          </button>

          {webMIDIAvailable && (
            <select
              value={selectedMIDIOutput ?? ''}
              onChange={(e) => {
                setSelectedMIDIOutput(e.target.value);
                midiOutputRef.current?.selectOutput(e.target.value);
              }}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2.5 text-sm text-slate-300"
            >
              <option value="">No MIDI Output</option>
              {availableMIDIOutputs.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Settings</h2>
          <SettingsPanel />
        </section>
      </main>

      <footer className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-600">
        AudioMIDI Bridge Web · All processing in browser
      </footer>
    </div>
  );
};

export default App;
