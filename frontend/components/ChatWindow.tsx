"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertCircle, Shield, AudioLines, X } from "lucide-react";
import SentimentBadge from "./SentimentBadge";
import VoiceButton from "./VoiceButton";
import { useAuth } from "@/context/AuthContext";

interface Message {
  id: string;
  role: "user" | "bot" | "agent";
  content: string;
  sentimentScore?: number;
  sentimentLabel?: "positive" | "neutral" | "negative";
  isStreaming?: boolean;
  senderName?: string;
}

interface Meta {
  resolved?: boolean;
  ticketId?: number | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = API.replace(/^http/, "ws");
const IDLE_WAVEFORM = [0.24, 0.36, 0.5, 0.68, 0.5, 0.36, 0.24];

function buildPlaybackWaveformBars(data: Uint8Array) {
  const barCount = IDLE_WAVEFORM.length;
  const bars: number[] = [];
  const bucketSize = Math.max(1, Math.floor(data.length / barCount));

  for (let index = 0; index < barCount; index += 1) {
    const start = index * bucketSize;
    const end = Math.min(start + bucketSize, data.length);
    let total = 0;

    for (let cursor = start; cursor < end; cursor += 1) {
      total += data[cursor];
    }

    const average = end > start ? total / (end - start) : 0;
    const normalized = Math.min(1, average / 160);
    bars.push(0.22 + normalized * 0.78);
  }

  return bars;
}

export default function ChatWindow() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [convId, setConvId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [lastBotReply, setLastBotReply] = useState<string | undefined>();
  const [lastMeta, setLastMeta] = useState<Meta>({});
  const [agentOnline, setAgentOnline] = useState(false);
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false);
  const [voiceAssistantStatus, setVoiceAssistantStatus] = useState<"idle" | "loading" | "done">("idle");
  const [voiceVisualizerMode, setVoiceVisualizerMode] = useState<"idle" | "listening" | "speaking">("idle");
  const [voiceWaveformBars, setVoiceWaveformBars] = useState(IDLE_WAVEFORM);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSpokenReplyRef = useRef("");
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const playbackAnimationFrameRef = useRef<number | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function stopPlaybackWaveform() {
    if (playbackAnimationFrameRef.current !== null) {
      cancelAnimationFrame(playbackAnimationFrameRef.current);
      playbackAnimationFrameRef.current = null;
    }
    playbackAudioRef.current?.pause();
    playbackAudioRef.current = null;
    playbackAudioContextRef.current?.close();
    playbackAudioContextRef.current = null;
    setVoiceVisualizerMode("idle");
    setVoiceWaveformBars(IDLE_WAVEFORM);
  }

