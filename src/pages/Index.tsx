import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { motion } from "framer-motion";
import {
  LayoutDashboard, History, FileSearch, Fuel, Landmark,
  BarChart3, Building2, Settings, Sun, CloudSun, Moon,
  ArrowUpRight, Loader2, ChevronRight, FileSpreadsheet,
  Wrench, CheckCircle2, BookOpen, Users, Sparkles, ExternalLink,
} from "lucide-react";
import { getRecords, type HistoryRecord } from "@/lib/history";
import type { LucideIcon } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ModuleDef {
  key: string; title: string; description: string;
  icon: LucideIcon; path: string; color: string; masterOnly?: boolean;
}

// ─── Módulos ──────────────────────────────────────────────────────────────────

const MODULE_REGISTRY: ModuleDef[] = [
  { key: "historico",            title: "Histórico",               description: "Registros de todos os processamentos realizados",           icon: History,         path: "/historico",            color: "#5B9BD5" },
  { key: "conciliacao",          title: "NF-e / NFS-e",            description: "Conciliação fiscal de notas de serviço e produto",          icon: FileSearch,      path: "/conciliacao",          color: "#4AAF60" },
  { key: "abastecimento",        title: "Abastecimento",           description: "Correção de XMLs de notas sem placa",                       icon: Fuel,            path: "/abastecimento",        color: "#D4922A" },
  { key: "medias-abastecimento", title: "Médias de Abastecimento", description: "Dashboard executivo de consumo e eficiência da frota",      icon: BarChart3,       path: "/medias-abastecimento", color: "#9B7BD4" },
  { key: "contas-a-pagar",       title: "Contas a Pagar",          description: "Conciliação de pagamentos com extratos bancários",          icon: Landmark,        path: "/contas-a-pagar",       color: "#5B9BD5" },
  { key: "clientes",             title: "Clientes",                description: "Gestão e processamento por cliente",                        icon: Building2,       path: "/clientes",             color: "#3BBFA0" },
  { key: "configuracoes",        title: "Configurações",           description: "Preferências e ajustes do sistema",                         icon: Settings,        path: "/configuracoes",        color: "#D95F5F", masterOnly: true },
];

// ─── Guia de uso ──────────────────────────────────────────────────────────────

