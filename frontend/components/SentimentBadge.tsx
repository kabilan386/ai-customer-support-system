interface Props {
  label: "positive" | "neutral" | "negative" | null;
  score?: number | null;
}

const config = {
  positive: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", emoji: "😊" },
  neutral:  { color: "bg-slate-500/20 text-slate-400 border-slate-500/30",   emoji: "😐" },
  negative: { color: "bg-red-500/20 text-red-400 border-red-500/30",         emoji: "😞" },
};

export default function SentimentBadge({ label, score }: Props) {
  if (!label) return null;
  const { color, emoji } = config[label];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${color}`}>
      {emoji} {label} {score !== undefined && score !== null ? `(${score.toFixed(2)})` : ""}
    </span>
  );
}
