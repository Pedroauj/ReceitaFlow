import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Table2 } from "lucide-react";
import type { VehicleRecord } from "@/lib/abastecimento/types";

const fmt    = (v: number) => v.toLocaleString("pt-BR");
const fmtKmL = (v: number) => v.toFixed(2);
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type SortKey =
  | "motorista" | "placa" | "tipoFrota" | "km" | "litros"
  | "mediaKmL"  | "metaKmL" | "ganhoPerda" | "eficiencia" | "custoEstimado";

interface Props {
  records: VehicleRecord[];
  pm?: boolean;
}

const PAGE_SIZES = [25, 50, 100];

const DetailedTable = ({ records, pm }: Props) => {
  const [search,   setSearch]   = useState("");
  const [sortKey,  setSortKey]  = useState<SortKey>("eficiencia");
  const [sortAsc,  setSortAsc]  = useState(false);
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r =>
      r.motorista.toLowerCase().includes(q) ||
      r.placa.toLowerCase().includes(q) ||
      r.tipoFrota.toLowerCase().includes(q)
    );
  }, [records, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string") return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const paginated  = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
    setPage(1);
  };

  const statusBadge = (eff: number) => {
    if (eff >= 103) return { text: "Acima",  bg: "rgba(52,211,153,0.12)",  color: "#34d399", border: "rgba(52,211,153,0.25)"  };
    if (eff >= 97)  return { text: "Na meta", bg: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "rgba(167,139,250,0.25)" };
    return              { text: "Abaixo", bg: "rgba(248,113,113,0.12)", color: "#f87171", border: "rgba(248,113,113,0.25)" };
  };

  const SortTh = ({ label, k, right }: { label: string; k: SortKey; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors hover:text-white/80 ${right ? "text-right" : "text-left"}`}
      style={{ color: sortKey === k ? "rgba(167,139,250,0.9)" : "rgba(255,255,255,0.35)" }}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown style={{ width: "0.65rem", height: "0.65rem", opacity: sortKey === k ? 1 : 0.4 }} />
      </span>
    </th>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="relative overflow-hidden rounded-2xl border flex flex-col"
      style={{
        background: "rgba(13,16,31,0.96)",
        borderColor: "rgba(255,255,255,0.07)",
      }}
    >
      {/* Acento topo */}
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: "linear-gradient(90deg,#818cf8,rgba(129,140,248,0.1))" }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-xl" style={{ background: "rgba(129,140,248,0.12)", width: "1.9rem", height: "1.9rem" }}>
            <Table2 style={{ color: "#818cf8", width: "0.95rem", height: "0.95rem" }} />
          </div>
          <div>
            <h3 className="font-bold uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.62rem" }}>
              Dados Detalhados
            </h3>
            <p className="font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.72rem" }}>
              {sorted.length} registros
            </p>
          </div>
        </div>

        {!pm && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)", width: "0.85rem", height: "0.85rem" }} />
            <input
              type="text"
              placeholder="Buscar motorista, placa ou frota..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="h-9 rounded-xl pl-8 pr-4 text-xs font-medium outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.8)",
                width: "16rem",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.4)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.35)" }}>Motorista</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.35)" }}>Placa</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.35)" }}>Frota</th>
              <SortTh label="KM"        k="km"           right />
              <SortTh label="Litros"    k="litros"       right />
              <SortTh label="Média"     k="mediaKmL"     right />
              <SortTh label="Meta"      k="metaKmL"      right />
              <SortTh label="G/P (L)"   k="ganhoPerda"   right />
              <SortTh label="Efic."     k="eficiencia"   right />
              <SortTh label="Custo"     k="custoEstimado" right />
              <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.35)" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => {
              const st = statusBadge(r.eficiencia);
              const isEven = i % 2 === 0;
              return (
                <tr
                  key={r.id}
                  style={{
                    background: isEven ? "rgba(255,255,255,0.01)" : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = isEven ? "rgba(255,255,255,0.01)" : "transparent")}
                >
                  <td className="px-3 py-2.5 text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.motorista}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono font-bold" style={{ color: "rgba(167,139,250,0.85)" }}>
                    {r.placa}
                  </td>
                  <td className="px-3 py-2.5 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {r.tipoFrota}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {fmt(r.km)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {fmt(r.litros)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-bold tabular-nums" style={{ color: r.mediaKmL >= r.metaKmL ? "#34d399" : "#f87171" }}>
                    {fmtKmL(r.mediaKmL)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {fmtKmL(r.metaKmL)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-bold tabular-nums" style={{ color: r.ganhoPerda >= 0 ? "#34d399" : "#f87171" }}>
                    {r.ganhoPerda >= 0 ? "+" : ""}{r.ganhoPerda.toFixed(0)} L
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-bold tabular-nums" style={{ color: r.eficiencia >= 100 ? "#34d399" : "#f87171" }}>
                    {r.eficiencia.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] tabular-nums" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {fmtBRL(r.custoEstimado)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border"
                      style={{ background: st.bg, color: st.color, borderColor: st.border }}
                    >
                      {st.text}
                    </span>
                  </td>
                </tr>
              );
            })}

            {paginated.length === 0 && (
              <tr>
                <td colSpan={11} className="px-5 py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Nenhum resultado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div
        className="flex items-center justify-between gap-4 flex-wrap px-5 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Registros por página */}
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>Linhas</span>
          {PAGE_SIZES.map(s => (
            <button
              key={s}
              onClick={() => { setPageSize(s); setPage(1); }}
              className="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all"
              style={{
                background: pageSize === s ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${pageSize === s ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.07)"}`,
                color: pageSize === s ? "#a78bfa" : "rgba(255,255,255,0.45)",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Contador + navegação */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] tabular-nums" style={{ color: "rgba(255,255,255,0.35)" }}>
            {Math.min((safePage - 1) * pageSize + 1, sorted.length)}–{Math.min(safePage * pageSize, sorted.length)} de {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-all disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <ChevronLeft style={{ width: "0.9rem", height: "0.9rem", color: "rgba(255,255,255,0.6)" }} />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (safePage <= 3) p = i + 1;
              else if (safePage >= totalPages - 2) p = totalPages - 4 + i;
              else p = safePage - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: safePage === p ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${safePage === p ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.07)"}`,
                    color: safePage === p ? "#a78bfa" : "rgba(255,255,255,0.45)",
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-all disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <ChevronRight style={{ width: "0.9rem", height: "0.9rem", color: "rgba(255,255,255,0.6)" }} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DetailedTable;
