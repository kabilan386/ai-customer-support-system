"use client";
import { useState, useRef, useEffect } from "react";
import { Mic, Square } from "lucide-react";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  size?: "default" | "large";
  token?: string | null;
  onListeningStateChange?: (listening: boolean) => void;
  onWaveformChange?: (bars: number[]) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WAVEFORM_BAR_COUNT = 7;

function buildWaveformBars(data: Uint8Array) {
  const bars: number[] = [];
  const bucketSize = Math.max(1, Math.floor(data.length / WAVEFORM_BAR_COUNT));

  for (let index = 0; index < WAVEFORM_BAR_COUNT; index += 1) {
    const start = index * bucketSize;
    const end = Math.min(start + bucketSize, data.length);
    let total = 0;

    for (let cursor = start; cursor < end; cursor += 1) {
      total += Math.abs(data[cursor] - 128);
    }

    const average = end > start ? total / (end - start) : 0;
    const normalized = Math.min(1, average / 48);
    bars.push(0.25 + normalized * 0.75);
  }

  return bars;
}

export default function VoiceButton({
  onTranscript,
  disabled,
  size = "default",
  token,
  onListeningStateChange,
  onWaveformChange,
}: Props) {
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscriptRef = useRef(onTranscript);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  function stopWaveformTracking() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    onWaveformChange?.(Array(WAVEFORM_BAR_COUNT).fill(0.18));
  }

  function startWaveformTracking(stream: MediaStream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      onWaveformChange?.(buildWaveformBars(buffer));
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
  }

  useEffect(() => {
    onListeningStateChange?.(listening);
  }, [listening, onListeningStateChange]);

  useEffect(() => {
    return () => {
      stopWaveformTracking();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startListening() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      startWaveformTracking(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        stopWaveformTracking();
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendToWhisper(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setListening(true);
    } catch {
      setError("Mic access denied");
    }
  }

  function stopListening() {
    mediaRecorderRef.current?.stop();
    setListening(false);
    setLoading(true);
  }

  async function sendToWhisper(blob: Blob) {
    try {
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");

      const res = await fetch(`${API}/voice/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      if (data.text?.trim()) {
        onTranscriptRef.current(data.text.trim());
      } else {
        setError("No speech detected");
      }
    } catch {
      setError("Transcription failed");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (listening) stopListening();
    else startListening();
  }

  const buttonSize = size === "large" ? "w-14 h-14" : "w-10 h-10";
  const iconSize = size === "large" ? "w-5 h-5" : "w-4 h-4";
  const recordingLabel = size === "large" ? "Listening..." : "Recording…";
  const loadingLabel = size === "large" ? "Transcribing voice..." : "Transcribing…";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={toggle}
        disabled={disabled || loading}
        title={listening ? "Stop & transcribe" : "Click to speak"}
        className={`${buttonSize} rounded-full flex items-center justify-center transition ${
          listening
            ? "bg-red-500 hover:bg-red-600 animate-pulse"
            : loading
            ? "bg-slate-600 cursor-wait"
            : "bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/40"
        } disabled:opacity-40`}
      >
        {listening
          ? <Square className={`${iconSize} text-white fill-white`} />
          : <Mic className={`${iconSize} text-sky-400`} />
        }
      </button>
      {listening && <p className="text-xs text-red-400">{recordingLabel}</p>}
      {loading && <p className="text-xs text-slate-400">{loadingLabel}</p>}
      {error && <p className="text-xs text-amber-400 max-w-[90px] text-center">{error}</p>}
    </div>
  );
}
