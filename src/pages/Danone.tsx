import { useState, useCallback } from "react";
import { Upload, Download, FileCheck, Files } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import {
  processarDanone,
  gerarPlanilhaDanone,
  type DanoneInputFile,
  type DanoneProcessingResult,
} from "@/lib/processors/danone";
import { addRecord } from "@/lib/history";
import { SummaryCard, SectionContainer, DataTable } from "@/components/dashboard";
import type { DataTableColumn } from "@/components/dashboard";
import { ClientPageHeader, AccentButton } from "@/components/client";

const Danone = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<DanoneProcessingResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const mergeFiles = useCallback((incoming: File[]) => {
    const pdfs = incoming.filter((file) => /\.pdf$/i.test(file.name));
    setFiles((prev) => {
      const map = new Map<string, File>();
      [...prev, ...pdfs].forEach((file) => {
        map.set(`${file.name}_${file.size}_${file.lastModified}`, file);
      });
      return Array.from(map.values());
    });
    setResult(null);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const incoming = Array.from(e.target.files ?? []);
      if (incoming.length === 0) return;
      mergeFiles(incoming);
      toast({ title: "PDFs carregados", description: `${incoming.length} arquivo(s) adicionado(s).` });
      e.target.value = "";
    },
    [mergeFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const incoming = Array.from(e.dataTransfer.files ?? []);
      if (incoming.length === 0) return;
      mergeFiles(incoming);
      toast({ title: "PDFs carregados", description: `${incoming.length} arquivo(s) adicionado(s).` });
    },
    [mergeFiles]
  );

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    try {
      const inputFiles: DanoneInputFile[] = await Promise.all(
        files.map(async (file) => ({ fileName: file.name, buffer: await file.arrayBuffer() }))
      );
      const res = await processarDanone(inputFiles);
      setResult(res);
      if (res.totalDocumentos === 0) {
        toast({ title: "Nenhum documento encontrado", description: "Não foi possível extrair dados válidos dos PDFs da Danone.", variant: "destructive" });
      } else {
        toast({ title: "PDFs processados com sucesso", description: `${res.totalDocumentos} documento(s) gerado(s) em ${res.arquivosProcessados} arquivo(s).` });
        void addRecord({ cliente: "Danone", dataProcessamento: new Date().toISOString(), dataVencimento: new Date().toISOString(), dataRecebimento: new Date().toISOString(), quantidadeDocumentos: res.totalDocumentos, valorTotal: res.totalValorFinal, valorInformadoBanco: 0, statusConferencia: "confere", quantidadeErros: 0, payload: { tipo: "danone", resultado: res } });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao processar", description: "Não foi possível ler os PDFs da Danone. Verifique os arquivos enviados.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const buffer = gerarPlanilhaDanone(result);
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `baixa_danone_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Arquivo gerado com sucesso", description: a.download });
  };

  const formatBRL = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1560px] py-2">
        <ClientPageHeader
          badgeLabel="Cliente Danone"
          title="Baixa por aviso de pagamento"
          description="Envie os PDFs de aviso de pagamento da Danone. O sistema extrai documentos, aplica descontos e gera a planilha final para importação."
          infoCards={[
            { label: "Entrada", value: "PDFs de aviso de pagamento" },
            { label: "Saída", value: "Planilha de baixa com descontos aplicados" },
          ]}
        />

        {/* Upload area */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.3 }}
          className="mb-6"
        >
          <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_28%)]" />

            <div className="relative">
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-400">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">PDFs de entrada</h2>
                  <p className="text-sm text-muted-foreground">Arraste ou clique para adicionar arquivos PDF</p>
                </div>
              </div>

              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="block cursor-pointer rounded-[22px] border border-dashed border-violet-500/15 bg-violet-500/[0.04] px-6 py-14 text-center transition-all duration-200 hover:border-violet-500/30 hover:bg-violet-500/[0.07]"
              >
                {files.length > 0 ? (
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
                      <Files className="h-6 w-6 text-violet-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-base font-semibold text-foreground">{files.length} arquivo(s) selecionado(s)</p>
                      <p className="text-sm text-muted-foreground">Clique para adicionar mais PDFs</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-violet-500/15 bg-violet-500/8">
                      <Upload className="h-8 w-8 text-violet-400" />
                    </div>
                    <p className="text-xl font-semibold text-foreground">Arraste ou clique para selecionar vários PDFs</p>
                    <p className="mt-3 text-sm text-muted-foreground">Formato aceito: .pdf</p>
                  </>
                )}
                <input type="file" accept=".pdf,application/pdf" className="hidden" multiple onChange={handleFileChange} />
              </label>

              {files.length > 0 && (
                <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground mb-3">Arquivos carregados</p>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}_${file.size}_${file.lastModified}`}
                        className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-3 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileCheck className="h-4 w-4 shrink-0 text-violet-400" />
                          <p className="text-sm text-foreground/80 truncate" title={file.name}>{file.name}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="text-xs px-2 py-1 rounded-lg text-muted-foreground bg-muted hover:bg-accent transition-colors"
                        >
                          remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <AccentButton className="mt-6" disabled={files.length === 0 || processing} onClick={handleProcess}>
                {processing ? "Processando..." : "Processar PDFs"}
              </AccentButton>
            </div>
          </div>
        </motion.div>

        {result && result.totalDocumentos > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            <SectionContainer title="Resultado do processamento">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Arquivos processados" value={result.arquivosProcessados} index={0} />
                <SummaryCard label="Total de documentos" value={result.totalDocumentos} index={1} />
                <SummaryCard label="Total de descontos" value={formatBRL(result.totalDescontos)} index={2} />
                <SummaryCard label="Valor final" value={formatBRL(result.totalValorFinal)} index={3} />
              </div>
            </SectionContainer>

            <DataTable
              title="Prévia da planilha final"
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

            <div className="flex justify-start">
              <AccentButton onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Baixar planilha final
              </AccentButton>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Danone;
