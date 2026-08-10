import * as XLSX from "xlsx";
import type { ProcessingResult, ProcessedDocument, ProcessingError, PreviewRow } from "./types";

/** Parse monetary value handling Brazilian and international formats */
function parseValor(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  let str = String(raw)
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .trim();

  if (!str) return null;

  const lastDot = str.lastIndexOf(".");
  const lastComma = str.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    str = lastComma > lastDot
      ? str.replace(/\./g, "").replace(",", ".")
      : str.replace(/,/g, "");
  } else if (lastComma !== -1) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    str = str.replace(/,/g, "");
  }

  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

/** Normalize column names for resilient lookup */
function normalizeColumnName(name: string): string {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "o")
    .replace(/[ª]/g, "a")
    .replace(/[_\-.:/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Find a column index using exact, startsWith and contains matches */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map((header) => normalizeColumnName(header));
  const normalizedNames = possibleNames.map((name) => normalizeColumnName(name));

  for (const name of normalizedNames) {
    const exactIndex = normalizedHeaders.indexOf(name);
    if (exactIndex !== -1) return exactIndex;
  }

  for (const name of normalizedNames) {
    const startsWithIndex = normalizedHeaders.findIndex((header) => header.startsWith(name));
    if (startsWithIndex !== -1) return startsWithIndex;
  }

  for (const name of normalizedNames) {
    const containsIndex = normalizedHeaders.findIndex((header) => header.includes(name));
    if (containsIndex !== -1) return containsIndex;
  }

  return -1;
}

function isEmptyCell(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  return false;
}

/** Keywords that indicate summary/total/subtitle rows */
const SKIP_KEYWORDS = [
  "total", "subtotal", "sub total", "sub-total", "soma", "resumo",
  "grand total", "total geral", "qtd", "quantidade",
];

/** Check if a value looks like a summary/total/header row */
function isSummaryRow(faturaRaw: string): boolean {
  const lower = normalizeColumnName(faturaRaw);
  return SKIP_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/** Check if fatura is a valid document number starting with 36 or 1 */
function isValidFatura(str: string): boolean {
  const cleaned = str.replace(/[\s.\-\/]/g, "");
  if (!/^\d+$/.test(cleaned)) return false;
  return cleaned.startsWith("36") || cleaned.startsWith("1");
}

/** Parse fatura into serie + documento */
function parseFatura(cleaned: string): { serie: string; documento: string } {
  const str = cleaned.replace(/[\s.\-\/]/g, "");
  if (str.startsWith("36") && str.length > 2) {
    return { serie: "36", documento: str.slice(2) };
  }
  return { serie: "1", documento: str.slice(1) };
}

/**
 * Parse an Excel date value to a comparable string "yyyy-MM-dd".
 * Handles both Excel serial numbers and string dates.
 */
function parseExcelDate(raw: unknown): string | null {
  if (raw == null) return null;

  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    const yyyy = String(d.y).padStart(4, "0");
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const str = String(raw).trim();
  if (!str) return null;

  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return null;
}

/** Format a JS Date to yyyy-MM-dd for comparison */
function formatDateForCompare(date: Date): string {
  const yyyy = String(date.getFullYear()).padStart(4, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplayDate(parsedDate: string | null, raw: unknown): string {
  if (parsedDate) {
    return `${parsedDate.slice(8, 10)}/${parsedDate.slice(5, 7)}/${parsedDate.slice(0, 4)}`;
  }
  return isEmptyCell(raw) ? "" : String(raw).trim();
}

function createPreviewRow(
  row: number,
  dataVcto: string,
  dataPagamento: string,
  faturaOriginal: string,
  valorBrutoOriginal: string,
  valorBrutoConvertido: number | null,
  status: PreviewRow["status"]
): PreviewRow {
  const faturaData = isValidFatura(faturaOriginal) ? parseFatura(faturaOriginal) : { serie: "", documento: "" };

  return {
    row,
    dataVcto,
    dataPagamento,
    faturaOriginal,
    serie: faturaData.serie,
    numeroDocumento: faturaData.documento,
    valorBrutoOriginal,
    valorBrutoConvertido,
    status,
  };
}

export function processarMartinBrower(
  fileBuffer: ArrayBuffer,
  dataVencimento: Date
): ProcessingResult {
  const workbook = XLSX.read(fileBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  let headerRowIndex = -1;
  let colDataVcto = -1;
  let colDataPagamento = -1;
  let colFatura = -1;
  let colValorBruto = -1;

  for (let i = 0; i < matrix.length; i++) {
    const headerCells = (matrix[i] ?? []).map((cell) => String(cell ?? ""));
    const dataVctoIndex = findColumnIndex(headerCells, ["Data Vcto.", "Data Vcto", "Data de Vencimento"]);
    const dataPagamentoIndex = findColumnIndex(headerCells, ["Data de Pagamento", "Data Pagamento", "Dt Pagamento"]);
    const faturaIndex = findColumnIndex(headerCells, ["Nº da Fatura", "No da Fatura", "Numero da Fatura", "N da Fatura"]);
    const valorBrutoIndex = findColumnIndex(headerCells, ["Valor Bruto", "Valor"]);

    if (dataVctoIndex !== -1 && dataPagamentoIndex !== -1 && faturaIndex !== -1 && valorBrutoIndex !== -1) {
      headerRowIndex = i;
      colDataVcto = dataVctoIndex;
      colDataPagamento = dataPagamentoIndex;
      colFatura = faturaIndex;
      colValorBruto = valorBrutoIndex;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error("Não foi possível localizar as colunas obrigatórias da planilha Martin Brower.");
  }

  const rows = matrix.slice(headerRowIndex + 1);
  const totalLinhasLidas = rows.length;
  const dataVctoAlvo = formatDateForCompare(dataVencimento);

  const documents: ProcessedDocument[] = [];
  const errors: ProcessingError[] = [];
  const preview: PreviewRow[] = [];
  let totalValorBruto = 0;
  let totalLinhasIgnoradas = 0;
  let totalLinhasFiltradasData = 0;
  let totalLinhasRemovidasPagamento = 0;
  let totalLinhasPagamentoVazio = 0;
  let totalLinhasPagamentoPreenchido = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNum = headerRowIndex + i + 2;

    const rawDataVcto = row[colDataVcto];
    const dataVctoStr = parseExcelDate(rawDataVcto);

    if (dataVctoStr !== dataVctoAlvo) {
      continue;
    }

    totalLinhasFiltradasData++;

    const rawDataPagamento = row[colDataPagamento];
    const rawFaturaVal = row[colFatura];
    const rawValorVal = row[colValorBruto];

    const dataVctoDisplay = formatDisplayDate(dataVctoStr, rawDataVcto);
    const dataPagamentoDisplay = formatDisplayDate(parseExcelDate(rawDataPagamento), rawDataPagamento);
    const faturaStr = isEmptyCell(rawFaturaVal) ? "" : String(rawFaturaVal).trim();
    const valorStr = isEmptyCell(rawValorVal) ? "" : String(rawValorVal).trim();
    const valorConvertido = parseValor(rawValorVal);

    const pagamentoVazio = isEmptyCell(rawDataPagamento);
    const dataPagamentoStr = parseExcelDate(rawDataPagamento);
    const pagamentoIgualVcto = dataPagamentoStr === dataVctoStr;

    if (pagamentoVazio || pagamentoIgualVcto) {
      if (pagamentoVazio) {
        totalLinhasPagamentoVazio++;
      } else {
        totalLinhasPagamentoPreenchido++;
      }
    } else {
      totalLinhasPagamentoPreenchido++;
      totalLinhasRemovidasPagamento++;
      if (preview.length < 20) {
        preview.push(
          createPreviewRow(
            rowNum,
            dataVctoDisplay,
            dataPagamentoDisplay,
            faturaStr,
            valorStr,
            valorConvertido,
            "removida por pagamento"
          )
        );
      }
      continue;
    }

    if (!faturaStr) {
      errors.push({ row: rowNum, fatura: "", motivo: "Nº da Fatura vazio" });
      if (preview.length < 20) {
        preview.push(createPreviewRow(rowNum, dataVctoDisplay, dataPagamentoDisplay, "", valorStr, valorConvertido, "erro"));
      }
      continue;
    }

    if (isSummaryRow(faturaStr) || !isValidFatura(faturaStr)) {
      if (isSummaryRow(faturaStr)) {
        totalLinhasIgnoradas++;
      }
      errors.push({ row: rowNum, fatura: faturaStr, motivo: `Nº da Fatura inválido: "${faturaStr}"` });
      if (preview.length < 20) {
        preview.push(createPreviewRow(rowNum, dataVctoDisplay, dataPagamentoDisplay, faturaStr, valorStr, valorConvertido, "erro"));
      }
      continue;
    }

    if (valorConvertido === null) {
      errors.push({ row: rowNum, fatura: faturaStr, motivo: `Valor Bruto vazio ou inválido: "${valorStr}"` });
      if (preview.length < 20) {
        preview.push(createPreviewRow(rowNum, dataVctoDisplay, dataPagamentoDisplay, faturaStr, valorStr, null, "erro"));
      }
      continue;
    }

    const faturaData = parseFatura(faturaStr);
    totalValorBruto += valorConvertido;

    documents.push({
      filial: "1",
      serie: faturaData.serie,
      numeroDocumento: faturaData.documento,
      tipoDocumento: "CTRC",
      valorPago: Math.round(valorConvertido * 100) / 100,
    });

    if (preview.length < 20) {
      preview.push(
        createPreviewRow(
          rowNum,
          dataVctoDisplay,
          dataPagamentoDisplay,
          faturaStr,
          valorStr,
          Math.round(valorConvertido * 100) / 100,
          "válida"
        )
      );
    }
  }

  return {
    documents,
    errors,
    preview,
    totalValorBruto: Math.round(totalValorBruto * 100) / 100,
    totalDocumentos: documents.length,
    totalLinhasLidas,
    totalLinhasFiltradasData,
    totalLinhasRemovidasPagamento,
    totalLinhasPagamentoVazio,
    totalLinhasPagamentoPreenchido,
    totalLinhasIgnoradas,
    totalLinhasValidas: documents.length,
    totalLinhasComErro: errors.length,
  };
}

export function gerarPlanilhaFinal(
  documents: ProcessedDocument[],
  _dataRecebimento: Date
): ArrayBuffer {
  const data = documents.map((doc) => ({
    FILIAL: doc.filial,
    SERIE: doc.serie,
    "Nº DOCUMENTO": doc.numeroDocumento,
    "TIPO DOCUMENTO": doc.tipoDocumento,
    "VALOR PAGO": doc.valorPago,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  ws["!cols"] = [
    { wch: 10 },
    { wch: 8 },
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "DOCUMENTO");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}
