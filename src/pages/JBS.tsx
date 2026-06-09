import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  FileCheck,
  FileSpreadsheet,
  Info,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus =
  | "batido"
  | "ajustado"
  | "adicionado"
  | "adiantamento"
  | "nd"
  | "pendente";

type JBSRow = {
  idx: number;
  empresa: string;
  instrucaoMatriz: string;
  instrucaoFilial: string;
  placa: string;
  documentoFrete: string;
  documentoFrete2: string;
  canhotoBaixado: string;
  tituloFinanceiro: string;
  parcela: string;
  dataVencimento: string;
  rodopar: number | null;
  valorFrete: number;
  dataLiberacao: string;
  numeroLote: string;
  statusPortal: string;
  dataAntecipacao: string;
  valorBloqueado: number;
  valorDescontado: number;
  saldoAReceber: string;
  valorQuitado: string;
  dataPagamento: string;
  numeroFormulario: string;
  serieFormulario: string;
  // colunas adicionadas no processamento
  documentoRodopar: string;
  saldo385: number | null;
  saldo385Final: number | null;
  docStatus: DocStatus;
  isAdded: boolean;
};

type FilialGroup = {
  instrucaoFilial: string;
  caseType: 1 | 2 | 3 | 4;
  rows: JBSRow[];
  totalValorFrete: number;
  totalSaldo385: number;
  isBalanced: boolean;
};

