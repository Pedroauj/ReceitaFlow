import * as XLSX from "xlsx";

export interface PlatlogInputFile {
  fileName: string;
  buffer: ArrayBuffer;
}

export interface PlatlogDocument {
  filial: string;
  serie: string;
  numeroDocumento: string;
  tipoDocumento: string;
  valorOriginal: number;
  descontoAplicado: number;
  valorFinal: number;
  origemArquivo: string;
}

export interface PlatlogDiscountApplication {
  valorDescontoAplicado: number;
  documentoAlvo: string;
  serieAlvo: string;
  tipoDocumentoAlvo: string;
  saldoRestante: number;
}

export interface PlatlogProcessingResult {
  documents: PlatlogDocument[];
  descontosAplicados: PlatlogDiscountApplication[];
  totalDocumentos: number;
  totalValorOriginal: number;
  totalDescontos: number;
  totalValorFinal: number;
  arquivoProcessado: string;
}

type HeaderMap = Record<string, number>;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[\u00ba\u00b0\u00aa]/g, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .trim()
    .toLowerCase();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();

    if (!cleaned) return null;

    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function toDocumentString(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "number") {
    return Math.trunc(value).toString();
  }

  return String(value).trim();
}

function getRuleFromDocument(numeroDocumento: string): {
  filial: string;
  serie: string;
  tipoDocumento: string;
} | null {
  if (!numeroDocumento) return null;

  if (
    numeroDocumento.startsWith("9") ||
    numeroDocumento.startsWith("1")
  ) {
    return {
      filial: "1",
      serie: "4",
      tipoDocumento: "CTRC",
    };
  }

  if (numeroDocumento.startsWith("2") || numeroDocumento.startsWith("3")) {
    return {
      filial: "1",
      serie: "NFD",
      tipoDocumento: "NF",
    };
  }

  const firstDigit = numeroDocumento[0];
  if (firstDigit >= "4" && firstDigit <= "8") {
    return {
      filial: "4",
      serie: "39",
      tipoDocumento: "CTRC",
    };
  }

  return null;
}

function findHeaderRow(rows: unknown[][]): { headerRowIndex: number; headerMap: HeaderMap } {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const headerMap: HeaderMap = {};

    row.forEach((cell, columnIndex) => {
      const normalized = normalizeHeader(cell);
      if (normalized) {
        headerMap[normalized] = columnIndex;
      }
    });

    const hasNumeroDocumento =
      headerMap["nfiscal"] !== undefined ||
      headerMap["numero"] !== undefined ||
      headerMap["ncte"] !== undefined;

    const hasValor =
      headerMap["vltotal"] !== undefined ||
      headerMap["valordopagamento"] !== undefined;

    if (hasNumeroDocumento && hasValor) {
      return { headerRowIndex: rowIndex, headerMap };
    }
  }

  throw new Error(
    "Não foi possível localizar as colunas de documento (N.Fiscal, Número ou Nº CTE) e de valor (Vl.Total ou Valor do pagamento) na planilha."
  );
}

function getCellValue(row: unknown[], index?: number): unknown {
  if (index === undefined) return undefined;
  return row[index];
}

function getDocumentFromRow(row: unknown[], headerMap: HeaderMap): string {
  const nfiscalValue = toDocumentString(getCellValue(row, headerMap["nfiscal"]));
  if (nfiscalValue) return nfiscalValue;

  const numeroValue = toDocumentString(getCellValue(row, headerMap["numero"]));
  if (numeroValue) return numeroValue;

  const cteValue = toDocumentString(getCellValue(row, headerMap["ncte"]));
  if (cteValue) return cteValue;

  return "";
}

function getValueFromRow(row: unknown[], headerMap: HeaderMap): number | null {
  const vlTotalValue = toNumber(getCellValue(row, headerMap["vltotal"]));
  if (vlTotalValue !== null) return vlTotalValue;

  const valorPagamentoValue = toNumber(getCellValue(row, headerMap["valordopagamento"]));
  if (valorPagamentoValue !== null) return valorPagamentoValue;

  return null;
}

function applyDiscounts(
  baseDocuments: PlatlogDocument[],
  descontoTotal: number
): {
  documents: PlatlogDocument[];
  descontosAplicados: PlatlogDiscountApplication[];
} {
  const documents = baseDocuments.map((doc) => ({ ...doc }));
  const descontosAplicados: PlatlogDiscountApplication[] = [];

  let restante = Number(descontoTotal.toFixed(2));

  while (restante > 0) {
    const elegiveis = documents
      .map((doc, index) => ({ doc, index }))
      .filter(({ doc }) => doc.valorFinal > 0)
      .sort((a, b) => b.doc.valorFinal - a.doc.valorFinal);

    if (elegiveis.length === 0) break;

    const alvo = elegiveis[0].doc;
    const valorAplicado = Math.min(restante, alvo.valorFinal);

    alvo.descontoAplicado = Number((alvo.descontoAplicado + valorAplicado).toFixed(2));
    alvo.valorFinal = Number((alvo.valorFinal - valorAplicado).toFixed(2));

    descontosAplicados.push({
      valorDescontoAplicado: Number(valorAplicado.toFixed(2)),
      documentoAlvo: alvo.numeroDocumento,
      serieAlvo: alvo.serie,
      tipoDocumentoAlvo: alvo.tipoDocumento,
      saldoRestante: alvo.valorFinal,
    });

    restante = Number((restante - valorAplicado).toFixed(2));
  }

  return { documents, descontosAplicados };
}

