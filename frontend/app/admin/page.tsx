"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import dynamic from "next/dynamic";
import { LogOut, BarChart3, MessageSquare, Headphones, AlertTriangle, Clock, CheckCircle, Users } from "lucide-react";

const LiveAgentChat = dynamic(() => import("@/components/LiveAgentChat"), { ssr: false });

interface Ticket {
  id: number;
  title: string;
  category: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
}

interface OpenConversation {
  ticket_id: number;
  conversation_id: number;
  title: string;
  priority: string;
  status: string;
  customer_name: string;
  created_at: string;
}

const priorityBadge: Record<string, string> = {
  high:   "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low:    "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function AdminPage() {
  const { token, role, name, logout, ready } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openConvs, setOpenConvs] = useState<OpenConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tickets" | "live">("live");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!ready) return;
    if (!token) { router.push("/"); return; }
    if (role === "customer") { router.push("/chat"); return; }
    Promise.all([
      apiFetch("/tickets/", {}, token).catch(() => []),
      apiFetch("/tickets/open-conversations", {}, token).catch(() => []),
    ]).then(([t, oc]) => { setTickets(t); setOpenConvs(oc); }).finally(() => setLoading(false));
  }, [ready, token, role]);

  if (!ready) return null;

  async function updateStatus(id: number, status: string) {
    await apiFetch(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }, token);
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: status as any } : t));
  }

  const filtered = filter === "all" ? tickets : tickets.filter(t => t.priority === filter || t.status === filter);

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col py-6 px-4 shrink-0">
        <div className="flex items-center gap-2 mb-8">
          <Headphones className="w-6 h-6 text-brand-400" />
          <span className="font-bold text-white text-lg">AI Support</span>
        </div>
        <nav className="flex-1 space-y-1">
          <button onClick={() => router.push("/chat")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white text-sm transition">
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
          <button onClick={() => router.push("/dashboard")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white text-sm transition">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </button>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-brand-500/10 text-brand-400 font-medium text-sm">
            <AlertTriangle className="w-4 h-4" /> Tickets & Live Chat
          </div>
        </nav>
        <div className="border-t border-border pt-4 space-y-3">
          <div className="px-3">
            <p className="text-white text-sm font-medium truncate">{name}</p>
            <p className="text-slate-500 text-xs capitalize">{role}</p>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 text-sm transition">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setTab("live")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${tab === "live" ? "bg-violet-600 text-white" : "bg-card border border-border text-slate-400 hover:text-white"}`}
            >
              <Users className="w-4 h-4" /> Live Conversations
              {openConvs.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{openConvs.length}</span>}
            </button>
            <button
              onClick={() => setTab("tickets")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${tab === "tickets" ? "bg-brand-500 text-white" : "bg-card border border-border text-slate-400 hover:text-white"}`}
            >
              <AlertTriangle className="w-4 h-4" /> Ticket Queue
            </button>
          </div>

          {loading ? (
            <div className="text-slate-500 text-center py-20">Loading…</div>
          ) : tab === "live" ? (
            <div className="space-y-3">
              {openConvs.length === 0 ? (
                <div className="text-center text-slate-500 py-20">No open conversations right now.</div>
              ) : openConvs.map(oc => (
                <div
                  key={oc.conversation_id}
                  onClick={() => setActiveConvId(oc.conversation_id)}
                  className={`bg-card border rounded-xl p-4 cursor-pointer transition ${activeConvId === oc.conversation_id ? "border-violet-500" : "border-border hover:border-slate-500"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priorityBadge[oc.priority] || priorityBadge.low}`}>{oc.priority}</span>
                    <span className="text-slate-500 text-xs">{new Date(oc.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-white text-sm font-medium truncate">{oc.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Customer: {oc.customer_name}</p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4 flex-wrap">
                {["all", "high", "open", "in_progress", "resolved"].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${filter === f ? "bg-brand-500 text-white" : "bg-card border border-border text-slate-400 hover:text-white"}`}>
                    {f.replace("_", " ")}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {filtered.map(ticket => (
                  <div key={ticket.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${priorityBadge[ticket.priority]}`}>{ticket.priority}</span>
                        <span className="text-slate-500 text-xs">#{ticket.id} · {ticket.category}</span>
                      </div>
                      <p className="text-white text-sm font-medium truncate">{ticket.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 text-xs capitalize">{ticket.status.replace("_", " ")}</span>
                      {ticket.status !== "resolved" && ticket.status !== "closed" && (
                        <button
                          onClick={() => updateStatus(ticket.id, ticket.status === "open" ? "in_progress" : "resolved")}
                          className="px-3 py-1 bg-brand-500/20 hover:bg-brand-500/40 border border-brand-500/30 text-brand-400 text-xs rounded-lg transition"
                        >
                          {ticket.status === "open" ? "Claim" : "Resolve"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <div className="text-center text-slate-500 py-20">No tickets found.</div>}
              </div>
            </>
          )}
        </div>

        {/* Right panel — live chat */}
        {activeConvId && token && (
          <div className="w-96 border-l border-border flex flex-col">
            <LiveAgentChat convId={activeConvId} token={token} agentName={name || "Agent"} />
          </div>
        )}
        {!activeConvId && tab === "live" && (
          <div className="w-96 border-l border-border flex items-center justify-center text-slate-500 text-sm">
            Select a conversation to join
          </div>
        )}
      </div>
    </div>
  );
}
