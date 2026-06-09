import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Users, Truck, Droplets, Leaf, DollarSign,
  Maximize2, Minimize2, Gauge, Fuel, CalendarDays,
  Sparkles, RefreshCw, AlertCircle, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePresentationMode } from "@/contexts/PresentationModeContext";

import {
  computeGlobalKpis, computeFleetSummaries, filterByFleetType,
  rankByConsumption, rankByEfficiency, computeEfficiencyDistribution,
  computeRecordHighlights, generateInsights,
} from "@/lib/abastecimento";
import type { VehicleRecord, TimeSeriesPoint } from "@/lib/abastecimento";
import { fetchAbastecimento } from "@/lib/dwApi";
import type { AbastecimentoRow } from "@/lib/dwApi";

import KpiCard from "@/components/abastecimento/KpiCard";
import FleetComparison from "@/components/abastecimento/FleetComparison";
import TimeSeriesChart from "@/components/abastecimento/TimeSeriesChart";
import RankingChart from "@/components/abastecimento/RankingChart";
import InsightsPanel from "@/components/abastecimento/InsightsPanel";
import EfficiencyDonut from "@/components/abastecimento/EfficiencyDonut";
import GainLossBlock from "@/components/abastecimento/GainLossBlock";
import DetailedTable from "@/components/abastecimento/DetailedTable";

// ─── Formatação ───────────────────────────────────────────────────────────────
const fmtNum = (v: number) => v.toLocaleString("pt-BR");
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ─── Datas padrão ─────────────────────────────────────────────────────────────
const hoje       = new Date();
const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
const toInputDate = (d: Date) => d.toISOString().split("T")[0];

// ─── Conversão DW → VehicleRecord ────────────────────────────────────────────
function toVehicleRecord(row: AbastecimentoRow, idx: number): VehicleRecord {
  const quanti  = row.quanti ?? 0;
  const media   = row.media  ?? 0;
  const medfab  = row.medfab && row.medfab > 0 ? row.medfab : media;
  const km      = row.atukmt != null && row.ultkmt != null
    ? Math.max(row.atukmt - row.ultkmt, 0)
    : media * quanti;
  const ganhoPerda = medfab > 0 ? (media - medfab) * quanti : 0;
  const eficiencia = medfab > 0 ? (media / medfab) * 100 : 100;

  return {
    id:           String(row.codaba ?? idx),
    placa:        String(row.veiculo ?? "—"),
    motorista:    row.motorista ?? "—",
    tipoFrota:    row.frota ?? "Outros",
    km, litros: quanti, mediaKmL: media, metaKmL: medfab,
    ganhoPerda, eficiencia,
    custoEstimado: row.vlrtot ?? 0,
    periodo:      row.datref ? row.datref.substring(0, 7) : "",
  };
}

// ─── Série temporal ───────────────────────────────────────────────────────────
function buildTimeSeries(rows: AbastecimentoRow[]): TimeSeriesPoint[] {
  const map = new Map<string, { litros: number; custo: number; km: number }>();
  for (const r of rows) {
    if (!r.datref) continue;
    const periodo = r.datref.substring(0, 7);
    const entry   = map.get(periodo) ?? { litros: 0, custo: 0, km: 0 };
    entry.litros += r.quanti ?? 0;
    entry.custo  += r.vlrtot ?? 0;
    entry.km     += r.atukmt != null && r.ultkmt != null
      ? Math.max(r.atukmt - r.ultkmt, 0)
      : (r.media ?? 0) * (r.quanti ?? 0);
    map.set(periodo, entry);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, v]) => ({
      periodo,
      litros: v.litros,
      kmL:    v.litros > 0 ? v.km / v.litros : 0,
      custoEstimado: v.custo,
    }));
}

