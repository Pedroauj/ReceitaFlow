import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// ── Payloads por cliente ──────────────────────────────────────────────────────
// O resultado completo do processamento é salvo junto ao registro, permitindo
// reabrir o detalhe no Histórico e re-exportar a planilha final.

export type HistoryPayload =
  | { tipo: "danone"; resultado: unknown }
  | { tipo: "natura"; resultado: unknown }
  | { tipo: "platlog"; resultado: unknown }
  | { tipo: "martin-brower"; resultado: unknown };

export interface HistoryRecord {
  id: string;
  cliente: string;
  dataProcessamento: string; // ISO string
  dataVencimento: string;
  dataRecebimento: string;
  quantidadeDocumentos: number;
  valorTotal: number;
  valorInformadoBanco: number;
  statusConferencia: "confere" | "diverge";
  quantidadeErros: number;
  payload: HistoryPayload | null;
}

export interface HistoryStats {
  totalPlanilhas: number;
  totalDocumentos: number;
  valorTotalProcessado: number;
}

type DbRow = {
  id: string;
  cliente: string;
  data_processamento: string;
  data_vencimento: string | null;
  data_recebimento: string | null;
  quantidade_documentos: number;
  valor_total: number;
  valor_informado_banco: number;
  status_conferencia: string;
  quantidade_erros: number;
  payload: Json | null;
};

function toRecord(row: DbRow): HistoryRecord {
  return {
    id: row.id,
    cliente: row.cliente,
    dataProcessamento: row.data_processamento,
    dataVencimento: row.data_vencimento ?? row.data_processamento,
    dataRecebimento: row.data_recebimento ?? row.data_processamento,
    quantidadeDocumentos: row.quantidade_documentos,
    valorTotal: Number(row.valor_total),
    valorInformadoBanco: Number(row.valor_informado_banco),
    statusConferencia: row.status_conferencia === "diverge" ? "diverge" : "confere",
    quantidadeErros: row.quantidade_erros,
    payload: (row.payload as HistoryPayload | null) ?? null,
  };
}

/**
 * Salva um processamento no histórico do usuário logado.
 * Falha silenciosa (apenas console.error) para nunca quebrar o fluxo
 * principal de processamento por causa do histórico.
 */
export async function addRecord(
  record: Omit<HistoryRecord, "id" | "payload"> & { payload?: HistoryPayload }
): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    const { error } = await supabase.from("processing_history").insert({
      user_id: userId,
      cliente: record.cliente,
      data_processamento: record.dataProcessamento,
      data_vencimento: record.dataVencimento,
      data_recebimento: record.dataRecebimento,
      quantidade_documentos: record.quantidadeDocumentos,
      valor_total: record.valorTotal,
      valor_informado_banco: record.valorInformadoBanco,
      status_conferencia: record.statusConferencia,
      quantidade_erros: record.quantidadeErros,
      payload: (record.payload ?? null) as Json,
    });
    if (error) console.error("Erro ao salvar histórico:", error.message);
  } catch (err) {
    console.error("Erro ao salvar histórico:", err);
  }
}

/** Retorna o histórico do usuário logado, mais recente primeiro. */
export async function getRecords(): Promise<HistoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from("processing_history")
      .select("*")
      .order("data_processamento", { ascending: false });
    if (error) {
      console.error("Erro ao carregar histórico:", error.message);
      return [];
    }
    return (data ?? []).map(toRecord);
  } catch {
    return [];
  }
}

/** Remove um registro do histórico do próprio usuário. */
export async function deleteRecord(id: string): Promise<boolean> {
  const { error } = await supabase.from("processing_history").delete().eq("id", id);
  if (error) console.error("Erro ao excluir registro:", error.message);
  return !error;
}

/** Estatísticas agregadas calculadas sobre uma lista já carregada. */
export function computeStats(records: HistoryRecord[]): HistoryStats {
  return {
    totalPlanilhas: records.length,
    totalDocumentos: records.reduce((sum, r) => sum + r.quantidadeDocumentos, 0),
    valorTotalProcessado: records.reduce((sum, r) => sum + r.valorTotal, 0),
  };
}
