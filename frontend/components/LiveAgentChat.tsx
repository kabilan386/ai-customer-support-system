"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Shield, Info } from "lucide-react";
import SentimentBadge from "./SentimentBadge";

interface ChatMessage {
  type: "message" | "system" | "history";
  sender?: string;
  sender_name?: string;
  content: string;
  sentiment_label?: "positive" | "neutral" | "negative" | null;
  created_at?: string;
}

interface Props {
  convId: number;
  token: string;
  agentName: string;
}

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws");

export default function LiveAgentChat({ convId, token, agentName }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/chat/${convId}?token=${token}`);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (e) => {
      const data: ChatMessage = JSON.parse(e.data);
      setMessages(prev => [...prev, data]);
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    wsRef.current = ws;
    return () => ws.close();
  }, [convId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ content: text }));
    setInput("");
  }

  function senderIcon(sender?: string) {
    if (sender === "agent") return <Shield className="w-4 h-4 text-violet-400" />;
    if (sender === "bot") return <Bot className="w-4 h-4 text-slate-300" />;
    return <User className="w-4 h-4 text-sky-400" />;
  }

  function bubbleStyle(sender?: string) {
    if (sender === "agent") return "bg-violet-600 text-white rounded-tr-sm";
    if (sender === "bot") return "bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm";
    return "bg-sky-700 text-white rounded-tl-sm";
  }

  function avatarStyle(sender?: string) {
    if (sender === "agent") return "bg-violet-500/30";
    if (sender === "bot") return "bg-slate-700";
    return "bg-sky-500/20";
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-white">Conversation #{convId}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full ${connected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => {
          if (m.type === "system") return (
            <div key={i} className="flex items-center gap-2 justify-center">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-xs text-slate-500 italic">{m.content}</p>
            </div>
          );

          const isAgent = m.sender === "agent";
          return (
            <div key={i} className={`flex gap-2 ${isAgent ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${avatarStyle(m.sender)}`}>
                {senderIcon(m.sender)}
              </div>
              <div className={`max-w-[75%] flex flex-col ${isAgent ? "items-end" : "items-start"} gap-1`}>
                <p className="text-xs text-slate-500">{m.sender_name}</p>
                <div className={`rounded-2xl px-3 py-2 text-sm ${bubbleStyle(m.sender)}`}>
                  {m.content.replace(/\s*(RESOLVED|UNRESOLVED)\s*$/i, "")}
                </div>
                {m.sentiment_label && (
                  <SentimentBadge label={m.sentiment_label} />
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border flex gap-2">
        <input
          className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500"
          placeholder="Reply as agent…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          disabled={!connected}
        />
        <button
          onClick={sendMessage}
          disabled={!connected || !input.trim()}
          className="w-9 h-9 bg-violet-600 hover:bg-violet-700 rounded-xl flex items-center justify-center transition disabled:opacity-40"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