export async function processarPlatlog(
  file: PlatlogInputFile,
  descontoTotal = 0
): Promise<PlatlogProcessingResult> {
  const workbook = XLSX.read(file.buffer, { type: "array" });

  if (!workbook.SheetNames.length) {
    throw new Error("A planilha enviada está vazia.");
  }

  const preferredSheetName =
    workbook.SheetNames.find((name) => {
      const upper = name.trim().toUpperCase();
      return upper === "SGT" || upper === "FECHAMENTO";
    }) ?? workbook.SheetNames[0];

  const worksheet = workbook.Sheets[preferredSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  if (!rows.length) {
    throw new Error("Não foi possível ler os dados da planilha.");
  }

  const { headerRowIndex, headerMap } = findHeaderRow(rows);

  const baseDocuments: PlatlogDocument[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];

    const numeroDocumento = getDocumentFromRow(row, headerMap);
    const valor = getValueFromRow(row, headerMap);

    if (!numeroDocumento || valor === null) continue;

    const rule = getRuleFromDocument(numeroDocumento);
    if (!rule) continue;

    baseDocuments.push({
      filial: rule.filial,
      serie: rule.serie,
      numeroDocumento,
      tipoDocumento: rule.tipoDocumento,
      valorOriginal: Number(valor.toFixed(2)),
      descontoAplicado: 0,
      valorFinal: Number(valor.toFixed(2)),
      origemArquivo: file.fileName,
    });
  }

  if (baseDocuments.length === 0) {
    return {
      documents: [],
      descontosAplicados: [],
      totalDocumentos: 0,
      totalValorOriginal: 0,
      totalDescontos: 0,
      totalValorFinal: 0,
      arquivoProcessado: file.fileName,
    };
  }

  const descontoNormalizado = Math.max(0, Number(descontoTotal || 0));
  const { documents, descontosAplicados } = applyDiscounts(baseDocuments, descontoNormalizado);

  const documentsValidos = documents.filter((doc) => doc.valorFinal > 0);

  const totalValorOriginal = documents.reduce((sum, doc) => sum + doc.valorOriginal, 0);
  const totalDescontos = descontosAplicados.reduce((sum, item) => sum + item.valorDescontoAplicado, 0);
  const totalValorFinal = documentsValidos.reduce((sum, doc) => sum + doc.valorFinal, 0);

  return {
    documents: documentsValidos,
    descontosAplicados,
    totalDocumentos: documentsValidos.length,
    totalValorOriginal: Number(totalValorOriginal.toFixed(2)),
    totalDescontos: Number(totalDescontos.toFixed(2)),
    totalValorFinal: Number(totalValorFinal.toFixed(2)),
    arquivoProcessado: file.fileName,
  };
}

export function gerarPlanilhaPlatlog(result: PlatlogProcessingResult): ArrayBuffer {
  const baixaData = result.documents.map((doc) => ({
    FILIAL: doc.filial,
    SERIE: doc.serie,
    "Nº DOCUMENTO": doc.numeroDocumento,
    TIPO: doc.tipoDocumento,
    VALOR: doc.valorFinal,
  }));

  const conferenciaData = result.documents.map((doc) => ({
    ARQUIVO: doc.origemArquivo,
    DOCUMENTO: doc.numeroDocumento,
    SERIE: doc.serie,
    TIPO: doc.tipoDocumento,
    VALOR_ORIGINAL: doc.valorOriginal,
    DESCONTO_APLICADO: doc.descontoAplicado,
    SALDO_DEVEDOR: doc.valorFinal,
  }));

  const descontosData = result.descontosAplicados.map((item) => ({
    DOCUMENTO_ALVO: item.documentoAlvo,
    SERIE_ALVO: item.serieAlvo,
    TIPO_DOCUMENTO: item.tipoDocumentoAlvo,
    VALOR_DESCONTO_APLICADO: item.valorDescontoAplicado,
    SALDO_RESTANTE: item.saldoRestante,
  }));

  const resumoData = [
    {
      ARQUIVO_PROCESSADO: result.arquivoProcessado,
      TOTAL_DOCUMENTOS: result.totalDocumentos,
      TOTAL_VALOR_ORIGINAL: result.totalValorOriginal,
      TOTAL_DESCONTOS: result.totalDescontos,
      TOTAL_VALOR_FINAL: result.totalValorFinal,
    },
  ];

  const wb = XLSX.utils.book_new();

  const wsBaixa = XLSX.utils.json_to_sheet(baixaData);
  wsBaixa["!cols"] = [
    { wch: 10 },
    { wch: 10 },
    { wch: 18 },
    { wch: 12 },
    { wch: 15 },
  ];

  const wsConferencia = XLSX.utils.json_to_sheet(conferenciaData);
  wsConferencia["!cols"] = [
    { wch: 35 },
    { wch: 18 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
  ];

  const wsDescontos = XLSX.utils.json_to_sheet(descontosData);
  wsDescontos["!cols"] = [
    { wch: 18 },
    { wch: 10 },
    { wch: 16 },
    { wch: 22 },
    { wch: 15 },
  ];

  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  wsResumo["!cols"] = [
    { wch: 35 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, wsBaixa, "DOCUMENTO");
  XLSX.utils.book_append_sheet(wb, wsConferencia, "Conferencia");
  XLSX.utils.book_append_sheet(wb, wsDescontos, "Descontos");
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}