"use client";
import { useState, useRef, useEffect } from "react";
import { Mic, Square } from "lucide-react";

interface Props {
  onTranscript: (text: string) => void;
  botReply?: string;
  disabled?: boolean;
  token?: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function VoiceButton({ onTranscript, botReply, disabled, token }: Props) {
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  // TTS for bot reply via browser
  useEffect(() => {
    if (!botReply) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      botReply.replace(/\s*(RESOLVED|UNRESOLVED)\s*/gi, "").trim()
    );
    window.speechSynthesis.speak(utterance);
  }, [botReply]);

  async function startListening() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
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

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={toggle}
        disabled={disabled || loading}
        title={listening ? "Stop & transcribe" : "Click to speak"}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
          listening
            ? "bg-red-500 hover:bg-red-600 animate-pulse"
            : loading
            ? "bg-slate-600 cursor-wait"
            : "bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/40"
        } disabled:opacity-40`}
      >
        {listening
          ? <Square className="w-4 h-4 text-white fill-white" />
          : <Mic className="w-4 h-4 text-sky-400" />
        }
      </button>
      {listening && <p className="text-xs text-red-400">Recording…</p>}
      {loading && <p className="text-xs text-slate-400">Transcribing…</p>}
      {error && <p className="text-xs text-amber-400 max-w-[90px] text-center">{error}</p>}
    </div>
  );
}
