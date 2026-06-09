import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { clients } from "@/lib/clients";
import { getRecords } from "@/lib/history";
import {
  ArrowRight,
  Search,
  Users,
  FileText,
  Activity,
  Clock3,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const clientColors: Record<string, string> = {
  "martin-brower": "#818CF8",
  minerva: "#60A5FA",
  danone: "#4ADE80",
  platlog: "#A78BFA",
  jbs: "#F87171",
  natura: "#34D399",
};

const clientInitials: Record<string, string> = {
  "martin-brower": "MB",
  minerva: "MI",
  danone: "DA",
  platlog: "PL",
  jbs: "JB",
  natura: "NA",
};

const normalizeText = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const formatDocsLabel = (count: number) =>
  `${count} ${count === 1 ? "documento" : "documentos"}`;

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const MotorCliente = () => {
  const navigate = useNavigate();
  const records = getRecords();
  const [search, setSearch] = useState("");

  const enrichedClients = useMemo(() => {
    return clients.map((client) => {
      const color = clientColors[client.id] || "#8B5CF6";
      const initials =
        clientInitials[client.id] || client.name.slice(0, 2).toUpperCase();

      const normalizedClientId = normalizeText(client.id.replace(/-/g, " "));
      const normalizedClientName = normalizeText(client.name);

      const clientRecords = records.filter((record) => {
        const recordClient = normalizeText(record.cliente);
        return (
          recordClient.includes(normalizedClientId) ||
          recordClient.includes(normalizedClientName)
        );
      });

      const docCount = clientRecords.reduce(
        (sum, record) => sum + record.quantidadeDocumentos,
        0
      );

      return {
        ...client,
        color,
        initials,
        docCount,
        isActive: true,
      };
    });
  }, [records]);

  const filteredClients = useMemo(() => {
    const term = normalizeText(search.trim());
    if (!term) return enrichedClients;

    return enrichedClients.filter(
      (client) =>
        normalizeText(client.name).includes(term) ||
        normalizeText(client.id).includes(term)
    );
  }, [enrichedClients, search]);

  const activeClientsList = filteredClients.filter((client) => client.isActive);
  const pendingClientsList = filteredClients.filter((client) => !client.isActive);

  const totalClients = enrichedClients.length;
  const activeClients = enrichedClients.filter((client) => client.isActive).length;
  const pendingClients = totalClients - activeClients;
  const totalDocs = enrichedClients.reduce((sum, client) => sum + client.docCount, 0);

  const stats = [
    {
      label: "Total de clientes",
      value: formatNumber(totalClients),
      icon: Users,
      helper: "Base operacional disponível",
    },
    {
      label: "Clientes ativos",
      value: formatNumber(activeClients),
      icon: TrendingUp,
      helper: "Com movimentação registrada",
    },
    {
      label: "Pendentes",
      value: formatNumber(pendingClients),
      icon: Clock3,
      helper: "Sem documentos vinculados",
    },
    {
      label: "Documentos mapeados",
      value: formatNumber(totalDocs),
      icon: FileText,
      helper: "Volume consolidado",
    },
  ];

  const topClients = [...filteredClients]
    .sort((a, b) => b.docCount - a.docCount)
    .slice(0, 3);

  return (
    <div className="w-full pt-2 pb-2">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(19,27,52,0.96)_0%,rgba(10,14,28,0.98)_45%,rgba(7,10,20,1)_100%)] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_28%)]" />

          <div className="relative grid gap-6 xl:grid-cols-[1.2fr_420px]">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium tracking-wide text-violet-400">
                <Sparkles className="h-3.5 w-3.5" />
                Gestão centralizada de clientes
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                Central de clientes
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Visualize a operação de ponta a ponta, identifique rapidamente clientes
                ativos e acesse cada fluxo com uma interface mais clara, dinâmica e
                alinhada ao novo padrão visual do sistema.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 backdrop-blur-sm"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                        {stat.label}
                      </span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                        <stat.icon className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="text-2xl font-semibold text-white">{stat.value}</div>
                    <p className="mt-1 text-xs text-slate-400">{stat.helper}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-5 backdrop-blur-sm">
              <div>
                <p className="text-sm font-medium text-white">Busca inteligente</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Localize rapidamente um cliente por nome ou identificação operacional.
                </p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-violet-500/35 focus:ring-2 focus:ring-violet-500/15"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-violet-500/15 bg-violet-500/8 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-violet-300/80">
                    Clientes
                  </p>
                  <p className="mt-2 text-xl font-semibold text-white">{totalClients}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Cadastrados e disponíveis no sistema
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-500/15 bg-blue-500/8 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-blue-300/80">
                    Documentos
                  </p>
                  <p className="mt-2 text-xl font-semibold text-white">{formatNumber(totalDocs)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Total agregado entre todos os clientes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* DESTAQUES */}
        {topClients.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.28 }}
            className="grid gap-4 lg:grid-cols-3"
          >
            {topClients.map((client, index) => (
              <button
                key={client.id}
                type="button"
                onClick={() => navigate(client.route)}
                className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,37,0.98)_0%,rgba(14,17,28,0.98)_100%)] p-5 text-left transition-all duration-200 hover:-translate-y-[3px] hover:border-violet-500/20 hover:shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.14] transition-opacity duration-200 group-hover:opacity-[0.2]"
                  style={{
                    background: `radial-gradient(circle at top right, ${client.color} 0%, transparent 38%)`,
                  }}
                />

                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold"
                        style={{
                          backgroundColor: `${client.color}18`,
                          color: client.color,
                          boxShadow: `inset 0 0 0 1px ${client.color}22`,
                        }}
                      >
                        {client.initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-semibold text-white">
                            {client.name}
                          </p>
                          <span className="rounded-full border border-violet-500/15 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                            Top {index + 1}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          Cliente com maior volume no painel atual
                        </p>
                      </div>
                    </div>

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] transition-all duration-200 group-hover:border-violet-500/25 group-hover:bg-violet-500/10">
                      <ArrowRight className="h-4 w-4 text-slate-400 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-violet-400" />
                    </div>
                  </div>

                  <div className="mt-6 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">
                        Documentos vinculados
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                        {formatNumber(client.docCount)}
                      </p>
                    </div>

                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-white/[0.06] text-slate-400">
                      {formatNumber(client.docCount)} docs
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </motion.section>
        )}

        {/* GRID PRINCIPAL */}
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.28 }}
            className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,32,0.98)_0%,rgba(10,13,22,0.98)_100%)] p-5"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Todos os clientes</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Visão completa dos acessos e operações disponíveis.
                </p>
              </div>

              <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
                {filteredClients.length} resultado{filteredClients.length !== 1 ? "s" : ""}
              </div>
            </div>

            {filteredClients.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => navigate(client.route)}
                    className="group rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-left transition-all duration-200 hover:-translate-y-[2px] hover:border-violet-500/18 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-bold"
                          style={{
                            backgroundColor: `${client.color}16`,
                            color: client.color,
                            boxShadow: `inset 0 0 0 1px ${client.color}20`,
                          }}
                        >
                          {client.initials}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-white">
                            {client.name}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-400">
                              {formatDocsLabel(client.docCount)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-black/20 transition-all duration-200 group-hover:border-violet-500/20 group-hover:bg-violet-500/10">
                        <ArrowRight className="h-4 w-4 text-slate-400 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-violet-400" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center">
                <p className="text-sm font-medium text-white">Nenhum cliente encontrado</p>
                <p className="mt-1 text-xs text-slate-400">
                  Tente pesquisar por nome ou identificação.
                </p>
              </div>
            )}
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.28 }}
            className="flex flex-col gap-4"
          >
            <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,32,0.98)_0%,rgba(10,13,22,0.98)_100%)] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Resumo operacional</h3>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total de clientes</span>
                    <span className="text-sm font-semibold text-white">{totalClients}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Clientes cadastrados e disponíveis no sistema.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Documentos processados</span>
                    <span className="text-sm font-semibold text-violet-300">{formatNumber(totalDocs)}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Total agregado entre todos os clientes.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,32,0.98)_0%,rgba(10,13,22,0.98)_100%)] p-5">
              <h3 className="text-sm font-semibold text-white">Situação atual</h3>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-slate-300">Clientes</span>
                  <span className="rounded-full bg-violet-500/12 px-2.5 py-1 text-xs font-medium text-violet-300">
                    {totalClients}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-slate-300">Documentos</span>
                  <span className="rounded-full bg-violet-500/12 px-2.5 py-1 text-xs font-medium text-violet-300">
                    {formatNumber(totalDocs)}
                  </span>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
};

export default MotorCliente;