// ─── Componente ───────────────────────────────────────────────────────────────
const MediasAbastecimento = () => {
  const [dataInicio, setDataInicio] = useState(toInputDate(primeiroDia));
  const [dataFim,    setDataFim]    = useState(toInputDate(hoje));
  const [activeTab,  setActiveTab]  = useState("Geral");
  const [isLoading,  setIsLoading]  = useState(false);
  const [erro,       setErro]       = useState<string | null>(null);
  const [rawRows,    setRawRows]    = useState<AbastecimentoRow[]>([]);
  const [hasLoaded,  setHasLoaded]  = useState(false);
  const [filterOpen, setFilterOpen] = useState(true);

  const { isPresentationMode, togglePresentationMode } = usePresentationMode();
  const pm = isPresentationMode;

  // ── Busca DW ─────────────────────────────────────────────────────────────
  const handleAtualizar = useCallback(async () => {
    setIsLoading(true);
    setErro(null);
    try {
      const res  = await fetchAbastecimento({ dataInicio, dataFim });
      const rows = res.data ?? [];
      setRawRows(rows);
      setHasLoaded(true);
      setFilterOpen(false);
      if (rows.length === 0) toast.warning("Nenhum registro no período.");
      else toast.success(`${rows.length} registros carregados.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar dados.";
      setErro(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [dataInicio, dataFim]);

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const allRecords    = useMemo<VehicleRecord[]>(() => rawRows.map(toVehicleRecord), [rawRows]);
  const timeSeries    = useMemo<TimeSeriesPoint[]>(() => buildTimeSeries(rawRows), [rawRows]);
  const filteredRecords = useMemo(() => filterByFleetType(allRecords, activeTab), [allRecords, activeTab]);
  const globalKpis    = useMemo(() => computeGlobalKpis(filteredRecords),      [filteredRecords]);
  const fleetSummaries = useMemo(() => computeFleetSummaries(allRecords),      [allRecords]);
  const effDist       = useMemo(() => computeEfficiencyDistribution(filteredRecords), [filteredRecords]);
  const highlights    = useMemo(() => computeRecordHighlights(filteredRecords),  [filteredRecords]);
  const insights      = useMemo(() => generateInsights(filteredRecords, fleetSummaries, globalKpis, effDist), [filteredRecords, fleetSummaries, globalKpis, effDist]);
  const topConsumption = useMemo(() => rankByConsumption(filteredRecords, 10),  [filteredRecords]);
  const bestEfficiency = useMemo(() => rankByEfficiency(filteredRecords, true, 10),  [filteredRecords]);
  const worstEfficiency = useMemo(() => rankByEfficiency(filteredRecords, false, 10), [filteredRecords]);
  const availableTypes  = useMemo(() => ["Geral", ...new Set(allRecords.map(r => r.tipoFrota))], [allRecords]);

  const kpis = [
    { label: "Total de Diesel",   value: `${fmtNum(Math.round(globalKpis.totalDiesel))} L`, icon: Droplets,  color: "text-cyan-400",    highlight: true },
    { label: "Total de KM",       value: fmtNum(Math.round(globalKpis.totalKm)),             icon: Truck,     color: "text-purple-400" },
    { label: "Média Geral",       value: `${globalKpis.mediaGeral.toFixed(2)} km/l`,         icon: TrendingUp, color: "text-violet-300",  highlight: true, subValue: "Ponderada por KM" },
    { label: "Eficiência Geral",  value: `${globalKpis.eficienciaGeral.toFixed(1)}%`,        icon: Gauge,     color: "text-violet-300",  highlight: true },
    { label: "Economia Total",    value: `+${fmtNum(Math.round(globalKpis.ganhoTotal))} L`,  icon: Leaf,      color: "text-emerald-400", highlight: true },
    { label: "Custo Total",       value: fmtBRL(globalKpis.custoTotal),                      icon: DollarSign, color: "text-violet-300" },
    { label: "Veículos",          value: String(globalKpis.totalVeiculos),                   icon: Truck,     color: "text-blue-400" },
    { label: "Motoristas",        value: String(globalKpis.totalMotoristas),                 icon: Users,     color: "text-blue-400" },
  ];

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "linear-gradient(160deg, rgba(7,8,20,1) 0%, rgba(10,12,28,1) 100%)" }}
    >
      {/* Atmosfera */}
      <div className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(139,92,246,0.12), transparent 60%)" }} />
      <div className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(ellipse 50% 30% at 100% 100%, rgba(34,211,238,0.05), transparent 60%)" }} />

      <div className="relative mx-auto w-full max-w-[1600px] space-y-5 px-4 py-6 lg:px-6">

        {/* ── HERO ── */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-[28px] border flex-1"
            style={{
              background: "linear-gradient(135deg, rgba(19,22,46,0.98), rgba(10,12,28,0.99))",
              borderColor: "rgba(139,92,246,0.15)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at top left, rgba(139,92,246,0.1), transparent 40%)" }} />
            <div className="relative p-6 lg:p-8">
              <div
                className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                style={{ background: "rgba(139,92,246,0.1)", borderColor: "rgba(139,92,246,0.25)", color: "rgba(196,181,253,0.8)", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                <Sparkles style={{ width: "0.7rem", height: "0.7rem" }} />
                Painel Executivo · Frota
              </div>

              <AnimatePresence mode="wait">
                {pm ? (
                  <motion.div key="pm" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <h1 className="text-3xl font-black tracking-[-0.03em] text-white lg:text-4xl">Desempenho estratégico de abastecimento da frota</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Leitura consolidada da operação para apresentação executiva, com foco em eficiência, consumo, custo e oportunidade de economia.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="normal" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <h1 className="text-3xl font-black tracking-[-0.03em] text-white lg:text-4xl">Médias de Abastecimento</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Performance de consumo da frota — eficiência, custo e ranking de veículos em um painel executivo completo.
                    </p>
                    {hasLoaded && allRecords.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
                          style={{ background: "rgba(52,211,153,0.1)", borderColor: "rgba(52,211,153,0.25)", color: "#34d399" }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {allRecords.length} registros · {dataInicio} a {dataFim}
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Botões direita */}
          <div className="flex shrink-0 items-center gap-2 self-start">
            {hasLoaded && !pm && (
              <button
                onClick={() => setFilterOpen(v => !v)}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-all"
                style={{
                  background: filterOpen ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)",
                  borderColor: filterOpen ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)",
                  color: filterOpen ? "#c4b5fd" : "rgba(255,255,255,0.5)",
                }}
              >
                <CalendarDays style={{ width: "1rem", height: "1rem" }} />
                Filtros
                <ChevronDown style={{ width: "0.9rem", height: "0.9rem", transition: "transform 0.3s", transform: filterOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>
            )}
            <button
              onClick={togglePresentationMode}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-all"
              style={{
                background: pm ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.03)",
                borderColor: pm ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)",
                color: pm ? "#c4b5fd" : "rgba(255,255,255,0.5)",
                boxShadow: pm ? "0 0 24px -8px rgba(139,92,246,0.45)" : "none",
              }}
            >
              {pm ? <Minimize2 style={{ width: "1rem", height: "1rem" }} /> : <Maximize2 style={{ width: "1rem", height: "1rem" }} />}
              {pm ? "Sair da apresentação" : "Modo apresentação"}
            </button>
          </div>
        </div>

        {/* ── PAINEL DE FILTROS ── */}
        <AnimatePresence>
          {!pm && filterOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div
                className="rounded-2xl border p-5"
                style={{
                  background: "rgba(13,16,31,0.98)",
                  borderColor: "rgba(255,255,255,0.07)",
                }}
              >
                <p
                  className="mb-4 font-bold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.62rem" }}
                >
                  Período de análise
                </p>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.35)" }}>
                      <CalendarDays style={{ width: "0.75rem", height: "0.75rem" }} />
                      Início
                    </label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={e => setDataInicio(e.target.value)}
                      className="h-10 rounded-xl px-3 text-sm font-medium outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.8)",
                        minWidth: "160px",
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.35)" }}>
                      <CalendarDays style={{ width: "0.75rem", height: "0.75rem" }} />
                      Fim
                    </label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={e => setDataFim(e.target.value)}
                      className="h-10 rounded-xl px-3 text-sm font-medium outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.8)",
                        minWidth: "160px",
                      }}
                    />
                  </div>

                  <button
                    onClick={handleAtualizar}
                    disabled={isLoading}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border px-5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: "linear-gradient(180deg, #f3b633, #d89614)",
                      borderColor: "rgba(243,182,51,0.4)",
                      color: "#18120a",
                      boxShadow: isLoading ? "none" : "0 8px 24px -8px rgba(243,182,51,0.6)",
                    }}
                  >
                    <RefreshCw style={{ width: "0.9rem", height: "0.9rem", animation: isLoading ? "spin 1s linear infinite" : "none" }} />
                    {isLoading ? "Carregando..." : hasLoaded ? "Atualizar" : "Carregar dados"}
                  </button>
                </div>

                {erro && (
                  <div
                    className="mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
                    style={{ background: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.2)", color: "#fca5a5" }}
                  >
                    <AlertCircle style={{ width: "1rem", height: "1rem", shrink: 0 }} />
                    {erro}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CONTEÚDO ── */}
        {!hasLoaded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-4 rounded-2xl border py-20 text-center"
            style={{ background: "rgba(13,16,31,0.6)", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl border"
              style={{ background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.2)" }}
            >
              <Fuel style={{ color: "#fbbf24", width: "1.75rem", height: "1.75rem" }} />
            </div>
            <div>
              <p className="text-base font-bold text-white/60">Nenhum dado carregado</p>
              <p className="mt-1 text-sm text-white/30">Selecione o período e clique em "Carregar dados"</p>
            </div>
          </motion.div>
        )}

        {hasLoaded && (
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {allRecords.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-16 text-center"
                style={{ background: "rgba(13,16,31,0.6)", borderColor: "rgba(255,255,255,0.06)" }}
              >
                <AlertCircle style={{ color: "rgba(255,255,255,0.3)", width: "2rem", height: "2rem" }} />
                <p className="text-sm text-white/40">Nenhum abastecimento encontrado no período.</p>
              </div>
            ) : (
              <>
                {/* Selector de frota */}
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <h2 className="text-lg font-black tracking-[-0.02em] text-white">Leitura consolidada</h2>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {activeTab === "Geral" ? "Todas as frotas" : activeTab}
                    </p>
                  </div>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList
                      className="h-auto flex-wrap p-1 rounded-2xl"
                      style={{ background: "rgba(13,16,31,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      {availableTypes.map(t => (
                        <TabsTrigger
                          key={t}
                          value={t}
                          className="rounded-xl px-3 py-2 text-xs font-bold"
                        >
                          {t}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {/* KPIs principais */}
                <div className={`grid gap-3 ${pm ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-8" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"}`}>
                  {kpis.map((kpi, i) => (
                    <KpiCard key={kpi.label} {...kpi} pm={pm} index={i} />
                  ))}
                </div>

                {/* Insights */}
                <InsightsPanel insights={insights} pm={pm} />

                {/* Destaques (6 cards) */}
                <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6`}>
                  {highlights.worstEfficiency && (
                    <KpiCard label="Pior Média"     value={`${highlights.worstEfficiency.mediaKmL.toFixed(2)} km/l`}     subValue={highlights.worstEfficiency.placa}     icon={TrendingUp} color="text-red-400"     pm={pm} index={0} />
                  )}
                  {highlights.bestEfficiency && (
                    <KpiCard label="Melhor Média"   value={`${highlights.bestEfficiency.mediaKmL.toFixed(2)} km/l`}      subValue={highlights.bestEfficiency.placa}      icon={TrendingUp} color="text-emerald-400" pm={pm} index={1} />
                  )}
                  {highlights.highestConsumption && (
                    <KpiCard label="Maior Consumo"  value={`${Math.round(highlights.highestConsumption.litros)} L`}       subValue={highlights.highestConsumption.placa}  icon={Fuel}       color="text-red-400"     pm={pm} index={2} />
                  )}
                  {highlights.highestKm && (
                    <KpiCard label="Maior KM"       value={fmtNum(Math.round(highlights.highestKm.km))}                   subValue={highlights.highestKm.placa}           icon={Truck}      color="text-blue-400"    pm={pm} index={3} />
                  )}
                  {highlights.biggestLoss && (
                    <KpiCard label="Maior Perda"    value={`-${fmtNum(Math.abs(highlights.biggestLoss.ganhoPerda))} L`}   subValue={highlights.biggestLoss.placa}         icon={TrendingUp} color="text-red-500"     pm={pm} index={4} />
                  )}
                  {highlights.biggestGain && (
                    <KpiCard label="Maior Economia" value={`+${fmtNum(highlights.biggestGain.ganhoPerda)} L`}             subValue={highlights.biggestGain.placa}         icon={Leaf}       color="text-emerald-500" pm={pm} index={5} />
                  )}
                </div>

                {/* Comparativo de frotas */}
                {activeTab === "Geral" && <FleetComparison summaries={fleetSummaries} pm={pm} />}

                {/* Série temporal + donut */}
                <div className={`grid grid-cols-1 gap-4 lg:grid-cols-3 ${pm ? "lg:gap-5" : ""}`}>
                  <div className="lg:col-span-2">
                    <TimeSeriesChart data={timeSeries} pm={pm} />
                  </div>
                  <EfficiencyDonut dist={effDist} pm={pm} />
                </div>

                {/* Ganhos/Perdas */}
                <GainLossBlock records={filteredRecords} pm={pm} />

                {/* Rankings */}
                <div className={`grid grid-cols-1 gap-4 lg:grid-cols-3`}>
                  <RankingChart title="Maior Consumo (L)"      items={topConsumption}   unit="L"     pm={pm} />
                  <RankingChart title="Melhores Médias (KM/L)" items={bestEfficiency}   unit="km/l"  pm={pm} />
                  <RankingChart title="Piores Médias (KM/L)"   items={worstEfficiency}  unit="km/l"  invertColors pm={pm} />
                </div>

                {/* Tabela detalhada */}
                <DetailedTable records={filteredRecords} pm={pm} />
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MediasAbastecimento;