  useEffect(() => {
    if (!voiceAssistantOpen || !lastBotReply || !token) return;

    const text = lastBotReply.replace(/\s*(RESOLVED|UNRESOLVED)\s*/gi, "").trim();
    if (!text || lastSpokenReplyRef.current === text) return;

    let audioUrl: string | null = null;
    let cancelled = false;

    const speakReply = async () => {
      try {
        const res = await fetch(`${API}/voice/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        if (cancelled) return;
        audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(audio);
        const analyser = audioContext.createAnalyser();
        const buffer = new Uint8Array(analyser.frequencyBinCount);

        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.78;
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        playbackAudioRef.current = audio;
        playbackAudioContextRef.current = audioContext;
        setVoiceVisualizerMode("speaking");

        const tick = () => {
          analyser.getByteFrequencyData(buffer);
          setVoiceWaveformBars(buildPlaybackWaveformBars(buffer));
          playbackAnimationFrameRef.current = requestAnimationFrame(tick);
        };

        tick();

        audio.onended = () => {
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          stopPlaybackWaveform();
        };
        await audio.play();
      } catch {
        if (cancelled) return;
        stopPlaybackWaveform();
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
      }
    };

    lastSpokenReplyRef.current = text;
    speakReply();

    return () => {
      cancelled = true;
      window.speechSynthesis.cancel();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      stopPlaybackWaveform();
    };
  }, [lastBotReply, token, voiceAssistantOpen]);

  useEffect(() => {
    if (!voiceAssistantOpen) {
      stopPlaybackWaveform();
      setVoiceVisualizerMode("idle");
      setVoiceWaveformBars(IDLE_WAVEFORM);
      setVoiceAssistantStatus("idle");
    }
  }, [voiceAssistantOpen]);

  // Connect WebSocket when conversation starts
  useEffect(() => {
    if (!convId || !token) return;
    const ws = new WebSocket(`${WS_BASE}/ws/chat/${convId}?token=${token}`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "message" && data.sender === "agent") {
        setAgentOnline(true);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "agent",
          content: data.content,
          senderName: data.sender_name,
        }]);
      } else if (data.type === "system") {
        if (data.content.includes("joined")) setAgentOnline(true);
        if (data.content.includes("left")) setAgentOnline(false);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "bot", content: `ℹ️ ${data.content}` }]);
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [convId, token]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);
    if (voiceAssistantOpen) {
      setVoiceAssistantStatus("loading");
      setLastBotReply(undefined);
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);

    const botId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botId, role: "bot", content: "", isStreaming: true }]);

    try {
      const res = await fetch(`${API}/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, conversation_id: convId }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let botContent = "";
      let sentScore: number | undefined;
      let sentLabel: "positive" | "neutral" | "negative" | undefined;
      let meta: Meta = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.type === "start") {
            setConvId(payload.conversation_id);
          } else if (payload.type === "token") {
            botContent += payload.content;
            setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: botContent } : m));
          } else if (payload.type === "done") {
            sentScore = payload.sentiment_score;
            sentLabel = payload.sentiment_label;
            meta = { resolved: payload.resolved, ticketId: payload.ticket_id };
          }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === botId
          ? { ...m, isStreaming: false, sentimentScore: sentScore, sentimentLabel: sentLabel }
          : m
      ));
      setLastBotReply(botContent);
      setLastMeta(meta);
      if (voiceAssistantOpen) setVoiceAssistantStatus("done");
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === botId ? { ...m, content: "Sorry, something went wrong.", isStreaming: false } : m
      ));
      if (voiceAssistantOpen) {
        setLastBotReply("Sorry, something went wrong.");
        setVoiceAssistantStatus("done");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {voiceAssistantOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.26),rgba(8,15,30,0.99)_24%,rgba(2,6,23,1)_72%)]">
          <div className="pointer-events-none absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-6xl items-start justify-end px-8 py-8">
            <button
              onClick={() => setVoiceAssistantOpen(false)}
              className="rounded-full border border-white/15 bg-white/5 p-3 text-slate-100 transition hover:bg-white/10"
              title="Close voice assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center px-8 py-10">
            <div className="flex flex-col items-center justify-center gap-10">
              <div className="pointer-events-none relative flex h-[24rem] w-[24rem] items-center justify-center">
                <div className={`absolute inset-0 rounded-full border border-cyan-400/14 ${voiceVisualizerMode === "idle" ? "" : "animate-ping [animation-duration:3.2s]"}`} />
                <div className={`absolute inset-10 rounded-full border border-cyan-300/16 ${voiceVisualizerMode === "idle" ? "" : "animate-ping [animation-duration:2.4s]"}`} />

                <div className="relative flex h-72 w-72 items-center justify-center rounded-full border border-cyan-300/18 bg-[radial-gradient(circle_at_30%_30%,rgba(103,232,249,0.22),rgba(8,47,73,0.42)_45%,rgba(2,6,23,0.88)_72%)] shadow-[0_0_120px_rgba(34,211,238,0.2)] backdrop-blur-xl">
                  <div className="absolute inset-10 rounded-full border border-cyan-200/8" />
                <div className="flex items-end justify-center gap-3">
                  {voiceWaveformBars.map((value, index) => (
                  <span
                    key={index}
                    className="w-3 rounded-full bg-gradient-to-t from-cyan-500 via-cyan-300 to-white animate-pulse"
                    style={{ height: `${Math.max(36, Math.round(value * 176))}px`, animationDelay: `${index * 120}ms` }}
                  />
                ))}
                  </div>
                </div>
              </div>

              <div className="relative z-20 flex flex-col items-center gap-5 pointer-events-auto">
                <div className="rounded-full border border-cyan-400/20 bg-slate-950/55 p-3 shadow-[0_0_40px_rgba(34,211,238,0.18)]">
                  <VoiceButton
                    onTranscript={send}
                    disabled={sending}
                    size="large"
                    token={token}
                    onListeningStateChange={(listening) => {
                      if (listening) {
                        stopPlaybackWaveform();
                        setVoiceVisualizerMode("listening");
                      } else if (voiceVisualizerMode === "listening") {
                        setVoiceVisualizerMode("idle");
                      }
                    }}
                    onWaveformChange={(bars) => {
                      if (voiceVisualizerMode !== "speaking") {
                        setVoiceWaveformBars(bars);
                      }
                    }}
                  />
                </div>
              <div className="min-h-[72px] w-full max-w-xl">
                {voiceAssistantStatus === "loading" && (
                  <div className="rounded-3xl border border-cyan-400/15 bg-slate-950/45 px-6 py-4 text-center text-sm text-cyan-50/80">
                    <div className="mx-auto mb-3 flex w-fit items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 animate-pulse" />
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 animate-pulse [animation-delay:180ms]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 animate-pulse [animation-delay:360ms]" />
                    </div>
                    Generating response...
                  </div>
                )}
                {voiceAssistantStatus === "done" && lastBotReply && (
                  <div className="rounded-3xl border border-cyan-400/15 bg-slate-950/45 px-6 py-4 text-center text-sm leading-7 text-cyan-50/85">
                    {lastBotReply.replace(/\s*(RESOLVED|UNRESOLVED)\s*$/i, "")}
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center gap-3 border-b border-border px-6 py-4 ${voiceAssistantOpen ? "pointer-events-none opacity-0" : ""}`}>
        <div className="w-9 h-9 rounded-full bg-brand-500/20 flex items-center justify-center">
          <Bot className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <p className="font-semibold text-white">AI Support Agent</p>
          <p className="text-xs flex items-center gap-2">
            <span className="text-emerald-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Online · GPT-4o</span>
            {agentOnline && <span className="text-violet-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> Agent joined</span>}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto px-6 py-4 space-y-4 ${voiceAssistantOpen ? "pointer-events-none opacity-0" : ""}`}>
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-20">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Ask me anything — or use the mic for voice input.</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 w-full ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              m.role === "user" ? "bg-sky-500/30" : m.role === "agent" ? "bg-violet-500/30" : "bg-slate-700"
            }`}>
              {m.role === "user" ? <User className="w-4 h-4 text-sky-400" />
                : m.role === "agent" ? <Shield className="w-4 h-4 text-violet-400" />
                : <Bot className="w-4 h-4 text-slate-300" />}
            </div>
            <div className={`max-w-[75%] space-y-1 ${m.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              {m.role === "agent" && <p className="text-xs text-violet-400">{m.senderName || "Agent"}</p>}
              <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-sky-600 text-white rounded-tr-sm"
                  : m.role === "agent"
                  ? "bg-violet-700 text-white rounded-tl-sm"
                  : "bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm"
              } ${m.isStreaming ? "typing-cursor" : ""}`}>
                {(m.content || (m.isStreaming ? " " : "")).replace(/\s*(RESOLVED|UNRESOLVED)\s*$/i, "")}
              </div>
              {m.role === "user" && m.sentimentLabel && (
                <SentimentBadge label={m.sentimentLabel} score={m.sentimentScore} />
              )}
            </div>
          </div>
        ))}

        {/* Ticket created banner — only show when unresolved */}
        {lastMeta.resolved === false && lastMeta.ticketId && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertCircle className="w-4 h-4" /> Ticket #{lastMeta.ticketId} created — an agent will follow up
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={`border-t border-border px-6 py-4 ${voiceAssistantOpen ? "pointer-events-none opacity-0" : ""}`}>
        <div className="flex items-center gap-3">
          <VoiceButton onTranscript={t => { setInput(t); send(t); }} disabled={sending || voiceAssistantOpen} token={token} />
          <button
            onClick={() => setVoiceAssistantOpen(prev => !prev)}
            disabled={sending}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              voiceAssistantOpen
                ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-200"
                : "border-border bg-card text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200"
            } disabled:opacity-40`}
          >
            {voiceAssistantOpen ? <X className="w-4 h-4" /> : <AudioLines className="w-4 h-4" />}
            {voiceAssistantOpen ? "Exit Voice Assistant" : "Enter Voice Assistant"}
          </button>
          <input
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-500"
            placeholder="Type a message…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            disabled={sending}
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="w-10 h-10 bg-brand-500 hover:bg-brand-600 rounded-xl flex items-center justify-center transition disabled:opacity-40"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