type Summary = {
  selectedDate: string;
  bankValue: number;
  totalValorFrete: number;
  groups: FilialGroup[];
  batidoCount: number;
  ajustadoCount: number;
  adicionadoCount: number;
  ndCount: number;
  pendingCount: number;
  allBalanced: boolean;
  importacaoCount: number;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const normalizeText = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const normalizeDocument = (v: unknown) =>
  String(v ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");

const cleanDoc = (v: unknown): string => {
  const raw = String(v ?? "").trim();
  if (!raw || raw === "-") return raw;
  if (raw.toLowerCase() === "adiantamento") return "Adiantamento";
  const cleaned = raw.replace(/^000-/i, "").replace(/^1-/i, "");
  const digits = normalizeDocument(cleaned);
  return digits || raw;
};

const isNumericDoc = (doc: string) => /^\d+$/.test(doc.trim());
const isAdiantamento = (doc: string) => doc.toLowerCase().trim() === "adiantamento";
const isND = (doc: string) => {
  const t = doc.trim();
  return t === "-" || t === "";
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  const n = Number(
    String(v ?? "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  );
  return Number.isFinite(n) ? n : 0;
};

const normDateValue = (v: unknown): string | null => {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const mo = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  if (typeof v === "number") {
    const p = XLSX.SSF.parse_date_code(v);
    if (p)
      return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  }
  const raw = String(v).trim();
  if (!raw) return null;
  const s = raw.replace(/,/g, ".").replace(/\//g, ".").split(" ")[0];
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

const fmtDateBR = (iso: string) => {
  if (!iso) return "";
  const [y, mo, d] = iso.split("-");
  return `${d}/${mo}/${y}`;
};

const safeFmtDateBR = (v: unknown) => {
  const n = normDateValue(v);
  return n ? fmtDateBR(n) : "";
};

const fmtCurrencyBR = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const parseCurrencyInput = (v: string) => {
  if (!v.trim()) return 0;
  return toNumber(v.replace(/[^\d,.-]/g, ""));
};

const formatCurrencyInput = (v: string) => {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(digits) / 100);
};

const getCell = (sheet: XLSX.WorkSheet, c: number, r: number) =>
  sheet[XLSX.utils.encode_cell({ c, r })]?.v;

const findCol = (sheet: XLSX.WorkSheet, candidates: string[]) => {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const norm = candidates.map(normalizeText);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const h = normalizeText(String(getCell(sheet, c, 0) ?? ""));
    if (norm.some((n) => h.includes(n))) return c;
  }
  return -1;
};

// ─── Parse 385 ────────────────────────────────────────────────────────────────

const build385Map = (sheet: XLSX.WorkSheet): Map<string, number> => {
  const map = new Map<string, number>();
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const codconCol = findCol(sheet, ["codcon"]);
  const saldoCol = findCol(sheet, ["saldo"]);
  if (codconCol < 0 || saldoCol < 0) return map;
  for (let r = 1; r <= range.e.r; r++) {
    const codcon = normalizeDocument(getCell(sheet, codconCol, r));
    const saldo = toNumber(getCell(sheet, saldoCol, r));
    if (codcon && !map.has(codcon)) map.set(codcon, saldo);
  }
  return map;
};

// ─── Parse JBS ────────────────────────────────────────────────────────────────

const parseJBS = (sheet: XLSX.WorkSheet, map385: Map<string, number>): JBSRow[] => {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const rows: JBSRow[] = [];

  for (let r = 1; r <= range.e.r; r++) {
    const g = (c: number) => getCell(sheet, c, r);
    const empresa = String(g(0) ?? "").trim();
    const instrucaoFilial = String(g(2) ?? "").trim();
    const documentoFrete = String(g(4) ?? "").trim();
    if (!empresa && !instrucaoFilial && !documentoFrete) continue;

    const documentoRodopar = cleanDoc(documentoFrete);
    const saldo385 = isNumericDoc(documentoRodopar)
      ? (map385.get(documentoRodopar) ?? null)
      : null;

    rows.push({
      idx: r,
      empresa,
      instrucaoMatriz: String(g(1) ?? ""),
      instrucaoFilial,
      placa: String(g(3) ?? ""),
      documentoFrete,
      documentoFrete2: String(g(5) ?? ""),
      canhotoBaixado: String(g(6) ?? ""),
      tituloFinanceiro: String(g(7) ?? ""),
      parcela: String(g(8) ?? ""),
      dataVencimento: safeFmtDateBR(g(9)),
      rodopar: g(10) != null ? toNumber(g(10)) : null,
      valorFrete: toNumber(g(11)),
      dataLiberacao: safeFmtDateBR(g(12)),
      numeroLote: String(g(13) ?? ""),
      statusPortal: String(g(14) ?? ""),
      dataAntecipacao: normDateValue(g(15)) ?? "",
      valorBloqueado: toNumber(g(16)),
      valorDescontado: toNumber(g(17)),
      saldoAReceber: String(g(18) ?? ""),
      valorQuitado: String(g(19) ?? ""),
      dataPagamento: safeFmtDateBR(g(20)),
      numeroFormulario: String(g(21) ?? ""),
      serieFormulario: String(g(22) ?? ""),
      documentoRodopar,
      saldo385,
      saldo385Final: saldo385,
      docStatus: "pendente",
      isAdded: false,
    });
  }
  return rows;
};

// ─── Processing ───────────────────────────────────────────────────────────────

const processGroup = (
  instrucaoFilial: string,
  groupRows: JBSRow[],
  allRows: JBSRow[]
): FilialGroup => {
  const numericInGroup = groupRows.filter((r) => isNumericDoc(r.documentoFrete));
  const adiantInGroup = groupRows.filter((r) => isAdiantamento(r.documentoFrete));
  const ndInGroup = groupRows.filter((r) => isND(r.documentoFrete));

  // Determina o caso
  let caseType: 1 | 2 | 3 | 4;
  if (ndInGroup.length > 0 && numericInGroup.length === 0 && adiantInGroup.length === 0) {
    caseType = 4;
  } else if (numericInGroup.length > 0 && adiantInGroup.length === 0) {
    caseType = 1;
  } else if (numericInGroup.length > 0 && adiantInGroup.length > 0) {
    caseType = 2;
  } else {
    caseType = 3; // apenas ADIANTAMENTO (ou ADIANTAMENTO + ND)
  }

  let rows = groupRows.map((r) => ({ ...r }));

  if (caseType === 4) {
    // Caso 4: apenas ND — marca e exibe na tela
    rows = rows.map((r) => ({ ...r, docStatus: "nd" as DocStatus }));
  } else {
    // Casos 1, 2, 3: busca documentos faltantes na base completa
    const existingDocs = new Set(
      groupRows
        .filter((r) => isNumericDoc(r.documentoFrete))
        .map((r) => r.documentoRodopar)
    );

    const missing = allRows.filter(
      (r) =>
        r.instrucaoFilial === instrucaoFilial &&
        isNumericDoc(r.documentoFrete) &&
        !existingDocs.has(r.documentoRodopar)
    );

    // Adiciona os documentos faltantes — VALOR FRETE zerado (regra base)
    const addedRows: JBSRow[] = missing.map((r) => ({
      ...r,
      valorFrete: 0,
      docStatus: "adicionado" as DocStatus,
      isAdded: true,
    }));

    rows = [...rows, ...addedRows];

    // Marca ADIANTAMENTO
    rows = rows.map((r) =>
      isAdiantamento(r.documentoFrete)
        ? { ...r, docStatus: "adiantamento" as DocStatus }
        : r
    );

    // Processa linhas numéricas originais: compara SALDO 385 vs VALOR FRETE
    rows = rows.map((r) => {
      if (!isNumericDoc(r.documentoFrete) || r.isAdded) return r;
      if (r.saldo385 === null) return { ...r, docStatus: "pendente" as DocStatus };

      const diff = r.saldo385 - r.valorFrete;

      if (Math.abs(diff) < 0.01) {
        // Bateu exato
        return { ...r, saldo385Final: r.saldo385, docStatus: "batido" as DocStatus };
      }
      if (diff > 0) {
        // SALDO > VALOR FRETE → ajusta pra baixo (regra: nunca pra cima)
        return { ...r, saldo385Final: r.valorFrete, docStatus: "ajustado" as DocStatus };
      }
      // SALDO < VALOR FRETE → os docs adicionados devem cobrir a diferença
      return { ...r, saldo385Final: r.saldo385, docStatus: "pendente" as DocStatus };
    });
  }

  // Totais para conferência
  const totalValorFrete = rows
    .filter((r) => !r.isAdded)
    .reduce((s, r) => s + r.valorFrete, 0);

  const totalSaldo385 = rows
    .filter((r) => isNumericDoc(r.documentoFrete))
    .reduce((s, r) => s + (r.saldo385Final ?? 0), 0);

  return {
    instrucaoFilial,
    caseType,
    rows,
    totalValorFrete,
    totalSaldo385,
    isBalanced: Math.abs(totalValorFrete - totalSaldo385) < 0.01,
  };
};

// ─── Excel Output ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<DocStatus, string> = {
  batido: "BATIDO",
  ajustado: "AJUSTADO",
  adicionado: "ADICIONADO",
  adiantamento: "ADIANTAMENTO",
  nd: "ND",
  pendente: "PENDENTE",
};

const buildImportSheet = (groups: FilialGroup[]) => {
  const headers = ["FILIAL", "SERIE", "N DOC", "TIPO DOCUMENTO", "VALOR PAGO"];

  const importRows = groups
    .flatMap((g) => g.rows)
    .filter((r) => isNumericDoc(r.documentoFrete) && r.saldo385Final != null && r.saldo385Final > 0)
    .map((r) => [1, 0, r.documentoRodopar, "CTRC", r.saldo385Final]);

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...importRows]);
  sheet["!cols"] = [{ wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
  return { sheet, count: importRows.length };
};

const buildOutputWorkbook = (
  groups: FilialGroup[],
  allOriginalRows: JBSRow[],
  allBalanced: boolean
) => {
  const wb = XLSX.utils.book_new();

  // ── Aba 1: Processado ──
  const processedHeaders = [
    "Empresa", "Instrução Matriz", "Instrução Filial", "Placa",
    "Documento Frete", "Documento Frete.1", "DOCUMENTO RODOPAR",
    "Canhoto Baixado", "Título Financeiro", "Parcela", "Data Vencimento",
    "Rodopar", "Valor Frete", "SALDO 385",
    "Data Liberacao", "Número do Lote", "Status", "Data da Antecipação",
    "Valor Bloqueado", "Valor Descontado", "Saldo a Receber",
    "Valor Quitado", "Data Pagamento", "Número Formulário", "Série Formulário",
    "STATUS PROCESSAMENTO",
  ];

  const allProcessed = groups.flatMap((g) => g.rows);

  const processedData = allProcessed.map((r) => [
    r.empresa,
    r.instrucaoMatriz,
    r.instrucaoFilial,
    r.placa,
    r.documentoFrete,
    r.documentoFrete2,
    r.documentoRodopar,
    r.canhotoBaixado,
    r.tituloFinanceiro,
    r.parcela,
    r.dataVencimento,
    r.rodopar ?? "",
    r.isAdded ? "" : r.valorFrete,   // VALOR FRETE zerado em linhas adicionadas
    r.saldo385Final ?? "",
    r.dataLiberacao,
    r.numeroLote,
    r.statusPortal,
    r.dataAntecipacao ? fmtDateBR(r.dataAntecipacao) : "",
    r.valorBloqueado,
    r.valorDescontado,
    r.saldoAReceber,
    r.valorQuitado,
    r.dataPagamento,
    r.numeroFormulario,
    r.serieFormulario,
    STATUS_LABEL[r.docStatus],
  ]);

  const processedSheet = XLSX.utils.aoa_to_sheet([processedHeaders, ...processedData]);
  processedSheet["!cols"] = processedHeaders.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, processedSheet, "Processado");

  // ── Aba 2: Backup (cópia integral do original) ──
  const backupHeaders = [
    "Empresa", "Instrução Matriz", "Instrução Filial", "Placa",
    "Documento Frete", "Documento Frete.1", "Canhoto Baixado",
    "Título Financeiro", "Parcela", "Data Vencimento", "Rodopar",
    "Valor Frete", "Data Liberacao", "Número do Lote", "Status",
    "Data da Antecipação", "Valor Bloqueado", "Valor Descontado",
    "Saldo a Receber", "Valor Quitado", "Data Pagamento",
    "Número Formulário", "Série Formulário",
  ];

  const backupData = allOriginalRows.map((r) => [
    r.empresa, r.instrucaoMatriz, r.instrucaoFilial, r.placa,
    r.documentoFrete, r.documentoFrete2, r.canhotoBaixado,
    r.tituloFinanceiro, r.parcela, r.dataVencimento,
    r.rodopar ?? "", r.valorFrete, r.dataLiberacao,
    r.numeroLote, r.statusPortal,
    r.dataAntecipacao ? fmtDateBR(r.dataAntecipacao) : "",
    r.valorBloqueado, r.valorDescontado, r.saldoAReceber,
    r.valorQuitado, r.dataPagamento, r.numeroFormulario, r.serieFormulario,
  ]);

  const backupSheet = XLSX.utils.aoa_to_sheet([backupHeaders, ...backupData]);
  backupSheet["!cols"] = backupHeaders.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, backupSheet, "Backup");

  // ── Aba 3: Importação (somente se tudo estiver balanceado) ──
  if (allBalanced) {
    const { sheet: importSheet } = buildImportSheet(groups);
    XLSX.utils.book_append_sheet(wb, importSheet, "DOCUMENTO");
  }

  return wb;
};

// ─── Style constants ──────────────────────────────────────────────────────────

const sectionCard =
  "rounded-[28px] border border-border bg-card shadow-[0_14px_40px_rgba(0,0,0,0.22)]";
const metricTitle = "text-[11px] uppercase tracking-[0.18em] text-muted-foreground";

const DOC_STATUS_CFG: Record<DocStatus, { label: string; className: string }> = {
  batido: {
    label: "Batido",
    className: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
  },
  ajustado: {
    label: "Ajustado",
    className: "bg-amber-500/10 text-amber-300 border border-amber-500/20",
  },
  adicionado: {
    label: "Adicionado",
    className: "bg-sky-500/10 text-sky-300 border border-sky-500/20",
  },
  adiantamento: {
    label: "Adiantamento",
    className: "bg-violet-500/10 text-violet-300 border border-violet-500/20",
  },
  nd: {
    label: "ND",
    className: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
  },
  pendente: {
    label: "Pendente",
    className: "bg-red-500/10 text-red-300 border border-red-500/20",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

const JBS = () => {
  const navigate = useNavigate();

  const [jbsFile, setJbsFile] = useState<File | null>(null);
  const [r385File, setR385File] = useState<File | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [bankValue, setBankValue] = useState("");
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [valueMismatch, setValueMismatch] = useState<{
    total: number;
    bank: number;
  } | null>(null);

  const canProcess = useMemo(
    () => Boolean(jbsFile && r385File && selectedDate && bankValue && !processing),
    [jbsFile, r385File, selectedDate, bankValue, processing]
  );

  const handleProcess = async () => {
    if (!jbsFile || !r385File) {
      toast.error("Anexe as duas planilhas.");
      return;
    }
    if (!selectedDate) {
      toast.error("Informe a data da antecipação.");
      return;
    }
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    if (!bankValue.trim()) {
      toast.error("Informe o valor do banco.");
      return;
    }

    try {
      setProcessing(true);
      setSummary(null);
      setValueMismatch(null);

      const [jbsBuf, r385Buf] = await Promise.all([
        jbsFile.arrayBuffer(),
        r385File.arrayBuffer(),
      ]);

      const jbsWb = XLSX.read(jbsBuf, { type: "array", cellDates: true });
      const r385Wb = XLSX.read(r385Buf, { type: "array", cellDates: true });

      const jbsSheet = jbsWb.Sheets[jbsWb.SheetNames[0]];
      const r385Sheet = r385Wb.Sheets[r385Wb.SheetNames[0]];

      const map385 = build385Map(r385Sheet);
      if (map385.size === 0) {
        throw new Error(
          "Não localizei as colunas CODCON / Saldo no Relatório 385."
        );
      }

      const allRows = parseJBS(jbsSheet, map385);
      const filteredRows = allRows.filter((r) => r.dataAntecipacao === dateStr);

      if (filteredRows.length === 0) {
        throw new Error("Nenhuma linha encontrada para a data informada.");
      }

      // Verificação de valor
      const totalValorFrete = filteredRows.reduce((s, r) => s + r.valorFrete, 0);
      const bankValueNumber = parseCurrencyInput(bankValue);

      if (Math.abs(totalValorFrete - bankValueNumber) > 0.01) {
        setValueMismatch({ total: totalValorFrete, bank: bankValueNumber });
        return;
      }

      // Agrupa por Instrução Filial
      const grouped = new Map<string, JBSRow[]>();
      for (const row of filteredRows) {
        const key = row.instrucaoFilial || "(vazio)";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push({ ...row });
      }

      const groups: FilialGroup[] = [];
      for (const [filial, rows] of grouped) {
        groups.push(processGroup(filial, rows, allRows));
      }

      // Contagens
      const all = groups.flatMap((g) => g.rows);
      const batidoCount = all.filter((r) => r.docStatus === "batido").length;
      const ajustadoCount = all.filter((r) => r.docStatus === "ajustado").length;
      const adicionadoCount = all.filter((r) => r.docStatus === "adicionado").length;
      const ndCount = all.filter((r) => r.docStatus === "nd").length;
      const pendingCount = all.filter((r) => r.docStatus === "pendente").length;

      // Verifica se todos os grupos estão balanceados → libera importação
      const allBalanced = groups.every((g) => g.isBalanced);
      const { count: importacaoCount } = allBalanced
        ? buildImportSheet(groups)
        : { count: 0 };

      // Gera Excel e faz download
      const wb = buildOutputWorkbook(groups, allRows, allBalanced);
      XLSX.writeFile(wb, `jbs-processado-${dateStr}.xlsx`);

      setSummary({
        selectedDate: dateStr,
        bankValue: bankValueNumber,
        totalValorFrete,
        groups,
        batidoCount,
        ajustadoCount,
        adicionadoCount,
        ndCount,
        pendingCount,
        allBalanced,
        importacaoCount,
      });

      toast.success("Processamento concluído. Planilha gerada!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar.");
    } finally {
      setProcessing(false);
    }
  };

  const ndRows = useMemo(
    () => summary?.groups.flatMap((g) => g.rows).filter((r) => r.docStatus === "nd") ?? [],
    [summary]
  );

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1560px] py-2">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="mb-7"
        >
          <div className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.08),transparent_28%)]" />
            <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground transition-all duration-200 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-400">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Cliente JBS
                  </div>
                  <h1 className="text-[28px] font-semibold leading-none tracking-tight text-foreground lg:text-[32px]">
                    Processamento de Antecipação
                  </h1>
                  <p className="mt-3 max-w-3xl text-[15px] leading-7 text-muted-foreground">
                    Informe a data e o valor do banco, anexe a Gestão Financeira do portal
                    JBS e o Relatório 385. O sistema cruza os documentos por Instrução
                    Filial, identifica divergências e gera a planilha processada.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[420px]">
                <div className="rounded-2xl border border-border bg-muted/30 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-400/80">Entrada</p>
                  <p className="mt-2 text-sm font-medium text-foreground">Gestão Financeira + Rel. 385</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-400/80">Saída</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-foreground">Planilha processada + conferência</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Inputs ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.3 }}
          className="mb-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]"
        >
          {/* Parâmetros */}
          <div className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_28%)]" />
            <div className="relative p-6 lg:p-7">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/[0.18] text-violet-300">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Parâmetros</h2>
                  <p className="text-sm text-muted-foreground">
                    Data e valor do banco para conferência.
                  </p>
                </div>
              </div>

              <div className="grid gap-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground/90">
                    Data da antecipação
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "h-12 w-full rounded-xl border border-border bg-muted/50 px-4 text-sm text-left flex items-center gap-3 transition-colors hover:border-violet-500/40",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="h-4 w-4 text-violet-400 shrink-0" />
                        {selectedDate
                          ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                          : "Selecione a data"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground/90">
                    Valor banco
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={bankValue}
                    onChange={(e) => setBankValue(formatCurrencyInput(e.target.value))}
                    className="h-12 w-full rounded-xl border border-border bg-muted/50 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10"
                  />
                </div>

                {/* Alerta de valor divergente */}
                {valueMismatch && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                    <div className="flex items-start gap-3 text-red-300">
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">Valor não bate!</p>
                        <p className="mt-1.5 text-xs leading-6 text-red-200/80">
                          Total Valor Frete:{" "}
                          <span className="font-semibold text-red-200">
                            {fmtCurrencyBR(valueMismatch.total)}
                          </span>
                          <br />
                          Valor banco informado:{" "}
                          <span className="font-semibold text-red-200">
                            {fmtCurrencyBR(valueMismatch.bank)}
                          </span>
                          <br />
                          Diferença:{" "}
                          <span className="font-semibold text-red-200">
                            {fmtCurrencyBR(Math.abs(valueMismatch.total - valueMismatch.bank))}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.08] p-4">
                  <p className="text-sm leading-7 text-muted-foreground">
                    O sistema filtra pela data, confere o valor total e processa
                    cada Instrução Filial de acordo com os documentos encontrados.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={!canProcess}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border-0 bg-[linear-gradient(135deg,rgba(99,102,241,0.9),rgba(139,92,246,0.8))] px-5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(139,92,246,0.25)] transition-all duration-200 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Processar e baixar planilha
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Uploads */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Gestão Financeira */}
            <label
              className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#11131c]/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.28)] cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && /\.(xlsx?|xls)$/i.test(f.name)) setJbsFile(f);
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.14),transparent_32%)]" />
              <div className="relative">
                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/[0.18] text-violet-300">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Gestão Financeira</h2>
                    <p className="text-sm text-white/55">Planilha do portal JBS.</p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-dashed border-violet-400/25 bg-[linear-gradient(180deg,rgba(139,92,246,0.09),rgba(139,92,246,0.03))] px-6 py-14 text-center transition-all duration-200 hover:border-violet-400/45 hover:bg-[linear-gradient(180deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05))]">
                  {jbsFile ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-violet-400/30 bg-violet-500/[0.18]">
                        <FileCheck className="h-7 w-7 text-violet-300" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-white">{jbsFile.name}</p>
                        <p className="mt-1 text-sm text-white/55">Clique para trocar.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-violet-400/25 bg-violet-500/[0.15]">
                        <UploadCloud className="h-8 w-8 text-violet-300" />
                      </div>
                      <p className="text-xl font-semibold text-white">Selecione o arquivo</p>
                      <p className="mt-3 text-sm text-white/50">Formatos aceitos: .xlsx e .xls</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setJbsFile(e.target.files?.[0] || null)}
                />
              </div>
            </label>

            {/* Relatório 385 */}
            <label
              className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#11131c]/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.28)] cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && /\.(xlsx?|xls)$/i.test(f.name)) setR385File(f);
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.14),transparent_32%)]" />
              <div className="relative">
                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/[0.18] text-violet-300">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Relatório 385</h2>
                    <p className="text-sm text-white/55">Base de conferência do sistema.</p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-dashed border-violet-400/25 bg-[linear-gradient(180deg,rgba(139,92,246,0.09),rgba(139,92,246,0.03))] px-6 py-14 text-center transition-all duration-200 hover:border-violet-400/45 hover:bg-[linear-gradient(180deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05))]">
                  {r385File ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-violet-400/30 bg-violet-500/[0.18]">
                        <FileCheck className="h-7 w-7 text-violet-300" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-white">{r385File.name}</p>
                        <p className="mt-1 text-sm text-white/55">Clique para trocar.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-violet-400/25 bg-violet-500/[0.15]">
                        <UploadCloud className="h-8 w-8 text-violet-300" />
                      </div>
                      <p className="text-xl font-semibold text-white">Selecione o relatório</p>
                      <p className="mt-3 text-sm text-white/50">Formatos aceitos: .xlsx e .xls</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setR385File(e.target.files?.[0] || null)}
                />
              </div>
            </label>
          </div>
        </motion.div>

        {/* ── Results ────────────────────────────────────────────────────── */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-7 space-y-5"
          >
            {/* Métricas gerais */}
            <div className={`${sectionCard} overflow-hidden`}>
              <div className="relative overflow-hidden p-6 sm:p-7">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_22%)]" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Resultado do processamento
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-white">
                    {fmtDateBR(summary.selectedDate)} —{" "}
                    {fmtCurrencyBR(summary.totalValorFrete)}
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    {summary.groups.length} instrução(ões) filial processada(s)
                  </p>

                  {/* Status da importação */}
                  <div className="mt-4">
                    {summary.allBalanced ? (
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        <span className="text-sm font-semibold text-emerald-300">
                          Conferência OK — planilha de importação gerada com{" "}
                          {summary.importacaoCount} documento(s)
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
                        <AlertTriangle className="h-4 w-4 text-amber-300" />
                        <span className="text-sm font-semibold text-amber-300">
                          Importação pendente — há grupos com valores divergentes
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {[
                      {
                        label: "Batidos",
                        value: summary.batidoCount,
                        color: "text-emerald-300",
                        bg: "border-emerald-500/15 bg-emerald-500/8",
                      },
                      {
                        label: "Ajustados",
                        value: summary.ajustadoCount,
                        color: "text-amber-300",
                        bg: "border-amber-500/15 bg-amber-500/8",
                      },
                      {
                        label: "Adicionados",
                        value: summary.adicionadoCount,
                        color: "text-sky-300",
                        bg: "border-sky-500/15 bg-sky-500/8",
                      },
                      {
                        label: "ND",
                        value: summary.ndCount,
                        color: "text-zinc-400",
                        bg: "border-white/10 bg-white/[0.03]",
                      },
                      {
                        label: "Pendentes",
                        value: summary.pendingCount,
                        color: summary.pendingCount > 0 ? "text-red-300" : "text-white",
                        bg:
                          summary.pendingCount > 0
                            ? "border-red-500/15 bg-red-500/8"
                            : "border-white/10 bg-white/[0.03]",
                      },
                    ].map(({ label, value, color, bg }) => (
                      <div
                        key={label}
                        className={`rounded-3xl border p-4 ${bg}`}
                      >
                        <p className={metricTitle}>{label}</p>
                        <p className={`mt-2 text-3xl font-semibold tracking-tight ${color}`}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Detalhamento por Instrução Filial */}
            <div className={`${sectionCard} overflow-hidden`}>
              <div className="border-b border-white/10 px-5 py-4 sm:px-6">
                <p className="text-sm font-semibold text-white">
                  Detalhamento por Instrução Filial
                </p>
                <p className="text-xs text-white/50">
                  {summary.groups.length} grupo(s) · clique para expandir
                </p>
              </div>
              <div className="divide-y divide-white/5">
                {summary.groups.map((group) => (
                  <details key={group.instrucaoFilial} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.02] sm:px-6">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">
                          Instrução Filial {group.instrucaoFilial}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/50">
                          Caso {group.caseType}
                        </span>
                        <span className="text-xs text-white/30">
                          {group.rows.length} linha(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white/50">
                          {fmtCurrencyBR(group.totalValorFrete)}
                        </span>
                        {group.isBalanced ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                        )}
                      </div>
                    </summary>

                    <div className="overflow-x-auto border-t border-white/5">
                      <div className="min-w-[900px]">
                        <div className="grid grid-cols-[130px_150px_150px_160px_160px_130px] gap-2 bg-white/[0.02] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 sm:px-6">
                          <div>Doc. Frete</div>
                          <div>Doc. Rodopar</div>
                          <div>Valor Frete</div>
                          <div>Saldo 385</div>
                          <div>Saldo Final</div>
                          <div>Status</div>
                        </div>
                        {group.rows.map((row, i) => {
                          const cfg = DOC_STATUS_CFG[row.docStatus];
                          return (
                            <div
                              key={`${row.instrucaoFilial}-${row.documentoFrete}-${row.idx}-${i}`}
                              className={`grid grid-cols-[130px_150px_150px_160px_160px_130px] gap-2 px-5 py-3 text-sm text-white/80 sm:px-6 ${
                                i % 2 === 0 ? "" : "bg-white/[0.015]"
                              }`}
                            >
                              <div className="font-medium text-white truncate">
                                {row.documentoFrete}
                              </div>
                              <div className="truncate">{row.documentoRodopar || "—"}</div>
                              <div>
                                {row.isAdded ? "—" : fmtCurrencyBR(row.valorFrete)}
                              </div>
                              <div>
                                {row.saldo385 != null ? fmtCurrencyBR(row.saldo385) : "—"}
                              </div>
                              <div>
                                {row.saldo385Final != null
                                  ? fmtCurrencyBR(row.saldo385Final)
                                  : "—"}
                              </div>
                              <div>
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cfg.className}`}
                                >
                                  {cfg.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Totais do grupo */}
                        <div className="grid grid-cols-[130px_150px_150px_160px_160px_130px] gap-2 border-t border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white sm:px-6">
                          <div className="col-span-2 text-white/50 text-xs uppercase tracking-widest">
                            Total
                          </div>
                          <div>{fmtCurrencyBR(group.totalValorFrete)}</div>
                          <div />
                          <div
                            className={
                              group.isBalanced ? "text-emerald-300" : "text-amber-300"
                            }
                          >
                            {fmtCurrencyBR(group.totalSaldo385)}
                          </div>
                          <div>
                            {group.isBalanced ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" /> OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                                <AlertTriangle className="h-3 w-3" /> Diverge
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>

            {/* Tabela ND */}
            {ndRows.length > 0 && (
              <div className={`${sectionCard} overflow-hidden`}>
                <div className="border-b border-white/10 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <Info className="h-4 w-4 text-zinc-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Documentos ND — Não Documentados ({ndRows.length})
                      </p>
                      <p className="text-xs text-white/50">
                        Linhas com "–" no Documento Frete que precisam de atenção manual.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[900px]">
                    <div className="grid grid-cols-[160px_160px_180px_220px_160px_180px] gap-2 bg-white/[0.02] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 sm:px-6">
                      <div>Empresa</div>
                      <div>Instr. Filial</div>
                      <div>Placa</div>
                      <div>Título Financeiro</div>
                      <div>Valor Frete</div>
                      <div>Data Liberação</div>
                    </div>
                    {ndRows.map((row, i) => (
                      <div
                        key={`nd-${row.instrucaoFilial}-${row.idx}-${i}`}
                        className={`grid grid-cols-[160px_160px_180px_220px_160px_180px] gap-2 px-5 py-3 text-sm text-white/80 sm:px-6 ${
                          i % 2 === 0 ? "" : "bg-white/[0.015]"
                        }`}
                      >
                        <div className="font-medium text-white">{row.empresa}</div>
                        <div>{row.instrucaoFilial}</div>
                        <div>{row.placa}</div>
                        <div className="truncate">{row.tituloFinanceiro}</div>
                        <div>{fmtCurrencyBR(row.valorFrete)}</div>
                        <div>{row.dataLiberacao}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default JBS;
