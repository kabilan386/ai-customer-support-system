"use client";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler);

interface Props {
  data: { date: string; positive: number; neutral: number; negative: number }[];
}

export default function SentimentTrendChart({ data }: Props) {
  const labels = data.map(d => d.date);
  return (
    <Line
      data={{
        labels,
        datasets: [
          { label: "Positive", data: data.map(d => d.positive), borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.1)", tension: 0.4, fill: true },
          { label: "Neutral",  data: data.map(d => d.neutral),  borderColor: "#64748b", backgroundColor: "rgba(100,116,139,0.1)", tension: 0.4 },
          { label: "Negative", data: data.map(d => d.negative), borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)", tension: 0.4, fill: true },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
        },
      }}
    />
  );
}
