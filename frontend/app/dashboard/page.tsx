"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import KPICards from "@/components/KPICards";
import dynamic from "next/dynamic";
import { LogOut, MessageSquare, BarChart3, Headphones, Download, RefreshCw } from "lucide-react";

const DailyVolumeChart = dynamic(() => import("@/components/charts/DailyVolumeChart"), { ssr: false });
const SentimentTrendChart = dynamic(() => import("@/components/charts/SentimentTrendChart"), { ssr: false });
const CategoryPieChart = dynamic(() => import("@/components/charts/CategoryPieChart"), { ssr: false });
const PeakHoursChart = dynamic(() => import("@/components/charts/PeakHoursChart"), { ssr: false });
const ResolutionHistogram = dynamic(() => import("@/components/charts/ResolutionHistogram"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AgentRow {
  agent_id: number;
  name: string;
  tickets_resolved: number;
  avg_resolution_minutes: number;
}

export default function DashboardPage() {
  const { token, role, name, logout, ready } = useAuth();
  const router = useRouter();
  const [kpi, setKpi] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [sentiment, setSentiment] = useState<any[]>([]);
  const [category, setCategory] = useState<any[]>([]);
  const [peaks, setPeaks] = useState<any[]>([]);
  const [histogram, setHistogram] = useState<any[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!token) { router.push("/"); return; }
    if (role === "customer") { router.push("/chat"); return; }
    fetchAll();
  }, [ready, token, role]);

  if (!ready) return null;

  async function fetchAll() {
    setLoading(true);
    try {
      const [k, d, s, c, p, h, a] = await Promise.all([
        apiFetch("/analytics/kpi", {}, token),
        apiFetch("/analytics/daily-volume", {}, token),
        apiFetch("/analytics/sentiment-trend", {}, token),
        apiFetch("/analytics/category-breakdown", {}, token),
        apiFetch("/analytics/peak-hours", {}, token),
        apiFetch("/analytics/resolution-histogram", {}, token),
        apiFetch("/analytics/agent-performance", {}, token),
      ]);
      setKpi(k); setDaily(d); setSentiment(s); setCategory(c);
      setPeaks(p); setHistogram(h); setAgents(a);
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    window.open(`${API}/tickets/export/csv`, "_blank");
  }

  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  );

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col py-6 px-4 shrink-0">
        <div className="flex items-center gap-2 mb-8">
          <Headphones className="w-6 h-6 text-brand-400" />
          <span className="font-bold text-white text-lg">AI Support</span>
        </div>
        <nav className="flex-1 space-y-1">
          <button
            onClick={() => router.push("/chat")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/40 text-sm transition"
          >
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-brand-500/10 text-brand-400 font-medium text-sm">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </div>
        </nav>
        <div className="border-t border-border pt-4 space-y-3">
          <div className="px-3">
            <p className="text-white text-sm font-medium truncate">{name}</p>
            <p className="text-slate-500 text-xs capitalize">{role}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 text-sm transition"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
            <p className="text-slate-400 text-sm mt-0.5">Live support performance metrics</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchAll}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-slate-300 hover:text-white text-sm transition"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-xl text-white text-sm transition"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500">Loading metrics…</div>
        ) : (
          <>
            <KPICards data={kpi} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ChartCard title="Ticket Volume (30 days)"><DailyVolumeChart data={daily} /></ChartCard>
              <ChartCard title="Sentiment Trend"><SentimentTrendChart data={sentiment} /></ChartCard>
              <ChartCard title="Category Breakdown"><CategoryPieChart data={category} /></ChartCard>
              <ChartCard title="Resolution Time Distribution"><ResolutionHistogram data={histogram} /></ChartCard>
            </div>

            <ChartCard title="Peak Support Hours">
              <PeakHoursChart data={peaks} />
            </ChartCard>

            {/* Agent Performance Table */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Agent Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-slate-400 text-left">
                      <th className="pb-3 font-medium">Agent</th>
                      <th className="pb-3 font-medium text-right">Tickets Resolved</th>
                      <th className="pb-3 font-medium text-right">Avg Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {agents.length === 0 ? (
                      <tr><td colSpan={3} className="py-6 text-center text-slate-500">No agent data yet</td></tr>
                    ) : agents.map(a => (
                      <tr key={a.agent_id} className="hover:bg-slate-700/20 transition">
                        <td className="py-3 text-white font-medium">{a.name}</td>
                        <td className="py-3 text-right text-slate-300">{a.tickets_resolved}</td>
                        <td className="py-3 text-right text-slate-300">{a.avg_resolution_minutes} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
