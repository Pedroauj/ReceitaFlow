import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Users,
  Truck,
  Droplets,
  Leaf,
  DollarSign,
  Download,
  FileText,
  Presentation,
  Maximize2,
  Minimize2,
  Gauge,
  Fuel,
  CalendarDays,
  Filter,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePresentationMode } from "@/contexts/PresentationModeContext";

import {
  computeGlobalKpis,
  computeFleetSummaries,
  filterByFleetType,
  rankByConsumption,
  rankByEfficiency,
  computeEfficiencyDistribution,
  computeRecordHighlights,
  generateInsights,
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

// ─── Datas padrão: início do mês até hoje ────────────────────────────────────
const hoje = new Date();
const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
const toInputDate = (d: Date) => d.toISOString().split("T")[0];

// ─── Conversão DW → VehicleRecord ────────────────────────────────────────────
function toVehicleRecord(row: AbastecimentoRow, idx: number): VehicleRecord {
  const quanti = row.quanti ?? 0;
  const media = row.media ?? 0;
  const medfab = row.medfab && row.medfab > 0 ? row.medfab : media;
  const km =
    row.atukmt != null && row.ultkmt != null
      ? Math.max(row.atukmt - row.ultkmt, 0)
      : media * quanti;
  const ganhoPerda = medfab > 0 ? (media - medfab) * quanti : 0;
  const eficiencia = medfab > 0 ? (media / medfab) * 100 : 100;

  return {
    id: String(row.codaba ?? idx),
    placa: String(row.veiculo ?? "—"),
    motorista: row.motorista ?? "—",
    tipoFrota: row.frota ?? "Outros",
    km,
    litros: quanti,
    mediaKmL: media,
    metaKmL: medfab,
    ganhoPerda,
    eficiencia,
    custoEstimado: row.vlrtot ?? 0,
    periodo: row.datref ? row.datref.substring(0, 7) : "",
  };
}

// ─── Série temporal agrupada por mês ─────────────────────────────────────────
function buildTimeSeries(rows: AbastecimentoRow[]): TimeSeriesPoint[] {
  const map = new Map<string, { litros: number; custo: number; km: number }>();

  for (const r of rows) {
    if (!r.datref) continue;
    const periodo = r.datref.substring(0, 7);
    const entry = map.get(periodo) ?? { litros: 0, custo: 0, km: 0 };
    entry.litros += r.quanti ?? 0;
    entry.custo += r.vlrtot ?? 0;
    const km =
      r.atukmt != null && r.ultkmt != null
        ? Math.max(r.atukmt - r.ultkmt, 0)
        : (r.media ?? 0) * (r.quanti ?? 0);
    entry.km += km;
    map.set(periodo, entry);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, v]) => ({
      periodo,
      litros: v.litros,
      kmL: v.litros > 0 ? v.km / v.litros : 0,
      custoEstimado: v.custo,
    }));
}

