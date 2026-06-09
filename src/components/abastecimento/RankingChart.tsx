import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import type { RankedItem } from "@/lib/abastecimento/types";

const PALETTE_GOOD  = ["#34d399","#2dd4bf","#22d3ee","#60a5fa","#818cf8","#a78bfa","#c084fc","#e879f9","#f472b6","#fb7185"];
const PALETTE_BAD   = ["#ef4444","#f87171","#fb923c","#fbbf24","#facc15","#a3e635","#34d399","#2dd4bf","#22d3ee","#60a5fa"];

const tooltipStyle = {
  background: "rgba(10,13,26,0.98)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#e2e8f0",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

interface Props {
  title: string;
  items: RankedItem[];
  unit: string;
  invertColors?: boolean;
  pm?: boolean;
}

const RankingChart = ({ title, items, unit, invertColors, pm }: Props) => {
  const chartH = pm ? 340 : 260;
  const tick = { fontSize: pm ? 11 : 10, fill: "rgba(255,255,255,0.4)" };
  const palette = invertColors ? PALETTE_BAD : PALETTE_GOOD;

  const data = items.map(item => ({
    name: item.label.split(" ")[0],
    value: Number(item.value.toFixed(2)),
    placa: item.placa,
    tipo: item.tipoFrota,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border flex flex-col"
      style={{
        background: "rgba(13,16,31,0.96)",
        borderColor: "rgba(255,255,255,0.07)",
        padding: pm ? "1.5rem" : "1.2rem",
      }}
    >
      {/* Acento colorido */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: invertColors
            ? "linear-gradient(90deg, #ef4444, rgba(239,68,68,0.1))"
            : "linear-gradient(90deg, #34d399, rgba(52,211,153,0.1))",
        }}
      />

      <h3
        className="font-bold uppercase tracking-[0.14em] mb-4"
        style={{
          color: "rgba(255,255,255,0.55)",
          fontSize: pm ? "0.7rem" : "0.62rem",
        }}
      >
        {title}
      </h3>

      <div style={{ height: chartH, flex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis
              type="number"
              tick={tick}
              unit={` ${unit}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={tick}
              width={64}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              formatter={(value: number) => [`${value} ${unit}`, ""]}
              labelFormatter={(label) => {
                const item = data.find(d => d.name === label);
                return item ? `${label} · ${item.placa}` : label;
              }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={palette[i % palette.length]}
                  fillOpacity={1 - i * 0.06}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default RankingChart;
