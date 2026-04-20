"use client";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  data: { hour: number; count: number }[];
}

export default function PeakHoursChart({ data }: Props) {
  const allHours = Array.from({ length: 24 }, (_, i) => i);
  const countMap = Object.fromEntries(data.map(d => [d.hour, d.count]));

  return (
    <Bar
      data={{
        labels: allHours.map(h => `${h}:00`),
        datasets: [{
          label: "Messages",
          data: allHours.map(h => countMap[h] ?? 0),
          backgroundColor: allHours.map(h => {
            const v = countMap[h] ?? 0;
            const max = Math.max(...data.map(d => d.count), 1);
            const alpha = 0.2 + (v / max) * 0.8;
            return `rgba(139, 92, 246, ${alpha})`;
          }),
          borderRadius: 4,
        }],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#94a3b8", maxRotation: 45 }, grid: { color: "#1e293b" } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
        },
      }}
    />
  );
}