// ─── Componente principal ─────────────────────────────────────────────────────
const MediasAbastecimento = () => {
  const [dataInicio, setDataInicio] = useState(toInputDate(primeiroDia));
  const [dataFim, setDataFim] = useState(toInputDate(hoje));
  const [activeTab, setActiveTab] = useState("Geral");
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<AbastecimentoRow[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  const { isPresentationMode, togglePresentationMode } = usePresentationMode();
  const pm = isPresentationMode;

  // ── Busca dados do DW ──────────────────────────────────────────────────────
  const handleAtualizar = useCallback(async () => {
    setIsLoading(true);
    setErro(null);
    try {
      const res = await fetchAbastecimento({ dataInicio, dataFim });
      const rows = res.data ?? [];
      setRawRows(rows);
      setHasLoaded(true);
      if (rows.length === 0) {
        toast.warning("Nenhum registro encontrado no período selecionado.");
      } else {
        toast.success(`${rows.length} registros carregados com sucesso.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar dados do DW.";
      setErro(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [dataInicio, dataFim]);

  // ── Conversão e cálculos ───────────────────────────────────────────────────
  const allRecords = useMemo<VehicleRecord[]>(
    () => rawRows.map(toVehicleRecord),
    [rawRows]
  );

  const timeSeries = useMemo<TimeSeriesPoint[]>(
    () => buildTimeSeries(rawRows),
    [rawRows]
  );

  const filteredRecords = useMemo(
    () => filterByFleetType(allRecords, activeTab),
    [allRecords, activeTab]
  );

  const globalKpis = useMemo(() => computeGlobalKpis(filteredRecords), [filteredRecords]);
  const fleetSummaries = useMemo(() => computeFleetSummaries(allRecords), [allRecords]);
  const effDist = useMemo(() => computeEfficiencyDistribution(filteredRecords), [filteredRecords]);
  const highlights = useMemo(() => computeRecordHighlights(filteredRecords), [filteredRecords]);
  const insights = useMemo(
    () => generateInsights(filteredRecords, fleetSummaries, globalKpis, effDist),
    [filteredRecords, fleetSummaries, globalKpis, effDist]
  );
  const topConsumption = useMemo(() => rankByConsumption(filteredRecords, 10), [filteredRecords]);
  const bestEfficiency = useMemo(() => rankByEfficiency(filteredRecords, true, 10), [filteredRecords]);
  const worstEfficiency = useMemo(() => rankByEfficiency(filteredRecords, false, 10), [filteredRecords]);

  const availableTypes = useMemo(
    () => ["Geral", ...new Set(allRecords.map((r) => r.tipoFrota))],
    [allRecords]
  );

  const kpis = [
    {
      label: "Total de Diesel",
      value: `${fmtNum(Math.round(globalKpis.totalDiesel))} L`,
      icon: Droplets,
      color: "text-cyan-400",
      highlight: true,
    },
    {
      label: "Total de KM",
      value: fmtNum(Math.round(globalKpis.totalKm)),
      icon: Truck,
      color: "text-purple-400",
    },
    {
      label: "Média Geral",
      value: `${globalKpis.mediaGeral.toFixed(2)} km/l`,
      icon: TrendingUp,
      color: "text-violet-300",
      highlight: true,
      subValue: "Ponderada por KM",
    },
    {
      label: "Eficiência Geral",
      value: `${globalKpis.eficienciaGeral.toFixed(1)}%`,
      icon: Gauge,
      color: "text-violet-300",
      highlight: true,
    },
    {
      label: "Economia Total",
      value: `+${fmtNum(Math.round(globalKpis.ganhoTotal))} L`,
      icon: Leaf,
      color: "text-emerald-400",
      highlight: true,
    },
    {
      label: "Custo Total",
      value: fmtBRL(globalKpis.custoTotal),
      icon: DollarSign,
      color: "text-violet-300",
    },
    {
      label: "Veículos",
      value: String(globalKpis.totalVeiculos),
      icon: Truck,
      color: "text-blue-400",
    },
    {
      label: "Motoristas",
      value: String(globalKpis.totalMotoristas),
      icon: Users,
      color: "text-blue-400",
    },
  ];

  const handleExport = (type: string) => {
    toast.info(`Exportação ${type} será implementada em breve.`);
  };

  return (
    <motion.div
      className="mx-auto w-full max-w-[1600px] space-y-6"
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* ── Cabeçalho ── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex-1">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(19,27,52,0.96),rgba(10,14,28,0.98))] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.08),transparent_28%)]" />
            <div className="relative p-6 lg:p-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                <Sparkles className="h-3.5 w-3.5" />
                Painel executivo
              </div>
              <AnimatePresence mode="wait">
                {pm ? (
                  <motion.div key="pm-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
                    <h1 className="text-[28px] font-semibold leading-none tracking-tight text-foreground lg:text-[32px]">
                      Desempenho estratégico de abastecimento da frota
                    </h1>
                    <p className="mt-3 max-w-3xl text-[15px] leading-7 text-muted-foreground">
                      Leitura consolidada da operação para apresentação executiva, com foco em eficiência, consumo, custo e oportunidade de economia.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="normal-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
                    <h1 className="text-[28px] font-semibold leading-none tracking-tight text-foreground lg:text-[32px]">
                      Médias de Abastecimento
                    </h1>
                    <p className="mt-3 max-w-3xl text-[15px] leading-7 text-muted-foreground">
                      Visão executiva da performance de consumo da frota, estruturada para análise interna e apresentação para diretoria.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start xl:mt-0">
          <button
            onClick={togglePresentationMode}
            title={pm ? "Sair do modo apresentação (ESC)" : "Entrar no modo apresentação (F)"}
            className={`inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-all duration-300 ${
              pm
                ? "border-violet-500/30 bg-violet-500/12 text-violet-300 shadow-[0_0_24px_-8px_rgba(139,92,246,0.45)] hover:bg-violet-500/18"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {pm ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span>{pm ? "Sair da apresentação" : "Modo apresentação"}</span>
          </button>
        </div>
      </div>

      {/* ── Painel de filtros (oculto no modo apresentação) ── */}
      <AnimatePresence>
        {!pm && (
          <motion.section
            initial={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: "hidden" }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,32,0.98),rgba(10,13,22,0.98))] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
          >
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  Filtros do período
                </h2>
                <p className="text-sm text-muted-foreground">
                  Selecione o intervalo de datas e clique em atualizar para carregar os dados do DW.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                <Filter className="h-3.5 w-3.5" />
                Base operacional
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/42">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Data inicial
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 text-sm text-foreground outline-none transition-colors placeholder:text-white/22 focus:border-violet-500/35"
                />
              </div>

              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/42">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Data final
                </label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 text-sm text-foreground outline-none transition-colors placeholder:text-white/22 focus:border-violet-500/35"
                />
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {erro}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={handleAtualizar}
                disabled={isLoading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#f3b633]/40 bg-[linear-gradient(180deg,#f3b633,#d89614)] px-5 text-sm font-semibold text-[#18120a] shadow-[0_12px_30px_-12px_rgba(243,182,51,0.75)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_16px_36px_-12px_rgba(243,182,51,0.85)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                {isLoading ? "Carregando dados..." : hasLoaded ? "Atualizar" : "Carregar dados do DW"}
              </button>

              {hasLoaded && allRecords.length > 0 && (
                <p className="text-sm text-white/42">
                  {allRecords.length} registros carregados
                  {" · "}
                  {dataInicio} até {dataFim}
                </p>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Resultados ── */}
      {hasLoaded && (
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: pm ? 0.1 : 0 }}
        >
          {allRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,32,0.98),rgba(10,13,22,0.98))] py-16 text-center">
              <AlertCircle className="h-8 w-8 text-white/30" />
              <p className="text-sm text-white/50">Nenhum abastecimento encontrado no período selecionado.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground md:text-xl">
                    Leitura consolidada da operação
                  </h2>
                  <p className="mt-1 text-sm text-white/56">
                    Recorte atual: {activeTab === "Geral" ? "todas as frotas" : activeTab}.
                  </p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="h-auto flex-wrap rounded-2xl border border-white/8 bg-white/[0.03] p-1">
                    {availableTypes.map((t) => (
                      <TabsTrigger
                        key={t}
                        value={t}
                        className="rounded-xl px-3 py-2 text-xs font-semibold sm:text-sm"
                      >
                        {t}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {/* KPIs globais */}
              <div
                className={`grid gap-4 ${
                  pm
                    ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8"
                    : "grid-cols-2 md:grid-cols-4 lg:grid-cols-8"
                }`}
              >
                {kpis.map((kpi, i) => (
                  <KpiCard key={kpi.label} {...kpi} pm={pm} index={i} />
                ))}
              </div>

              <InsightsPanel insights={insights} pm={pm} />

              {/* Destaques */}
              <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 ${pm ? "xl:gap-6" : ""}`}>
                {highlights.worstEfficiency && (
                  <KpiCard
                    label="Pior Média"
                    value={`${highlights.worstEfficiency.mediaKmL.toFixed(2)} km/l`}
                    subValue={highlights.worstEfficiency.placa}
                    icon={TrendingUp}
                    color="text-red-400"
                    pm={pm}
                  />
                )}
                {highlights.bestEfficiency && (
                  <KpiCard
                    label="Melhor Média"
                    value={`${highlights.bestEfficiency.mediaKmL.toFixed(2)} km/l`}
                    subValue={highlights.bestEfficiency.placa}
                    icon={TrendingUp}
                    color="text-emerald-400"
                    pm={pm}
                  />
                )}
                {highlights.highestConsumption && (
                  <KpiCard
                    label="Maior Consumo"
                    value={`${Math.round(highlights.highestConsumption.litros)} L`}
                    subValue={highlights.highestConsumption.placa}
                    icon={Fuel}
                    color="text-red-400"
                    pm={pm}
                  />
                )}
                {highlights.highestKm && (
                  <KpiCard
                    label="Maior KM"
                    value={fmtNum(Math.round(highlights.highestKm.km))}
                    subValue={highlights.highestKm.placa}
                    icon={Truck}
                    color="text-blue-400"
                    pm={pm}
                  />
                )}
                {highlights.biggestLoss && (
                  <KpiCard
                    label="Maior Perda"
                    value={`-${fmtNum(Math.abs(highlights.biggestLoss.ganhoPerda))} L`}
                    subValue={highlights.biggestLoss.placa}
                    icon={TrendingUp}
                    color="text-red-500"
                    pm={pm}
                  />
                )}
                {highlights.biggestGain && (
                  <KpiCard
                    label="Maior Economia"
                    value={`+${fmtNum(highlights.biggestGain.ganhoPerda)} L`}
                    subValue={highlights.biggestGain.placa}
                    icon={Leaf}
                    color="text-emerald-500"
                    pm={pm}
                  />
                )}
              </div>

              {activeTab === "Geral" && <FleetComparison summaries={fleetSummaries} pm={pm} />}

              <div className={`grid grid-cols-1 gap-4 lg:grid-cols-3 ${pm ? "lg:gap-6" : ""}`}>
                <div className={`lg:col-span-2 ${pm ? "min-h-[420px]" : ""}`}>
                  <TimeSeriesChart data={timeSeries} pm={pm} />
                </div>
                <EfficiencyDonut dist={effDist} pm={pm} />
              </div>

              <GainLossBlock records={filteredRecords} pm={pm} />

              <div className={`grid grid-cols-1 gap-4 lg:grid-cols-3 ${pm ? "lg:gap-6" : ""}`}>
                <RankingChart title="Maior Consumo (L)" items={topConsumption} unit="L" pm={pm} />
                <RankingChart title="Melhores Médias (KM/L)" items={bestEfficiency} unit="km/l" pm={pm} />
                <RankingChart title="Piores Médias (KM/L)" items={worstEfficiency} unit="km/l" invertColors pm={pm} />
              </div>

              <DetailedTable records={filteredRecords} pm={pm} />

              {/* Exportação */}
              <AnimatePresence>
                {!pm && (
                  <motion.section
                    initial={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                    transition={{ duration: 0.3 }}
                    className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,32,0.98),rgba(10,13,22,0.98))] p-5"
                  >
                    <div className="mb-4">
                      <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                        Exportação executiva
                      </h3>
                      <p className="mt-1 text-sm text-white/52">
                        Gere materiais de apoio para reunião, acompanhamento ou envio formal.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleExport("PowerPoint")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
                      >
                        <Presentation className="h-4 w-4 text-violet-300" />
                        Gerar apresentação
                      </button>
                      <button
                        onClick={() => handleExport("PDF")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
                      >
                        <FileText className="h-4 w-4 text-red-400" />
                        Exportar PDF
                      </button>
                      <button
                        onClick={() => handleExport("Excel")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
                      >
                        <Download className="h-4 w-4 text-emerald-400" />
                        Exportar Excel
                      </button>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default MediasAbastecimento;
