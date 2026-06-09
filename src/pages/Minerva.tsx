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

type PreviewRowStatus =
  | "válida"
  | "não localizado"
  | "sem valor"
  | "removida por pagamento"
  | "duplicado ignorado";

type PreviewRow = {
  line: number;
  dueDate: string;
  paymentDate: string;
  invoiceNumber: string;
  grossValue: number;
  status: PreviewRowStatus;
};

type ProcessSummary = {
  selectedDate: string;
  reportRows: number;
  uniqueDocs: number;
  matchedRows: number;
  missingDocs: string[];
  totalProcessed: number;
  bankValue: number;
  difference: number;
  status: "ok" | "diverge";
  emptyPaymentCount: number;
  filledPaymentCount: number;
  removedByPaymentCount: number;
  duplicateIgnoredCount: number;
  finalValidCount: number;
  errorCount: number;
  previewRows: PreviewRow[];
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const normalizeDocument = (value: unknown) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");

const parseConhecimentos = (value: unknown) => {
  const matches = String(value ?? "").match(/\d+/g) ?? [];
  return matches.map(normalizeDocument).filter(Boolean);
};

const formatDateBR = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

const normalizeDateValue = (value: unknown): string | null => {
  if (!value && value !== 0) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const year = String(parsed.y);
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const clean = raw.replace(/,/g, ".").replace(/\//g, ".").split(" ")[0];

  let match = clean.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month}-${day}`;
  }

  match = clean.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month}-${day}`;
  }

  return null;
};

const safeFormatDateBR = (value: unknown) => {
  const normalized = normalizeDateValue(value);
  return normalized ? formatDateBR(normalized) : "";
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrencyBR = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatSignedCurrencyBR = (value: number) => {
  const formatted = formatCurrencyBR(Math.abs(value));
  return value < 0 ? `- ${formatted}` : formatted;
};

const getCellValue = (sheet: XLSX.WorkSheet, colIndex: number, rowIndex: number) => {
  const address = XLSX.utils.encode_cell({ c: colIndex, r: rowIndex });
  return sheet[address]?.v;
};

const setCellValue = (
  sheet: XLSX.WorkSheet,
  colIndex: number,
  rowIndex: number,
  value: string | number
) => {
  const address = XLSX.utils.encode_cell({ c: colIndex, r: rowIndex });
  sheet[address] = {
    t: typeof value === "number" ? "n" : "s",
    v: value,
  };

  const currentRef = sheet["!ref"] || "A1:A1";
  const range = XLSX.utils.decode_range(currentRef);

  if (colIndex > range.e.c) range.e.c = colIndex;
  if (rowIndex > range.e.r) range.e.r = rowIndex;

  sheet["!ref"] = XLSX.utils.encode_range(range);
};

const getHeaderMap = (sheet: XLSX.WorkSheet) => {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const headers = new Map<number, string>();

  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const raw = getCellValue(sheet, c, 0);
    headers.set(c, normalizeText(String(raw ?? "")));
  }

  return headers;
};

const findColumn = (sheet: XLSX.WorkSheet, candidates: string[]) => {
  const headers = getHeaderMap(sheet);
  const normalizedCandidates = candidates.map(normalizeText);

  for (const [colIndex, header] of headers.entries()) {
    if (!header) continue;

    if (normalizedCandidates.some((candidate) => header.includes(candidate))) {
      return colIndex;
    }
  }

  return -1;
};

const autoSize = (sheet: XLSX.WorkSheet, widths: number[]) => {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
};

const buildImportWorkbook = (
  rows: Array<[number, number, string, string, number, string]>,
  missingDocs: string[]
) => {
  const workbook = XLSX.utils.book_new();

  const importSheet = XLSX.utils.aoa_to_sheet([
    ["FILIAL", "SERIE", "Nº DOCUMENTO", "TIPO DOCUMENTO", "VALOR PAGO", "DATA EMISSÃO"],
    ...rows,
  ]);

  autoSize(importSheet, [10, 10, 18, 18, 16, 16]);
  XLSX.utils.book_append_sheet(workbook, importSheet, "DOCUMENTO");

  if (missingDocs.length > 0) {
    const missingSheet = XLSX.utils.aoa_to_sheet([
      ["DOCUMENTOS NÃO LOCALIZADOS"],
      ...missingDocs.map((doc) => [doc]),
    ]);

    autoSize(missingSheet, [28]);
    XLSX.utils.book_append_sheet(workbook, missingSheet, "Nao Localizados");
  }

  return workbook;
};

