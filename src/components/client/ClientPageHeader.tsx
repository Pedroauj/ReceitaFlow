import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface InfoCard {
  label: string;
  value: string;
}

interface ClientPageHeaderProps {
  badgeIcon?: LucideIcon;
  badgeLabel: string;
  title: string;
  description: string;
  infoCards?: InfoCard[];
}

const ClientPageHeader = ({
  badgeIcon: BadgeIcon,
  badgeLabel,
  title,
  description,
  infoCards,
}: ClientPageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="mb-7"
    >
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(19,27,52,0.96)_0%,rgba(10,14,28,0.98)_45%,rgba(7,10,20,1)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_28%)]" />

        <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate("/clientes")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400 transition-all duration-200 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                {BadgeIcon && <BadgeIcon className="h-3.5 w-3.5" />}
                {badgeLabel}
              </div>

              <h1 className="text-[28px] font-semibold leading-none tracking-tight text-white lg:text-[32px]">
                {title}
              </h1>

              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-400">
                {description}
              </p>
            </div>
          </div>

          {infoCards && infoCards.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[420px]">
              {infoCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/8 bg-white/[0.04] p-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    {card.label}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-white">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ClientPageHeader;
