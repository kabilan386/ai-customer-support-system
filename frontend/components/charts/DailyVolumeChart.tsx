"use client";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  data: { date: string; count: number }[];
}

export default function DailyVolumeChart({ data }: Props) {
  return (
    <Bar
      data={{
        labels: data.map(d => d.date),
        datasets: [{
          label: "Tickets",
          data: data.map(d => d.count),
          backgroundColor: "rgba(14, 165, 233, 0.7)",
          borderRadius: 6,
        }],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
        },
      }}
    />
  );
}
