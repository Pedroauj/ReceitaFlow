import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, Fuel, Truck, Star, Sparkles } from "lucide-react";
import type { Insight } from "@/lib/abastecimento/types";

const iconMap = {
  trend: TrendingUp,
  alert: AlertTriangle,
  fuel:  Fuel,
  truck: Truck,
  star:  Star,
};

const severityConfig = {
  info:     { border: "rgba(96,165,250,0.2)",  bg: "rgba(96,165,250,0.06)",  text: "#93c5fd", bar: "#60a5fa" },
  warning:  { border: "rgba(251,191,36,0.2)",  bg: "rgba(251,191,36,0.06)",  text: "#fcd34d", bar: "#fbbf24" },
  critical: { border: "rgba(248,113,113,0.2)", bg: "rgba(248,113,113,0.06)", text: "#fca5a5", bar: "#f87171" },
  success:  { border: "rgba(52,211,153,0.2)",  bg: "rgba(52,211,153,0.06)",  text: "#6ee7b7", bar: "#34d399" },
};

interface Props {
  insights: Insight[];
  pm?: boolean;
}

const InsightsPanel = ({ insights, pm }: Props) => {
  if (insights.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="relative overflow-hidden rounded-2xl border"
      style={{
        background: "rgba(13,16,31,0.96)",
        borderColor: "rgba(255,255,255,0.07)",
        padding: pm ? "1.75rem" : "1.25rem",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="flex items-center justify-center rounded-xl"
          style={{ background: "rgba(167,139,250,0.12)", width: "1.9rem", height: "1.9rem" }}
        >
          <Sparkles style={{ color: "#a78bfa", width: "0.95rem", height: "0.95rem" }} />
        </div>
        <h3
          className="font-bold uppercase tracking-[0.14em]"
          style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.62rem" }}
        >
          Insights da Operação
        </h3>
      </div>

      {/* Grid de insights */}
      <div className={`grid gap-3 ${pm ? "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
        {insights.map((insight, i) => {
          const Icon = iconMap[insight.icon] ?? TrendingUp;
          const cfg  = severityConfig[insight.severity];

          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
              className="relative flex items-start gap-3 rounded-xl overflow-hidden"
              style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                padding: "0.85rem 1rem",
              }}
            >
              {/* Barra lateral */}
              <div
                className="absolute inset-y-0 left-0 w-[3px] rounded-r"
                style={{ background: cfg.bar }}
              />
              <div
                className="flex items-center justify-center rounded-lg shrink-0 mt-0.5"
                style={{ background: `${cfg.bar}20`, width: "1.6rem", height: "1.6rem" }}
              >
                <Icon style={{ color: cfg.text, width: "0.8rem", height: "0.8rem" }} />
              </div>
              <p
                className="leading-relaxed font-medium"
                style={{ color: cfg.text, fontSize: pm ? "0.8rem" : "0.72rem" }}
              >
                {insight.text}
              </p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default InsightsPanel;
