"use client";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface Props {
  data: { bucket_minutes: string; count: number }[];
}

export default function ResolutionHistogram({ data }: Props) {
  return (
    <Bar
      data={{
        labels: data.map(d => `${d.bucket_minutes} min`),
        datasets: [{
          label: "Tickets",
          data: data.map(d => d.count),
          backgroundColor: "rgba(245, 158, 11, 0.7)",
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
