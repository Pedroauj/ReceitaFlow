import { Download, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  SummaryCard, HighlightCard, SectionContainer, DataTable, StatusCard,
} from "@/components/dashboard";
import { AccentButton } from "@/components/client";
import type { HistoryRecord } from "@/lib/history";
import {
  gerarPlanilhaDanone,
  type DanoneProcessingResult,
} from "@/lib/processors/danone";
import {
  gerarPlanilhaNatura,
  type NaturaProcessingResult,
} from "@/lib/processors/natura";
import {
  gerarPlanilhaPlatlog,
  type PlatlogProcessingResult,
} from "@/lib/processors/platlog";
import { gerarPlanilhaFinal } from "@/lib/processors/martin-brower";
import type { ProcessingResult } from "@/lib/processors/types";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function downloadXlsx(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast({ title: "Planilha gerada", description: filename });
}

// ── Danone ────────────────────────────────────────────────────────────────────

const DanoneDetalhe = ({ result }: { result: DanoneProcessingResult }) => (
  <div className="space-y-5">
    <SectionContainer title="Resultado do processamento">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Arquivos processados" value={result.arquivosProcessados} index={0} />
        <SummaryCard label="Total de documentos" value={result.totalDocumentos} index={1} />
        <SummaryCard label="Total de descontos" value={formatBRL(result.totalDescontos)} index={2} />
        <SummaryCard label="Valor final" value={formatBRL(result.totalValorFinal)} index={3} />
      </div>
    </SectionContainer>

    <DataTable
      title="Planilha final"
      badge={`${result.documents.length} documento(s)`}
      columns={[
        { key: "filial", label: "Filial", width: "80px" },
        { key: "serie", label: "Série", width: "80px" },
        { key: "numeroDocumento", label: "Nº Documento", width: "150px", render: (row: any) => <span className="font-mono">{row.numeroDocumento}</span> },
        { key: "tipoDocumento", label: "Tipo", width: "100px" },
        { key: "valorOriginal", label: "Valor original", width: "140px", render: (row: any) => formatBRL(row.valorOriginal) },
        { key: "descontoAplicado", label: "Desconto", width: "140px", render: (row: any) => formatBRL(row.descontoAplicado) },
        { key: "valorFinal", label: "Valor final", width: "140px", className: "font-semibold", render: (row: any) => formatBRL(row.valorFinal) },
      ]}
      data={result.documents}
      keyExtractor={(row: any, i) => `${row.numeroDocumento}_${row.serie}_${i}`}
    />

    {result.descontosAplicados.length > 0 && (
      <DataTable
        title="Conferência dos descontos aplicados"
        badge={`${result.descontosAplicados.length} desconto(s)`}
        columns={[
          { key: "arquivoOrigem", label: "Arquivo", width: "1fr" },
          { key: "referenciaOrigem", label: "Referência do desconto", width: "1fr" },
          { key: "documentoAlvo", label: "Documento alvo", width: "140px", render: (row: any) => <span className="font-mono">{row.documentoAlvo}</span> },
          { key: "serieAlvo", label: "Série", width: "80px" },
          { key: "valorDesconto", label: "Valor descontado", width: "140px", render: (row: any) => formatBRL(row.valorDesconto) },
          { key: "saldoRestante", label: "Saldo restante", width: "140px", className: "font-semibold", render: (row: any) => formatBRL(row.saldoRestante) },
        ]}
        data={result.descontosAplicados}
        keyExtractor={(row: any, i) => `${row.referenciaOrigem}_${i}`}
      />
    )}

    <AccentButton onClick={() => downloadXlsx(gerarPlanilhaDanone(result), `baixa_danone_${new Date().toISOString().slice(0, 10)}.xlsx`)}>
      <Download className="h-4 w-4" />
      Baixar planilha final
    </AccentButton>
  </div>
);

// ── Natura ────────────────────────────────────────────────────────────────────

const naturaStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    encontrado: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    "não encontrado": "bg-red-500/10 text-red-300 border-red-500/20",
    "sem valor": "bg-amber-500/10 text-amber-300 border-amber-500/20",
  };
  return (
    <Badge variant="outline" className={`border text-[10px] font-medium ${styles[status] ?? "border-border bg-muted text-muted-foreground"}`}>
      {status}
    </Badge>
  );
};

