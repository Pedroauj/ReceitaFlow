import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  highlight?: boolean;
  pm?: boolean;
  index?: number;
  subValue?: string;
}

// Mapeia classes Tailwind de cor para valores hex usáveis em style={}
const COLOR_MAP: Record<string, { hex: string; rgb: string }> = {
  "text-cyan-400":    { hex: "#22d3ee", rgb: "34,211,238" },
  "text-purple-400":  { hex: "#c084fc", rgb: "192,132,252" },
  "text-violet-300":  { hex: "#c4b5fd", rgb: "196,181,253" },
  "text-emerald-400": { hex: "#34d399", rgb: "52,211,153" },
  "text-emerald-500": { hex: "#10b981", rgb: "16,185,129" },
  "text-blue-400":    { hex: "#60a5fa", rgb: "96,165,250" },
  "text-red-400":     { hex: "#f87171", rgb: "248,113,113" },
  "text-red-500":     { hex: "#ef4444", rgb: "239,68,68" },
  "text-amber-400":   { hex: "#fbbf24", rgb: "251,191,36" },
};

const KpiCard = ({
  label, value, icon: Icon, color, highlight, pm, index = 0, subValue,
}: KpiCardProps) => {
  const c = COLOR_MAP[color] ?? { hex: "#a78bfa", rgb: "167,139,250" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border flex flex-col"
      style={{
        background: "rgba(13,16,31,0.96)",
        borderColor: highlight
          ? `rgba(${c.rgb},0.25)`
          : "rgba(255,255,255,0.07)",
        boxShadow: highlight
          ? `0 0 28px -8px rgba(${c.rgb},0.18)`
          : "none",
        padding: pm ? "1.5rem" : "1.1rem 1.2rem",
      }}
    >
      {/* Linha de acento no topo */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, rgba(${c.rgb},0.9), rgba(${c.rgb},0.1))`,
          opacity: highlight ? 1 : 0.5,
        }}
      />

      {/* Glow de fundo */}
      {highlight && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 20% 0%, rgba(${c.rgb},0.07), transparent 60%)`,
          }}
        />
      )}

      <div className="relative flex flex-col gap-2">
        {/* Ícone + label */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              background: `rgba(${c.rgb},0.12)`,
              width: pm ? "2.25rem" : "1.9rem",
              height: pm ? "2.25rem" : "1.9rem",
            }}
          >
            <Icon
              style={{ color: c.hex, width: pm ? "1.1rem" : "0.95rem", height: pm ? "1.1rem" : "0.95rem" }}
            />
          </div>
          <span
            className="font-semibold uppercase tracking-[0.14em] leading-none"
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: pm ? "0.68rem" : "0.62rem",
            }}
          >
            {label}
          </span>
        </div>

        {/* Valor principal */}
        <p
          className="font-black tracking-[-0.03em] leading-none tabular-nums"
          style={{
            color: highlight ? c.hex : "rgba(255,255,255,0.92)",
            fontSize: pm ? "1.85rem" : "1.4rem",
          }}
        >
          {value}
        </p>

        {/* Sub-valor */}
        {subValue && (
          <p
            className="font-medium leading-none"
            style={{ color: `rgba(${c.rgb},0.55)`, fontSize: "0.68rem" }}
          >
            {subValue}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default KpiCard;