const pickReportSheet = (workbook: XLSX.WorkBook) =>
  workbook.SheetNames.find((name) => normalizeText(name).includes("antecip")) ||
  workbook.SheetNames[0];

const pickPlanilhaZeroSheet = (workbook: XLSX.WorkBook) =>
  workbook.SheetNames.find((name) => {
    const normalized = normalizeText(name);
    return (
      normalized === "planilha1" ||
      normalized.includes("planilha 0") ||
      normalized.includes("planilha0")
    );
  }) ||
  workbook.SheetNames.find((name) => !normalizeText(name).includes("resumo")) ||
  workbook.SheetNames[0];

const parseCurrencyInputToNumber = (value: string) => {
  if (!value.trim()) return 0;

  const onlyNumbers = value.replace(/[^\d,.-]/g, "");
  return toNumber(onlyNumbers);
};

const formatCurrencyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const number = Number(digits) / 100;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(number);
};

type CandidateRow = {
  line: number;
  invoiceNumber: string;
  grossValue: number;
  paymentDate: string;
};

const getCandidateScore = (candidate: CandidateRow) => {
  const hasValue = candidate.grossValue > 0 ? 1_000_000 : 0;
  const valueScore = Math.round(candidate.grossValue * 100);
  const hasDate = candidate.paymentDate ? 100 : 0;

  return hasValue + valueScore + hasDate;
};

const pickBestCandidate = (current: CandidateRow | undefined, incoming: CandidateRow) => {
  if (!current) return incoming;

  const currentScore = getCandidateScore(current);
  const incomingScore = getCandidateScore(incoming);

  if (incomingScore > currentScore) return incoming;
  if (incomingScore < currentScore) return current;

  return incoming.line < current.line ? incoming : current;
};

const getStatusBadgeClass = (status: PreviewRowStatus) => {
  switch (status) {
    case "válida":
      return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
    case "não localizado":
      return "bg-amber-500/10 text-amber-300 border border-amber-500/20";
    case "sem valor":
      return "bg-slate-500/10 text-slate-300 border border-slate-500/20";
    case "removida por pagamento":
      return "bg-zinc-500/10 text-zinc-300 border border-zinc-500/20";
    case "duplicado ignorado":
      return "bg-sky-500/10 text-sky-300 border border-sky-500/20";
    default:
      return "bg-muted text-muted-foreground border border-border";
  }
};

const sectionCardClass =
  "rounded-[28px] border border-border bg-card shadow-[0_14px_40px_rgba(0,0,0,0.22)]";
const metricCardClass =
  "rounded-3xl border border-border bg-muted/30 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-500/20";
const metricTitleClass = "text-[11px] uppercase tracking-[0.18em] text-muted-foreground";
const metricValueClass = "mt-2 text-2xl font-semibold tracking-tight text-foreground";

