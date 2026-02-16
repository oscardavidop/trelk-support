// Audio Recorder Component - Records voice messages using MediaRecorder API
import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Play, Pause, Trash2, Send } from 'lucide-react';

interface AudioRecorderProps {
  onComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export default function AudioRecorder({ onComplete, onCancel }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });
      streamRef.current = stream;

      // Create MediaRecorder with preferred format
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg;codecs=opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setState('recording');
      setDuration(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      setState('stopped');
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [state]);

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else if (state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
  }, [state]);

  // Play/Pause preview
  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, audioUrl]);

  // Reset recording
  const resetRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setState('idle');
    setIsPlaying(false);
    audioChunksRef.current = [];
  }, [audioUrl]);

  // Send audio
  const handleSend = useCallback(() => {
    if (audioBlob) {
      onComplete(audioBlob);
    }
  }, [audioBlob, onComplete]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start automatically when mounted
  useEffect(() => {
    startRecording();
  }, [startRecording]);

  return (
    <div className="absolute bottom-full left-4 right-4 mb-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            state === 'recording' ? 'bg-red-500 animate-pulse' :
            state === 'paused' ? 'bg-yellow-500' :
            state === 'stopped' ? 'bg-green-500' :
            'bg-gray-500'
          }`} />
          <span className="text-sm text-gray-300">
            {state === 'recording' ? 'Grabando...' :
             state === 'paused' ? 'Pausado' :
             state === 'stopped' ? 'Grabación lista' :
             'Preparando...'}
          </span>
        </div>
        <span className="text-lg font-mono text-zinc-50">{formatDuration(duration)}</span>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-3 bg-red-900/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Waveform visualization (simplified) */}
      <div className="px-4 py-4 flex items-center justify-center gap-0.5">
        {[...Array(40)].map((_, i) => (
          <div
            key={i}
            className={`w-1 bg-primary rounded-full transition-all ${
              state === 'recording' ? 'animate-pulse' : ''
            }`}
            style={{
              height: state === 'recording' 
                ? `${Math.random() * 24 + 8}px` 
                : state === 'stopped' 
                  ? `${Math.sin(i / 3) * 12 + 16}px`
                  : '4px',
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>

      {/* Hidden audio element for playback */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Controls */}
      <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
        {/* Left controls */}
        <div className="flex items-center gap-2">
          {state !== 'stopped' ? (
            <>
              <button
                onClick={togglePause}
                className="p-2 bg-gray-800 hover:bg-gray-700 text-zinc-50 rounded-lg transition-colors"
                title={state === 'recording' ? 'Pausar' : 'Reanudar'}
              >
                {state === 'recording' ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={stopRecording}
                className="p-2 bg-red-600 hover:bg-red-700 text-zinc-50 rounded-lg transition-colors"
                title="Detener"
              >
                <Square className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={togglePlayback}
                className="p-2 bg-gray-800 hover:bg-gray-700 text-zinc-50 rounded-lg transition-colors"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={resetRecording}
                className="p-2 bg-gray-800 hover:bg-gray-700 text-red-400 rounded-lg transition-colors"
                title="Eliminar y regrabar"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-zinc-50 text-sm rounded-lg transition-colors"
          >
            Cancelar
          </button>
          {state === 'stopped' && audioBlob && (
            <button
              onClick={handleSend}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-zinc-50 text-sm font-medium rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
