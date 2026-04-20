"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertCircle, CheckCircle } from "lucide-react";
import SentimentBadge from "./SentimentBadge";
import VoiceButton from "./VoiceButton";
import { useAuth } from "@/context/AuthContext";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  sentimentScore?: number;
  sentimentLabel?: "positive" | "neutral" | "negative";
  isStreaming?: boolean;
}

interface Meta {
  resolved?: boolean;
  ticketId?: number | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatWindow() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [convId, setConvId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [lastBotReply, setLastBotReply] = useState<string | undefined>();
  const [lastMeta, setLastMeta] = useState<Meta>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);

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
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === botId ? { ...m, content: "Sorry, something went wrong.", isStreaming: false } : m
      ));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <div className="w-9 h-9 rounded-full bg-brand-500/20 flex items-center justify-center">
          <Bot className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <p className="font-semibold text-white">AI Support Agent</p>
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Online · GPT-4o
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-20">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Ask me anything — or use the mic for voice input.</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 w-full ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              m.role === "user" ? "bg-sky-500/30" : "bg-slate-700"
            }`}>
              {m.role === "user" ? <User className="w-4 h-4 text-brand-400" /> : <Bot className="w-4 h-4 text-slate-300" />}
            </div>
            <div className={`max-w-[75%] space-y-1 ${m.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-sky-600 text-white rounded-tr-sm"
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
      <div className="px-6 py-4 border-t border-border">
        <div className="flex items-center gap-3">
          <VoiceButton onTranscript={t => { setInput(t); send(t); }} botReply={lastBotReply} disabled={sending} token={token} />
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
