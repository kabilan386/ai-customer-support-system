"use client";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
  data: { category: string; count: number }[];
}

const COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

export default function CategoryPieChart({ data }: Props) {
  return (
    <Doughnut
      data={{
        labels: data.map(d => d.category),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: COLORS.slice(0, data.length),
          borderWidth: 0,
        }],
      }}
      options={{
        responsive: true,
        cutout: "65%",
        plugins: {
          legend: { position: "bottom", labels: { color: "#94a3b8", padding: 16 } },
        },
      }}
    />
  );
}
