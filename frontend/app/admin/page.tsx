"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { LogOut, BarChart3, MessageSquare, Headphones, AlertTriangle, Clock, CheckCircle } from "lucide-react";

interface Ticket {
  id: number;
  title: string;
  category: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
}

const priorityBadge = {
  high:   "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low:    "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const statusIcon = {
  open:        <AlertTriangle className="w-3.5 h-3.5" />,
  in_progress: <Clock className="w-3.5 h-3.5" />,
  resolved:    <CheckCircle className="w-3.5 h-3.5" />,
  closed:      <CheckCircle className="w-3.5 h-3.5" />,
};

export default function AdminPage() {
  const { token, role, name, logout, ready } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!ready) return;
    if (!token) { router.push("/"); return; }
    if (role === "customer") { router.push("/chat"); return; }
    apiFetch("/tickets/", {}, token).then(setTickets).finally(() => setLoading(false));
  }, [ready, token, role]);

  if (!ready) return null;

  async function updateStatus(id: number, status: string) {
    await apiFetch(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }, token);
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: status as any } : t));
  }

  const filtered = filter === "all" ? tickets : tickets.filter(t => t.priority === filter || t.status === filter);

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
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
            <AlertTriangle className="w-4 h-4" /> Tickets
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

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Ticket Queue</h1>
            <p className="text-slate-400 text-sm mt-0.5">{tickets.length} total tickets</p>
          </div>
          <div className="flex gap-2">
            {["all", "high", "open", "in_progress", "resolved"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                  filter === f ? "bg-brand-500 text-white" : "bg-card border border-border text-slate-400 hover:text-white"
                }`}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-slate-500 text-center py-20">Loading tickets…</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ticket => (
              <div key={ticket.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${priorityBadge[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                    <span className="text-slate-500 text-xs">#{ticket.id}</span>
                    <span className="text-slate-500 text-xs">· {ticket.category}</span>
                  </div>
                  <p className="text-white text-sm font-medium truncate">{ticket.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{new Date(ticket.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1 text-slate-400 text-xs capitalize">
                    {statusIcon[ticket.status]} {ticket.status.replace("_", " ")}
                  </span>
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
            {filtered.length === 0 && (
              <div className="text-center text-slate-500 py-20">No tickets found for this filter.</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