const Minerva = () => {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [bankValue, setBankValue] = useState("");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [planilhaZeroFile, setPlanilhaZeroFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<ProcessSummary | null>(null);

  const canProcess = useMemo(
    () => Boolean(selectedDate && bankValue && reportFile && planilhaZeroFile && !processing),
    [selectedDate, bankValue, reportFile, planilhaZeroFile, processing]
  );

  const handleBankValueChange = (value: string) => {
    setBankValue(formatCurrencyInput(value));
  };

  const handleProcess = async () => {
    if (!selectedDate) {
      toast.error("Informe a data antes de processar.");
      return;
    }
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    if (!bankValue.trim()) {
      toast.error("Informe o valor do banco antes de processar.");
      return;
    }

    if (!reportFile || !planilhaZeroFile) {
      toast.error("Anexe as duas planilhas.");
      return;
    }

    try {
      setProcessing(true);
      setSummary(null);

      const reportBuffer = await reportFile.arrayBuffer();
      const planilhaZeroBuffer = await planilhaZeroFile.arrayBuffer();

      const reportWorkbook = XLSX.read(reportBuffer, { type: "array", cellDates: true });
      const planilhaZeroWorkbook = XLSX.read(planilhaZeroBuffer, {
        type: "array",
        cellDates: true,
      });

      const reportSheet = reportWorkbook.Sheets[pickReportSheet(reportWorkbook)];
      const planilhaZeroSheet = planilhaZeroWorkbook.Sheets[pickPlanilhaZeroSheet(planilhaZeroWorkbook)];

      const reportDateCol = findColumn(reportSheet, ["antecipado", "antecipacao", "antecipação"]);
      const reportConhecimentoCol = findColumn(reportSheet, [
        "conhecimento frete",
        "conhecimento",
        "frete",
      ]);

      const numeroCol = findColumn(planilhaZeroSheet, ["numero", "número"]);
      const valorReceberCol = findColumn(planilhaZeroSheet, ["valor a receber"]);
      const dataEmissaoCol = findColumn(planilhaZeroSheet, [
        "data de emissao",
        "data emissão",
        "data emissao",
        "emissao",
        "emissão",
      ]);
      const statusCol = findColumn(planilhaZeroSheet, [
        "status",
        "status cte",
        "status do cte",
        "situacao",
        "situação",
        "situacao do cte",
        "situação do cte",
        "estado",
        "tipo",
      ]);

      if (reportDateCol < 0 || reportConhecimentoCol < 0) {
        throw new Error(
          "Não consegui localizar as colunas de antecipação / conhecimento frete no relatório."
        );
      }

      if (numeroCol < 0 || valorReceberCol < 0) {
        throw new Error("Não consegui localizar as colunas Número / Valor a Receber na Planilha 0.");
      }

      if (dataEmissaoCol < 0) {
        throw new Error("Não consegui localizar a coluna Data de Emissão na Planilha 0.");
      }

      const reportRange = XLSX.utils.decode_range(reportSheet["!ref"] || "A1:A1");
      const planilhaZeroRange = XLSX.utils.decode_range(planilhaZeroSheet["!ref"] || "A1:A1");

      const normalizeForStatus = (v: unknown) =>
        String(v ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toUpperCase();

      const inutilizadoRows = new Set<number>();

      for (let r = 1; r <= planilhaZeroRange.e.r; r += 1) {
        let isInutilizado = false;

        if (statusCol >= 0) {
          const statusValue = normalizeForStatus(
            getCellValue(planilhaZeroSheet, statusCol, r)
          );

          if (statusValue.includes("INUTILIZ")) {
            isInutilizado = true;
          }
        }

        if (!isInutilizado) {
          for (let c = planilhaZeroRange.s.c; c <= planilhaZeroRange.e.c; c += 1) {
            const value = normalizeForStatus(getCellValue(planilhaZeroSheet, c, r));
            if (value.includes("INUTILIZ")) {
              isInutilizado = true;
              break;
            }
          }
        }

        if (isInutilizado) {
          inutilizadoRows.add(r);
        }
      }

      console.log("Planilha 0 - total de linhas:", planilhaZeroRange.e.r);
      console.log("Planilha 0 - inutilizados removidos:", inutilizadoRows.size);

      const docsSet = new Set<string>();
      let filteredReportRows = 0;

      for (let r = 1; r <= reportRange.e.r; r += 1) {
        const anticipationDate = normalizeDateValue(getCellValue(reportSheet, reportDateCol, r));
        if (anticipationDate !== dateStr) continue;

        filteredReportRows += 1;

        const conhecimentos = parseConhecimentos(getCellValue(reportSheet, reportConhecimentoCol, r));
        conhecimentos.forEach((doc) => docsSet.add(doc));
      }

      if (filteredReportRows === 0 || docsSet.size === 0) {
        throw new Error("Nenhum conhecimento foi encontrado para a data informada.");
      }

      const matchedDocs = new Set<string>();
      const importRows: Array<[number, number, string, string, number, string]> = [];
      const previewRows: PreviewRow[] = [];
      const markerColumn = 11;
      const markerHeader = "Data Antecipação";
      const markerDate = formatDateBR(dateStr);
      const bestCandidates = new Map<string, CandidateRow>();
      const duplicatePreviewRows: PreviewRow[] = [];

      let totalProcessed = 0;
      let emptyPaymentCount = 0;
      let filledPaymentCount = 0;
      let removedByPaymentCount = 0;
      let duplicateIgnoredCount = 0;
      let finalValidCount = 0;
      let errorCount = 0;

      setCellValue(planilhaZeroSheet, markerColumn, 0, markerHeader);

      for (let r = 1; r <= planilhaZeroRange.e.r; r += 1) {
        if (inutilizadoRows.has(r)) continue;

        const numero = normalizeDocument(getCellValue(planilhaZeroSheet, numeroCol, r));
        if (!numero || !docsSet.has(numero)) continue;

        matchedDocs.add(numero);

        const valorReceber = toNumber(getCellValue(planilhaZeroSheet, valorReceberCol, r));
        const dataEmissaoBr = safeFormatDateBR(getCellValue(planilhaZeroSheet, dataEmissaoCol, r));
        const candidate: CandidateRow = {
          line: r + 1,
          invoiceNumber: numero,
          grossValue: valorReceber,
          paymentDate: dataEmissaoBr,
        };

        const previousBest = bestCandidates.get(numero);
        const nextBest = pickBestCandidate(previousBest, candidate);

        if (previousBest && nextBest.line !== previousBest.line) {
          duplicateIgnoredCount += 1;
          duplicatePreviewRows.push({
            line: previousBest.line,
            dueDate: markerDate,
            paymentDate: previousBest.paymentDate,
            invoiceNumber: numero,
            grossValue: previousBest.grossValue,
            status: "duplicado ignorado",
          });
        }

        if (previousBest && nextBest.line !== candidate.line) {
          duplicateIgnoredCount += 1;
          duplicatePreviewRows.push({
            line: candidate.line,
            dueDate: markerDate,
            paymentDate: candidate.paymentDate,
            invoiceNumber: numero,
            grossValue: candidate.grossValue,
            status: "duplicado ignorado",
          });
        }

        bestCandidates.set(numero, nextBest);
      }

      Array.from(bestCandidates.values())
        .sort((a, b) => a.line - b.line)
        .forEach((candidate) => {
          const sourceRowIndex = candidate.line - 1;
          setCellValue(planilhaZeroSheet, markerColumn, sourceRowIndex, markerDate);

          const hasValue = candidate.grossValue > 0;
          const previewStatus: PreviewRowStatus = hasValue ? "válida" : "sem valor";

          if (hasValue) {
            filledPaymentCount += 1;
            finalValidCount += 1;
            totalProcessed += candidate.grossValue;
          } else {
            emptyPaymentCount += 1;
            removedByPaymentCount += 1;
          }

          importRows.push([
            1,
            26,
            candidate.invoiceNumber,
            "CTRC",
            candidate.grossValue,
            candidate.paymentDate,
          ]);

          if (previewRows.length < 20) {
            previewRows.push({
              line: candidate.line,
              dueDate: markerDate,
              paymentDate: candidate.paymentDate,
              invoiceNumber: candidate.invoiceNumber,
              grossValue: candidate.grossValue,
              status: previewStatus,
            });
          }
        });

      if (previewRows.length < 20 && duplicatePreviewRows.length > 0) {
        duplicatePreviewRows
          .sort((a, b) => a.line - b.line)
          .slice(0, 20 - previewRows.length)
          .forEach((row) => previewRows.push(row));
      }

      const missingDocs = Array.from(docsSet)
        .filter((doc) => !matchedDocs.has(doc))
        .sort((a, b) => Number(a) - Number(b));

      if (missingDocs.length > 0) {
        errorCount += missingDocs.length;

        const remainingPreviewSlots = 20 - previewRows.length;
        if (remainingPreviewSlots > 0) {
          missingDocs.slice(0, remainingPreviewSlots).forEach((doc, index) => {
            previewRows.push({
              line: previewRows.length + index + 2,
              dueDate: markerDate,
              paymentDate: "",
              invoiceNumber: doc,
              grossValue: 0,
              status: "não localizado",
            });
          });
        }
      }

      const importWorkbook = buildImportWorkbook(importRows, missingDocs);
      XLSX.writeFile(importWorkbook, `minerva-importacao-${dateStr}.xlsx`);

      const bankValueNumber = parseCurrencyInputToNumber(bankValue);
      const difference = totalProcessed - bankValueNumber;
      const status = Math.abs(difference) < 0.01 ? "ok" : "diverge";

      setSummary({
        selectedDate: dateStr,
        reportRows: filteredReportRows,
        uniqueDocs: docsSet.size,
        matchedRows: importRows.length,
        missingDocs,
        totalProcessed,
        bankValue: bankValueNumber,
        difference,
        status,
        emptyPaymentCount,
        filledPaymentCount,
        removedByPaymentCount,
        duplicateIgnoredCount,
        finalValidCount,
        errorCount,
        previewRows,
      });

      if (missingDocs.length > 0) {
        toast.warning(`Importação gerada com ${missingDocs.length} documento(s) não localizado(s).`);
      } else {
        toast.success("Planilha de importação gerada com sucesso.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao processar as planilhas.";
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1560px] py-2">
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
                    Cliente Minerva
                  </div>

                  <h1 className="text-[28px] font-semibold leading-none tracking-tight text-foreground lg:text-[32px]">
                    Processamento de importação
                  </h1>

                  <p className="mt-3 max-w-3xl text-[15px] leading-7 text-muted-foreground">
                    Informe a data, o valor do banco, anexe o relatório de validação e a Planilha 0.
                    O sistema cruza os conhecimentos, desconsidera inutilizados, trata duplicidades e
                    gera a planilha final de importação com conferência completa.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[420px]">
                <div className="rounded-2xl border border-border bg-muted/30 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-400/80">
                    Entrada
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    Relatório + Planilha 0
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-muted/30 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-400/80">
                    Saída
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                    Planilha de importação e conferência final
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.3 }}
          className="mb-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]"
        >
          <div className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_28%)]" />

            <div className="relative p-6 lg:p-7">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-400">
                  <CalendarDays className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Parâmetros da validação
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Defina a data-base da antecipação e o valor do banco para conciliar o resultado.
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
                    onChange={(e) => handleBankValueChange(e.target.value)}
                    className="h-12 w-full rounded-xl border border-border bg-muted/50 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10"
                  />
                </div>

                <div className="rounded-2xl border border-violet-500/12 bg-violet-500/[0.05] p-4">
                  <p className="text-sm leading-7 text-muted-foreground">
                    A importação final será gerada com FILIAL = 1, SÉRIE = 26, TIPO DOCUMENTO = CTRC
                    e DATA EMISSÃO obtida da Planilha 0.
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
                      Gerar planilha de importação
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label
              className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)] cursor-pointer"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.dataset.dragover = "true";
              }}
              onDragLeave={(e) => {
                e.currentTarget.dataset.dragover = "false";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.dataset.dragover = "false";
                const f = e.dataTransfer.files[0];
                if (f && /\.(xlsx?|xls)$/i.test(f.name)) setReportFile(f);
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_24%)]" />

              <div className="relative">
                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-400">
                    <UploadCloud className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Relatório Validação Envio
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Arraste o arquivo ou clique para selecionar.
                    </p>
                  </div>
                </div>

                <div className="rounded-[22px] border border-dashed border-violet-500/15 bg-violet-500/[0.04] px-6 py-14 text-center transition-all duration-200 hover:border-violet-500/30 hover:bg-violet-500/[0.07]">
                  {reportFile ? (
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-violet-500/20 bg-violet-500/10">
                        <FileCheck className="h-7 w-7 text-violet-400" />
                      </div>

                      <div>
                        <p className="text-lg font-semibold text-foreground">{reportFile.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Arquivo carregado com sucesso. Clique para trocar.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-violet-500/15 bg-violet-500/8">
                        <UploadCloud className="h-8 w-8 text-violet-400" />
                      </div>

                      <p className="text-xl font-semibold text-foreground">
                        Selecione o relatório
                      </p>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Formatos aceitos: .xlsx e .xls
                      </p>
                    </>
                  )}
                </div>

                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                />
              </div>
            </label>

            <label
              className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#11131c]/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.28)] cursor-pointer"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.dataset.dragover = "true";
              }}
              onDragLeave={(e) => {
                e.currentTarget.dataset.dragover = "false";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.dataset.dragover = "false";
                const f = e.dataTransfer.files[0];
                if (f && /\.(xlsx?|xls)$/i.test(f.name)) setPlanilhaZeroFile(f);
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.10),transparent_24%)]" />

              <div className="relative">
                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-200">
                    <UploadCloud className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Planilha 0
                    </h2>
                    <p className="text-sm text-white/55">
                      Base usada para localizar e montar a importação final.
                    </p>
                  </div>
                </div>

                <div className="rounded-[26px] border border-dashed border-violet-400/20 bg-[linear-gradient(180deg,rgba(139,92,246,0.06),rgba(255,255,255,0.02))] px-6 py-14 text-center transition-all duration-200 hover:border-violet-400/45 hover:bg-[linear-gradient(180deg,rgba(139,92,246,0.12),rgba(255,255,255,0.03))]">
                  {planilhaZeroFile ? (
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-violet-400/25 bg-violet-500/12">
                        <FileCheck className="h-7 w-7 text-violet-200" />
                      </div>

                      <div>
                        <p className="text-lg font-semibold text-white">{planilhaZeroFile.name}</p>
                        <p className="mt-1 text-sm text-white/55">
                          Arquivo carregado com sucesso. Clique para trocar.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-violet-400/20 bg-violet-500/10">
                        <UploadCloud className="h-8 w-8 text-violet-200" />
                      </div>

                      <p className="text-xl font-semibold text-white">
                        Selecione a Planilha 0
                      </p>
                      <p className="mt-3 text-sm text-white/50">
                        Formatos aceitos: .xlsx e .xls
                      </p>
                    </>
                  )}
                </div>

                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setPlanilhaZeroFile(e.target.files?.[0] || null)}
                />
              </div>
            </label>
          </div>
        </motion.div>

        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-7 space-y-5"
          >
            <div className={`${sectionCardClass} overflow-hidden`}>
              <div className="relative overflow-hidden p-6 sm:p-7">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.10),transparent_26%)]" />

                <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      Painel executivo
                    </div>

                    <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
                      Resultado do processamento
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                      Uma visão refinada da validação, separando produtividade operacional,
                      conciliação financeira e conferência rápida das linhas processadas.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-3xl border border-emerald-500/15 bg-emerald-500/8 p-4">
                        <p className={metricTitleClass}>Válidas finais</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-300">
                          {summary.finalValidCount}
                        </p>
                        <p className="mt-1 text-xs text-emerald-200/80">
                          Documentos prontos para importação
                        </p>
                      </div>

                      <div className="rounded-3xl border border-violet-500/15 bg-violet-500/8 p-4">
                        <p className={metricTitleClass}>Total processado</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-violet-200">
                          {formatCurrencyBR(summary.totalProcessed)}
                        </p>
                        <p className="mt-1 text-xs text-violet-200/80">
                          Somatório das linhas consideradas válidas
                        </p>
                      </div>

                      <div
                        className={`rounded-3xl border p-4 ${
                          summary.status === "ok"
                            ? "border-emerald-500/20 bg-emerald-500/8"
                            : "border-red-500/20 bg-red-500/8"
                        }`}
                      >
                        <p className={metricTitleClass}>Diferença</p>
                        <p
                          className={`mt-2 text-3xl font-semibold tracking-tight ${
                            summary.status === "ok" ? "text-emerald-300" : "text-red-300"
                          }`}
                        >
                          {formatSignedCurrencyBR(summary.difference)}
                        </p>
                        <p
                          className={`mt-1 text-xs ${
                            summary.status === "ok" ? "text-emerald-200/80" : "text-red-200/80"
                          }`}
                        >
                          {summary.status === "ok"
                            ? "Conciliação fechada com o valor informado"
                            : "Existe divergência entre planilha e banco"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full xl:max-w-[360px]">
                    <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                            Status da conciliação
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            {summary.status === "ok" ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-300" />
                            )}
                            <p
                              className={`text-lg font-semibold ${
                                summary.status === "ok" ? "text-emerald-300" : "text-red-300"
                              }`}
                            >
                              {summary.status === "ok"
                                ? "Conciliação validada"
                                : "Diferença identificada"}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            summary.status === "ok"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : "border-red-500/20 bg-red-500/10 text-red-300"
                          }`}
                        >
                          {summary.status === "ok" ? "OK" : "DIVERGE"}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className={metricTitleClass}>Valor banco</p>
                          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                            {formatCurrencyBR(summary.bankValue)}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <p className={metricTitleClass}>Não localizados</p>
                            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                              {summary.missingDocs.length}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <p className={metricTitleClass}>Data-base</p>
                            <p className="mt-2 text-base font-semibold tracking-tight text-white">
                              {formatDateBR(summary.selectedDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.45fr_0.95fr]">
              <div className={`${sectionCardClass} p-5 sm:p-6`}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                      Performance operacional
                    </p>
                    <p className="mt-1 text-sm text-white/55">
                      Leitura do fluxo até a montagem final da importação.
                    </p>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/50">
                    {summary.reportRows} linha(s) analisada(s)
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className={metricCardClass}>
                    <p className={metricTitleClass}>Linhas lidas</p>
                    <p className={metricValueClass}>{summary.reportRows}</p>
                  </div>

                  <div className={metricCardClass}>
                    <p className={metricTitleClass}>Filtradas por data</p>
                    <p className={metricValueClass}>{summary.reportRows}</p>
                  </div>

                  <div className={metricCardClass}>
                    <p className={metricTitleClass}>Pgto vazio</p>
                    <p className={metricValueClass}>{summary.emptyPaymentCount}</p>
                  </div>

                  <div className={metricCardClass}>
                    <p className={metricTitleClass}>Pgto preenchido</p>
                    <p className={metricValueClass}>{summary.filledPaymentCount}</p>
                  </div>

                  <div className={metricCardClass}>
                    <p className={metricTitleClass}>Removidas por pagamento</p>
                    <p className={metricValueClass}>{summary.removedByPaymentCount}</p>
                  </div>

                  <div className={metricCardClass}>
                    <p className={metricTitleClass}>Duplicados ignorados</p>
                    <p className={metricValueClass}>{summary.duplicateIgnoredCount}</p>
                  </div>

                  <div className={metricCardClass}>
                    <p className={metricTitleClass}>Válidas finais</p>
                    <p className={metricValueClass}>{summary.finalValidCount}</p>
                  </div>

                  <div className={metricCardClass}>
                    <p className={metricTitleClass}>Com erro</p>
                    <p className={metricValueClass}>{summary.errorCount}</p>
                  </div>
                </div>
              </div>

              <div className={`${sectionCardClass} p-5 sm:p-6`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                  Leitura executiva
                </p>
                <p className="mt-1 text-sm text-white/55">
                  Resumo rápido para bater o olho e entender o resultado.
                </p>

                <div className="mt-5 space-y-3">
                  <div
                    className={`rounded-3xl border p-4 ${
                      summary.finalValidCount === 0
                        ? "border-white/10 bg-white/[0.03] text-white/55"
                        : "border-emerald-500/15 bg-emerald-500/8 text-emerald-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {summary.finalValidCount === 0 ? (
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-semibold">
                          {summary.finalValidCount === 0
                            ? "Nenhum documento elegível para importação"
                            : `${summary.finalValidCount} documento(s) válido(s) encontrado(s)`}
                        </p>
                        <p className="mt-1 text-xs leading-5 opacity-80">
                          {summary.finalValidCount === 0
                            ? "A data selecionada não retornou títulos em aberto após as validações."
                            : "A etapa de cruzamento encontrou documentos compatíveis e prontos para seguir para a planilha final."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className={metricTitleClass}>Cobertura</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                          {summary.uniqueDocs}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          Conhecimentos únicos capturados no relatório
                        </p>
                      </div>

                      <div>
                        <p className={metricTitleClass}>Importados</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                          {summary.matchedRows}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          Linhas que entraram na planilha final
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <p className={metricTitleClass}>Diagnóstico</p>
                    <div className="mt-3 space-y-2 text-sm text-white">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/50">Duplicados tratados automaticamente</span>
                        <span className="font-semibold">{summary.duplicateIgnoredCount}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/50">Documentos não localizados</span>
                        <span className="font-semibold">{summary.missingDocs.length}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/50">Linhas com erro</span>
                        <span className="font-semibold">{summary.errorCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${sectionCardClass} overflow-hidden`}>
              <div className="border-b border-white/10 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Preview de validação</p>
                    <p className="text-xs text-white/50">
                      Primeiras 20 linhas processadas para conferência visual.
                    </p>
                  </div>

                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/50">
                    <Info className="h-3.5 w-3.5" />
                    {summary.previewRows.length} linha(s) exibida(s)
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[90px_150px_170px_190px_160px_180px] gap-3 bg-white/[0.03] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 sm:px-6">
                    <div>Linha</div>
                    <div>Data Vcto.</div>
                    <div>Data Pagamento</div>
                    <div>Nº Fatura</div>
                    <div>Valor Bruto</div>
                    <div>Status</div>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {summary.previewRows.map((row, index) => (
                      <div
                        key={`${row.line}-${row.invoiceNumber}-${row.status}`}
                        className={`grid grid-cols-[90px_150px_170px_190px_160px_180px] gap-3 px-5 py-3.5 text-sm text-white transition-colors hover:bg-white/[0.035] sm:px-6 ${
                          index % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"
                        } ${index !== summary.previewRows.length - 1 ? "border-t border-white/5" : ""}`}
                      >
                        <div className="font-medium text-white/90">{row.line}</div>
                        <div>{row.dueDate || "-"}</div>
                        <div>{row.paymentDate || "-"}</div>
                        <div className="font-medium tracking-tight">{row.invoiceNumber || "-"}</div>
                        <div>{formatCurrencyBR(row.grossValue)}</div>
                        <div>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                              row.status
                            )}`}
                          >
                            {row.status}
                          </span>
                        </div>
                      </div>
                    ))}

                    {summary.previewRows.length === 0 && (
                      <div className="px-5 py-10 text-sm text-white/50 sm:px-6">
                        Nenhuma linha disponível para preview.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={`${sectionCardClass} p-5 sm:p-6`}>
              {summary.missingDocs.length === 0 ? (
                <div className="flex items-start gap-3 text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      Todos os conhecimentos foram localizados.
                    </p>
                    <p className="mt-1 text-xs text-emerald-200/80">
                      Nenhum documento ficou pendente após o cruzamento com a Planilha 0.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-start gap-3 text-amber-300">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">
                        {summary.missingDocs.length} documento(s) não localizado(s)
                      </p>
                      <p className="mt-1 text-xs text-amber-200/80">
                        Esses conhecimentos ficaram de fora da importação e merecem conferência manual.
                      </p>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-auto rounded-3xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap gap-2">
                      {summary.missingDocs.map((doc) => (
                        <span
                          key={doc}
                          className="inline-flex items-center rounded-xl border border-amber-500/15 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300"
                        >
                          {doc}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Minerva;