import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { PresentationModeProvider } from "@/contexts/PresentationModeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";

import Landing from "./pages/Landing";
import Login from "./pages/Login";

import EsqueciSenha from "./pages/EsqueciSenha";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import MartinBrower from "./pages/MartinBrower";
import Historico from "./pages/Historico";

import Clientes from "./pages/Clientes";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import Usuarios from "./pages/Usuarios";
import ClientePlaceholder from "./pages/ClientePlaceholder";
import Natura from "./pages/Natura";
import Danone from "@/pages/Danone";
import Platlog from "@/pages/Platlog";
import Conciliacao from "./pages/Conciliacao";
import Abastecimento from "./pages/Abastecimento";
import MediasAbastecimento from "./pages/MediasAbastecimento";
import Inicio from "./pages/Inicio";
import Minerva from "./pages/Minerva";
import JBS from "./pages/JBS";
import ContasAPagar from "./pages/ContasAPagar";
import SgtWorkspace from "./pages/SgtWorkspace";

const queryClient = new QueryClient();

// Helper to wrap a page with module permission check
const withModule = (moduleKey: string, element: React.ReactNode) => (
  <ProtectedRoute moduleKey={moduleKey}>{element}</ProtectedRoute>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PresentationModeProvider>
          <Toaster />
          <Sonner />

          <BrowserRouter>
            <Routes>
              {/* Rotas públicas */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              
              <Route path="/esqueci-senha" element={<EsqueciSenha />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Rotas protegidas */}
              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/inicio" element={<Inicio />} />
                <Route path="/dashboard" element={withModule("dashboard", <Index />)} />
                <Route path="/historico" element={withModule("historico", <Historico />)} />
                
                <Route path="/clientes" element={withModule("clientes", <Clientes />)} />
                <Route path="/conciliacao" element={withModule("conciliacao", <Conciliacao />)} />
                <Route path="/abastecimento" element={withModule("abastecimento", <Abastecimento />)} />
                <Route path="/medias-abastecimento" element={withModule("medias-abastecimento", <MediasAbastecimento />)} />
                <Route path="/contas-a-pagar" element={withModule("contas-a-pagar", <ContasAPagar />)} />
                <Route path="/configuracoes" element={withModule("configuracoes", <Configuracoes />)} />
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/cliente/minerva" element={<Minerva />} />
                <Route path="/cliente/martin-brower" element={<MartinBrower />} />
                <Route path="/cliente/danone" element={<Danone />} />
                <Route path="/cliente/platlog" element={<Platlog />} />
                <Route path="/cliente/jbs" element={<JBS />} />
                <Route path="/cliente/natura" element={<Natura />} />
                <Route path="/sgt" element={<SgtWorkspace />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </PresentationModeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