const NaturaDetalhe = ({ result }: { result: NaturaProcessingResult }) => (
  <div className="space-y-5">
    <SectionContainer title="Resultado do cruzamento">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HighlightCard label="Documentos no BOR" value={result.documentosBOR.length} color="neutral" index={0} />
        <HighlightCard label="Encontrados" value={result.totalEncontrados} color="emerald" index={1} />
        <HighlightCard label="Não encontrados" value={result.totalNaoEncontrados} color="red" index={2} />
        <HighlightCard label="Valor total" value={formatBRL(result.totalValor)} color="primary" index={3} />
      </div>
    </SectionContainer>

    {result.totalNaoEncontrados > 0 && (
      <StatusCard icon={XCircle} title={`${result.totalNaoEncontrados} documento(s) do BOR não encontrado(s) na planilha do sistema.`} variant="error" />
    )}
    {result.totalSemValor > 0 && (
      <StatusCard icon={AlertTriangle} title={`${result.totalSemValor} documento(s) encontrado(s) sem valor na planilha.`} variant="warning" />
    )}

    <DataTable
      title="Detalhamento por Fatura"
      badge={`${result.blocos.length} fatura(s)`}
      columns={[
        { key: "fatura", label: "Fatura (BOR)", width: "150px", render: (row: any) => <span className="font-mono">{row.fatura}</span> },
        { key: "documentos", label: "Documentos encontrados", width: "1fr", render: (row: any) => (row.documentos.length > 0 ? row.documentos.join(", ") : "—") },
        { key: "valor", label: "Valor total", width: "140px", render: (row: any) => (row.status === "encontrado" ? formatBRL(row.valor) : "—") },
        { key: "status", label: "Status", width: "140px", render: (row: any) => naturaStatusBadge(row.status) },
      ]}
      data={result.blocos}
      keyExtractor={(_: any, i) => String(i)}
    />

    {result.totalEncontrados > 0 && (
      <AccentButton onClick={() => downloadXlsx(gerarPlanilhaNatura(result.registros), `importacao_natura_${new Date().toISOString().slice(0, 10)}.xlsx`)}>
        <Download className="h-4 w-4" />
        Exportar planilha de importação
      </AccentButton>
    )}
  </div>
);

// ── Platlog ───────────────────────────────────────────────────────────────────

const PlatlogDetalhe = ({ result }: { result: PlatlogProcessingResult }) => (
  <div className="space-y-5">
    <SectionContainer title="Resumo do processamento">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total de documentos" value={result.totalDocumentos} index={0} />
        <SummaryCard label="Valor original" value={formatBRL(result.totalValorOriginal)} index={1} />
        <SummaryCard label="Total de descontos" value={formatBRL(result.totalDescontos)} index={2} />
        <SummaryCard label="Valor final" value={formatBRL(result.totalValorFinal)} index={3} />
      </div>
    </SectionContainer>

    <DataTable
      title="Planilha final"
      badge={`${result.documents.length} documento(s)`}
      columns={[
        { key: "filial", label: "Filial", width: "80px" },
        { key: "serie", label: "Série", width: "80px" },
        { key: "numeroDocumento", label: "Nº Documento", width: "150px", render: (row: any) => <span className="font-mono">{row.numeroDocumento}</span> },
        { key: "tipoDocumento", label: "Tipo", width: "100px" },
        { key: "valorOriginal", label: "Valor original", width: "140px", render: (row: any) => formatBRL(row.valorOriginal) },
        { key: "descontoAplicado", label: "Desconto", width: "140px", render: (row: any) => formatBRL(row.descontoAplicado) },
        { key: "valorFinal", label: "Saldo devedor", width: "140px", className: "font-semibold", render: (row: any) => formatBRL(row.valorFinal) },
      ]}
      data={result.documents}
      keyExtractor={(row: any, i) => `${row.numeroDocumento}_${row.serie}_${i}`}
    />

    {result.descontosAplicados.length > 0 && (
      <DataTable
        title="Documentos que receberam desconto"
        badge={`${result.descontosAplicados.length} desconto(s)`}
        columns={[
          { key: "documentoAlvo", label: "Documento", width: "150px", render: (row: any) => <span className="font-mono">{row.documentoAlvo}</span> },
          { key: "serieAlvo", label: "Série", width: "80px" },
          { key: "tipoDocumentoAlvo", label: "Tipo", width: "100px" },
          { key: "valorDescontoAplicado", label: "Valor descontado", width: "140px", render: (row: any) => formatBRL(row.valorDescontoAplicado) },
          { key: "saldoRestante", label: "Saldo restante", width: "140px", className: "font-semibold", render: (row: any) => formatBRL(row.saldoRestante) },
        ]}
        data={result.descontosAplicados}
        keyExtractor={(row: any, i) => `${row.documentoAlvo}_${i}`}
      />
    )}

    <AccentButton onClick={() => downloadXlsx(gerarPlanilhaPlatlog(result), `baixa_platlog_${new Date().toISOString().slice(0, 10)}.xlsx`)}>
      <Download className="h-4 w-4" />
      Baixar planilha final
    </AccentButton>
  </div>
);

// ── Martin Brower ─────────────────────────────────────────────────────────────

