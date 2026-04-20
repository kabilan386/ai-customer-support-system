import { Ticket, CheckCircle, Clock, TrendingDown } from "lucide-react";

interface KPI {
  total_tickets: number;
  resolution_rate: number;
  avg_response_time_seconds: number;
  negative_sentiment_pct: number;
}

interface Props { data: KPI | null }

const cards = [
  {
    key: "total_tickets" as const,
    label: "Total Tickets",
    icon: Ticket,
    format: (v: number) => v.toString(),
    color: "from-brand-700 to-brand-500",
    iconBg: "bg-brand-500/20",
    iconColor: "text-brand-400",
  },
  {
    key: "resolution_rate" as const,
    label: "Resolution Rate",
    icon: CheckCircle,
    format: (v: number) => `${v}%`,
    color: "from-emerald-900 to-emerald-700",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    key: "avg_response_time_seconds" as const,
    label: "Avg Response Time",
    icon: Clock,
    format: (v: number) => `${v}s`,
    color: "from-violet-900 to-violet-700",
    iconBg: "bg-violet-500/20",
    iconColor: "text-violet-400",
  },
  {
    key: "negative_sentiment_pct" as const,
    label: "Negative Sentiment",
    icon: TrendingDown,
    format: (v: number) => `${v}%`,
    color: "from-red-900 to-red-700",
    iconBg: "bg-red-500/20",
    iconColor: "text-red-400",
  },
];

export default function KPICards({ data }: Props) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(({ key, label, icon: Icon, format, iconBg, iconColor }) => (
        <div key={key} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-white mt-0.5">
              {data ? format(data[key]) : "—"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
