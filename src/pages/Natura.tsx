import { useState, useCallback } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { processarNatura, gerarPlanilhaNatura } from "@/lib/processors/natura";
import type { NaturaProcessingResult } from "@/lib/processors/natura";
import { addRecord } from "@/lib/history";
import { Badge } from "@/components/ui/badge";
import { SectionContainer, DataTable, StatusCard, HighlightCard } from "@/components/dashboard";
import { ClientPageHeader, UploadZone, AccentButton, ActionPanel } from "@/components/client";

const Natura = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [planilhaFile, setPlanilhaFile] = useState<File | null>(null);
  const [result, setResult] = useState<NaturaProcessingResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const handlePdfChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setPdfFile(f); setResult(null); toast({ title: "PDF BOR carregado", description: f.name }); }
  }, []);

  const handlePlanilhaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setPlanilhaFile(f); setResult(null); toast({ title: "Planilha carregada", description: f.name }); }
  }, []);

  const handleDrop = useCallback(
    (type: "pdf" | "planilha") => (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (!f) return;
      if (type === "pdf" && /\.pdf$/i.test(f.name)) {
        setPdfFile(f); setResult(null); toast({ title: "PDF BOR carregado", description: f.name });
      } else if (type === "planilha" && /\.(xlsx?|csv)$/i.test(f.name)) {
        setPlanilhaFile(f); setResult(null); toast({ title: "Planilha carregada", description: f.name });
      }
    },
    []
  );

  const handleProcess = async () => {
    if (!pdfFile || !planilhaFile) return;
    setProcessing(true);
    try {
      const [pdfBuffer, planilhaBuffer] = await Promise.all([pdfFile.arrayBuffer(), planilhaFile.arrayBuffer()]);
      const res = await processarNatura(pdfBuffer, planilhaBuffer);
      setResult(res);
      if (res.documentosBOR.length === 0) {
        toast({ title: "Nenhum compromisso encontrado", description: "Não foi possível localizar a seção COMPROMISSOS no PDF.", variant: "destructive" });
      } else {
        const alertas: string[] = [];
        if (res.totalNaoEncontrados > 0) alertas.push(`${res.totalNaoEncontrados} não encontrado(s)`);
        if (res.totalSemValor > 0) alertas.push(`${res.totalSemValor} sem valor`);
        toast({ title: "Processamento concluído", description: `${res.totalEncontrados} encontrado(s)${alertas.length ? ` · ${alertas.join(" · ")}` : ""}` });
        void addRecord({ cliente: "Natura", dataProcessamento: new Date().toISOString(), dataVencimento: new Date().toISOString(), dataRecebimento: new Date().toISOString(), quantidadeDocumentos: res.totalDocumentos, valorTotal: res.totalValor, valorInformadoBanco: 0, statusConferencia: res.totalNaoEncontrados > 0 ? "diverge" : "confere", quantidadeErros: res.totalNaoEncontrados + res.totalSemValor, payload: { tipo: "natura", resultado: res } });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao processar", description: "Verifique os arquivos e tente novamente.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const buffer = gerarPlanilhaNatura(result.registros);
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `importacao_natura_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Planilha gerada", description: a.download });
  };

  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusIcon = (status: string) => {
    if (status === "encontrado") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    if (status === "não encontrado") return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      encontrado: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      "não encontrado": "bg-red-500/10 text-red-300 border-red-500/20",
      "sem valor": "bg-amber-500/10 text-amber-300 border-amber-500/20",
    };
    return (
      <Badge variant="outline" className={`gap-1 border text-[10px] font-medium ${styles[status] ?? "border-border bg-muted text-muted-foreground"}`}>
        {statusIcon(status)}
        {status}
      </Badge>
    );
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1560px] px-6 py-7">
        <ClientPageHeader
          badgeIcon={FileText}
          badgeLabel="Cliente Natura"
          title="Cruzamento BOR × Planilha"
          description="Envie o PDF BOR e a planilha do sistema para cruzar faturas, localizar documentos, validar valores e gerar a planilha final de importação."
          infoCards={[
            { label: "Entrada", value: "PDF BOR + planilha do sistema" },
            { label: "Saída", value: "Planilha de importação e status do cruzamento" },
          ]}
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.3 }}
          className="mb-6 grid gap-6 xl:grid-cols-2"
        >
          <UploadZone
            id="natura-pdf-input"
            file={pdfFile}
            title="PDF BOR"
            description="Borderô de antecipação em PDF"
            accept=".pdf"
            onChange={handlePdfChange}
            onDrop={handleDrop("pdf")}
            icon={Upload}
          />

          <UploadZone
            id="natura-planilha-input"
            file={planilhaFile}
            title="Planilha do sistema"
            description="Contas a receber (.xlsx, .xls, .csv)"
            accept=".xlsx,.xls,.csv"
            onChange={handlePlanilhaChange}
            onDrop={handleDrop("planilha")}
            icon={FileSpreadsheet}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.3 }}
          className="mb-6"
        >
          <ActionPanel
            icon={Download}
            title="Processamento"
            description="O sistema cruza os arquivos e prepara a planilha final para importação."
            infoText="O BOR é lido para localizar os compromissos, a planilha do sistema é usada para encontrar os documentos e o resultado final é consolidado com status de encontrado, não encontrado ou sem valor."
          >
            <AccentButton
              disabled={!pdfFile || !planilhaFile || processing}
              onClick={handleProcess}
            >
              {processing ? "Processando..." : "Processar arquivos"}
            </AccentButton>
          </ActionPanel>
        </motion.div>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            <SectionContainer title="Resultado do cruzamento" subtitle="Resumo executivo da leitura do BOR e do cruzamento com a planilha do sistema.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <HighlightCard label="Documentos no BOR" value={result.documentosBOR.length} color="neutral" index={0} />
                <HighlightCard label="Encontrados" value={result.totalEncontrados} color="emerald" index={1} />
                <HighlightCard label="Não encontrados" value={result.totalNaoEncontrados} color="red" index={2} />
                <HighlightCard label="Valor total" value={formatBRL(result.totalValor)} color="primary" index={3} />
              </div>
            </SectionContainer>

            {result.totalNaoEncontrados > 0 && (
              <StatusCard
                icon={XCircle}
                title={`${result.totalNaoEncontrados} documento(s) do BOR não encontrado(s) na planilha do sistema.`}
                variant="error"
              />
            )}

            {result.totalSemValor > 0 && (
              <StatusCard
                icon={AlertTriangle}
                title={`${result.totalSemValor} documento(s) encontrado(s) sem valor na planilha.`}
                variant="warning"
              />
            )}

            <DataTable
              title="Detalhamento por Fatura"
              badge={`${result.blocos.length} fatura(s)`}
              columns={[
                { key: "fatura", label: "Fatura (BOR)", width: "150px", render: (row: any) => <span className="font-mono">{row.fatura}</span> },
                { key: "documentos", label: "Documentos encontrados", width: "1fr", render: (row: any) => (row.documentos.length > 0 ? row.documentos.join(", ") : "—") },
                { key: "valor", label: "Valor total", width: "140px", render: (row: any) => (row.status === "encontrado" ? formatBRL(row.valor) : "—") },
                { key: "status", label: "Status", width: "140px", render: (row: any) => statusBadge(row.status) },
              ]}
              data={result.blocos}
              keyExtractor={(_: any, i) => String(i)}
            />

            {result.totalEncontrados > 0 && (
              <div className="flex justify-start">
                <AccentButton onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                  Exportar planilha de importação
                </AccentButton>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Natura;