const MartinBrowerDetalhe = ({ result, record }: { result: ProcessingResult; record: HistoryRecord }) => {
  const valorBanco = record.valorInformadoBanco;
  const confere = Math.abs(result.totalValorBruto - valorBanco) < 0.01;

  return (
    <div className="space-y-5">
      <SectionContainer title="Conferência">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HighlightCard label="Total Planilha" value={formatBRL(result.totalValorBruto)} color="neutral" />
          <HighlightCard label="Valor Banco" value={formatBRL(valorBanco)} color="neutral" />
          <HighlightCard label="Diferença" value={formatBRL(Math.abs(result.totalValorBruto - valorBanco))} color={confere ? "emerald" : "red"} />
        </div>
        <div className="mt-4">
          <StatusCard
            title={confere ? "Confere" : "Diverge"}
            description="Status da conferência com valor bancário"
            icon={confere ? CheckCircle2 : XCircle}
            variant={confere ? "success" : "error"}
          />
        </div>
      </SectionContainer>

      <SectionContainer title="Auditoria do Processamento">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Linhas lidas" value={String(result.totalLinhasLidas)} index={0} />
          <SummaryCard label="Filtradas por data" value={String(result.totalLinhasFiltradasData)} index={1} />
          <SummaryCard label="Pgto. vazio (mantidas)" value={String(result.totalLinhasPagamentoVazio)} index={2} />
          <SummaryCard label="Removidas por pgto." value={String(result.totalLinhasRemovidasPagamento)} index={3} />
          <SummaryCard label="Documentos válidos" value={String(result.totalLinhasValidas)} index={4} />
          <SummaryCard label="Com erro" value={String(result.totalLinhasComErro)} index={5} />
          <SummaryCard label="Ignoradas (subtotal)" value={String(result.totalLinhasIgnoradas)} index={6} />
          <SummaryCard label="Total documentos" value={String(result.totalDocumentos)} index={7} />
        </div>
      </SectionContainer>

      {result.preview.length > 0 && (
        <SectionContainer title="Preview de Validação" subtitle="Primeiras linhas processadas">
          <DataTable
            columns={[
              { key: "row", label: "Linha" },
              { key: "dataVcto", label: "Data Vcto." },
              { key: "dataPagamento", label: "Data Pagamento" },
              { key: "faturaOriginal", label: "Nº Fatura" },
              { key: "serie", label: "Série" },
              { key: "numeroDocumento", label: "Nº Documento" },
              { key: "valorBrutoConvertido", label: "Valor Bruto", render: (row: any) => (row.valorBrutoConvertido != null ? formatBRL(row.valorBrutoConvertido) : "—") },
              { key: "status", label: "Status", render: (row: any) => {
                const color = row.status === "válida" ? "text-emerald-400" : row.status === "erro" ? "text-red-400" : "text-amber-400";
                return <span className={color}>{row.status}</span>;
              }},
            ]}
            data={result.preview}
            keyExtractor={(row: any, i) => `preview-${row.row}-${i}`}
          />
        </SectionContainer>
      )}

      {result.errors.length > 0 && (
        <SectionContainer title="Erros encontrados">
          <DataTable
            columns={[
              { key: "row", label: "Linha" },
              { key: "fatura", label: "Nº Fatura" },
              { key: "motivo", label: "Motivo" },
            ]}
            data={result.errors}
            keyExtractor={(row: any, i) => `err-${row.row}-${i}`}
          />
        </SectionContainer>
      )}

      {result.totalDocumentos > 0 && (
        <AccentButton onClick={() => downloadXlsx(gerarPlanilhaFinal(result.documents, new Date(record.dataRecebimento)), `baixa_${record.dataRecebimento.slice(0, 10)}.xlsx`)}>
          <Download className="h-4 w-4" />
          Baixar planilha final
        </AccentButton>
      )}
    </div>
  );
};

// ── Roteador por cliente ──────────────────────────────────────────────────────

const HistoricoDetalhe = ({ record }: { record: HistoryRecord }) => {
  if (!record.payload) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Este registro não possui dados detalhados salvos.
      </p>
    );
  }

  switch (record.payload.tipo) {
    case "danone":
      return <DanoneDetalhe result={record.payload.resultado as DanoneProcessingResult} />;
    case "natura":
      return <NaturaDetalhe result={record.payload.resultado as NaturaProcessingResult} />;
    case "platlog":
      return <PlatlogDetalhe result={record.payload.resultado as PlatlogProcessingResult} />;
    case "martin-brower":
      return <MartinBrowerDetalhe result={record.payload.resultado as ProcessingResult} record={record} />;
    default:
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Tipo de processamento desconhecido.
        </p>
      );
  }
};

export default HistoricoDetalhe;