const GUIDE = [
  {
    step: "01",
    icon: FileSearch,
    title: "Conciliação de NFS-e e NF-e",
    path: "/conciliacao",
    color: "#4AAF60",
    desc: "Acesse o módulo NF-e / NFS-e. Importe a planilha do governo/portal e a planilha do sistema. Clique em Comparar relatórios. O sistema cruzará as notas automaticamente e exibirá o status de cada uma: lançada, não lançada, valor divergente, CNPJ divergente e outros. Ao final, exporte o resultado filtrado.",
  },
  {
    step: "02",
    icon: Fuel,
    title: "Correção de XML sem Placa",
    path: "/abastecimento",
    color: "#D4922A",
    desc: "Acesse o módulo Abastecimento. Arraste ou selecione os arquivos XML das notas que estão com erro por falta de placa. O sistema extrai automaticamente o número da nota e o nome do posto de cada XML. Preencha o campo de conteúdo ao lado de cada nota e clique em Confirmar. Um arquivo ZIP com todos os XMLs corrigidos será gerado para download.",
  },
  {
    step: "03",
    icon: BarChart3,
    title: "Médias de Abastecimento",
    path: "/medias-abastecimento",
    color: "#9B7BD4",
    desc: "Acesse o módulo Médias de Abastecimento. Importe a planilha exportada do sistema. Utilize os filtros de data e tipo de frota para refinar a análise. O painel exibirá os indicadores de consumo, eficiência e custo por veículo. Use o Modo Apresentação para exibir os dados em formato executivo para diretoria.",
  },
  {
    step: "04",
    icon: Landmark,
    title: "Contas a Pagar",
    path: "/contas-a-pagar",
    color: "#5B9BD5",
    desc: "Acesse o módulo Contas a Pagar. Importe o relatório do sistema (.xlsx) e o extrato bancário (.csv). Clique em Conciliar dados. O sistema cruzará os títulos automaticamente identificando os conciliados, divergentes e não encontrados. Utilize os filtros de período, status e fornecedor para navegar nos resultados.",
  },
  {
    step: "05",
    icon: Building2,
    title: "Processamento por Cliente",
    path: "/clientes",
    color: "#3BBFA0",
    desc: "Acesse o módulo Clientes. Selecione o cliente desejado. Cada cliente possui seu próprio fluxo de processamento: importe a planilha no formato esperado, revise os parâmetros se necessário e exporte o resultado. O histórico de todos os processamentos fica disponível no módulo Histórico.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EASE = [0.16, 1, 0.3, 1] as const;
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.4, ease: EASE as unknown as [number,number,number,number] },
});

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Componente ───────────────────────────────────────────────────────────────

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canView, isMaster, loading: permLoading } = useModulePermissions();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, full_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfileName(data.display_name || data.full_name || null);
      });
  }, [user]);

  const firstName =
    profileName?.split(" ")[0] ||
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Usuário";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const GreetingIcon = hour < 12 ? Sun : hour < 18 ? CloudSun : Moon;

  const accessibleModules = useMemo(() => {
    if (permLoading) return [];
    return MODULE_REGISTRY.filter((mod) => {
      if (mod.masterOnly && !isMaster) return false;
      return canView(mod.key);
    });
  }, [permLoading, canView, isMaster]);

  const [allRecords, setAllRecords] = useState<HistoryRecord[]>([]);
  useEffect(() => {
    getRecords().then(setAllRecords);
  }, []);
  const totalValor = allRecords.reduce((s, r) => s + r.valorTotal, 0);
  const totalDocs  = allRecords.reduce((s, r) => s + r.quantidadeDocumentos, 0);

  if (permLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-10">

      {/* ── Hero: saudação ── */}
      <motion.section {...fadeUp(0)}>
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(19,27,52,0.96)_0%,rgba(10,14,28,0.98)_45%,rgba(7,10,20,1)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_28%)]" />

          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
            <div>
              {/* Badge saudação */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                <GreetingIcon className="h-3.5 w-3.5" />
                {greeting}, {firstName}
              </div>

              <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white lg:text-[34px]">
                Bem-vindo ao{" "}
                <span className="bg-gradient-to-r from-violet-300 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
                  ReceitaFlow
                </span>
              </h1>

              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-400">
                Plataforma centralizada para conciliação financeira, processamento de notas fiscais e gestão de recebimentos. Utilize o menu acima ou os atalhos abaixo para navegar entre os módulos.
              </p>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-2 gap-3 lg:w-[340px] shrink-0">
              {[
                { label: "Total processado", value: formatCurrency(totalValor), icon: LayoutDashboard },
                { label: "Documentos",        value: totalDocs.toLocaleString("pt-BR"), icon: FileSpreadsheet },
                { label: "Processamentos",    value: allRecords.length.toString(), icon: History },
                { label: "Módulos ativos",    value: accessibleModules.length.toString(), icon: Sparkles },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{s.label}</p>
                  <p className="mt-1.5 text-lg font-semibold tabular-nums text-white">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Acessos rápidos ── */}
      {accessibleModules.length > 0 && (
        <motion.section {...fadeUp(0.06)}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <h2 className="text-base font-semibold text-white">Acessos rápidos</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">

            {/* Card SGT — primeiro e destacado */}
            <motion.button
              type="button"
              onClick={() => navigate("/sgt")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="group relative overflow-hidden rounded-[22px] border border-teal-500/30 bg-[linear-gradient(135deg,rgba(16,24,36,0.98)_0%,rgba(10,22,20,0.98)_100%)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.28),0_0_0_1px_rgba(59,191,160,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400/50 hover:shadow-[0_16px_40px_rgba(0,0,0,0.35),0_0_24px_rgba(59,191,160,0.12)] text-left w-full"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,191,160,0.10),transparent_55%)]" />

              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 ring-1 ring-teal-500/20">
                  <ExternalLink className="h-4.5 w-4.5 text-teal-400" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-400">
                    Workspace
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all duration-200 group-hover:text-teal-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>

              <div className="relative z-10 mt-4">
                <p className="text-[15px] font-semibold tracking-tight text-white">SGT</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">Acesso ao workspace SGT</p>
              </div>
            </motion.button>

            {accessibleModules.map((mod, i) => (
              <motion.button
                key={mod.key}
                type="button"
                onClick={() => navigate(mod.path)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 + i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="group relative overflow-hidden rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,20,32,0.98),rgba(10,13,22,0.98))] p-5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/12 hover:shadow-[0_16px_40px_rgba(0,0,0,0.30)]"
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{ background: `radial-gradient(circle at top left, ${mod.color}12, transparent 55%)` }} />

                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${mod.color}18` }}
                  >
                    <mod.icon className="h-4.5 w-4.5" style={{ color: mod.color }} />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all duration-200 group-hover:text-violet-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
                </div>

                <div className="relative z-10 mt-4">
                  <p className="text-[15px] font-semibold tracking-tight text-white">{mod.title}</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">{mod.description}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Guia de uso ── */}
      <motion.section {...fadeUp(0.12)}>
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
            <BookOpen className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Guia de uso</h2>
          <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-slate-500">
            Como usar cada módulo
          </span>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,20,32,0.98),rgba(10,13,22,0.98))] shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
          {GUIDE.map((item, i) => {
            const isOpen = openStep === item.step;
            const Icon = item.icon;
            return (
              <div key={item.step} className={i > 0 ? "border-t border-white/[0.05]" : ""}>
                <button
                  type="button"
                  onClick={() => setOpenStep(isOpen ? null : item.step)}
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
                >
                  {/* Número do passo */}
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-600">
                    {item.step}
                  </span>

                  {/* Ícone */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${item.color}18` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: item.color }} />
                  </div>

                  {/* Título */}
                  <p className="flex-1 text-[15px] font-semibold text-white">{item.title}</p>

                  {/* Status */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isOpen && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Expandido
                      </span>
                    )}
                    <ChevronRight
                      className={`h-4 w-4 text-slate-600 transition-transform duration-200 ${isOpen ? "rotate-90" : "group-hover:translate-x-0.5"}`}
                    />
                  </div>
                </button>

                {/* Conteúdo expandido */}
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/[0.04] px-5 py-5 pl-[72px]">
                      <p className="text-sm leading-7 text-slate-400">{item.desc}</p>
                      <button
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-slate-300 transition-all hover:border-violet-500/25 hover:bg-violet-500/10 hover:text-violet-300"
                      >
                        Ir para o módulo
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* ── Rodapé institucional ── */}
      <motion.section {...fadeUp(0.18)}>
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-white/[0.05] bg-white/[0.02] py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
            <Users className="h-4.5 w-4.5 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-white">ReceitaFlow — Control Center</p>
          <p className="max-w-md text-xs leading-6 text-slate-500">
            Plataforma de uso interno para equipes financeiras. Em caso de dúvidas ou problemas, entre em contato com o administrador do sistema.
          </p>
        </div>
      </motion.section>

    </div>
  );
};

export default Index;
