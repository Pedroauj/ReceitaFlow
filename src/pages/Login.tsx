import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Hexagon, Mail, Lock, Eye, EyeOff, Sparkles, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Login = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard", { replace: true });
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const isTimeout = error.message?.toLowerCase().includes("timeout") || error.status === 504;
        toast({
          title: isTimeout ? "Servidor temporariamente indisponível" : "Erro ao entrar",
          description: isTimeout
            ? "O servidor está demorando para responder. Aguarde alguns segundos e tente novamente."
            : error.message,
          variant: "destructive",
        });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch {
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast({ title: "Erro ao entrar com Google", description: String(result.error), variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-8 bg-[#0a0d16]">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-80px] h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute left-[8%] top-[20%] h-[200px] w-[200px] rounded-full bg-indigo-500/8 blur-3xl" />
        <div className="absolute right-[6%] bottom-[10%] h-[240px] w-[240px] rounded-full bg-violet-500/8 blur-3xl" />
        <div className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8 cursor-pointer select-none" onClick={() => navigate("/")}>
          <div className="h-11 w-11 rounded-2xl flex items-center justify-center border border-violet-500/25 bg-violet-500/15 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <Hexagon className="h-6 w-6 text-violet-300" />
          </div>
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 m-0">plataforma financeira</p>
            <h1 className="text-xl font-semibold text-white m-0">
              Receita<span className="text-violet-400">Flow</span>
            </h1>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-[28px] p-[1px]"
          style={{
            background: "linear-gradient(180deg, rgba(99,102,241,0.35) 0%, rgba(30,30,40,0.5) 35%, rgba(20,20,30,0.6) 100%)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          }}
        >
          <div className="rounded-[27px] px-6 py-7 md:px-7 bg-[linear-gradient(180deg,rgba(16,18,30,0.97)_0%,rgba(10,12,22,0.99)_100%)]">

            {/* Badge */}
            <div className="flex items-center justify-center mb-5">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-violet-500/20 bg-violet-500/10">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[11px] font-medium text-violet-300">Acesso seguro à plataforma</span>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-center mb-1 text-white">Entrar</h2>
            <p className="text-sm text-center mb-6 leading-6 text-slate-400">
              Acesse sua conta para continuar no ambiente financeiro
            </p>

            {/* Google */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 text-sm mb-4 rounded-2xl border border-white/8 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07] hover:text-white transition-all"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </Button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-600">ou continue com email</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-slate-500">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl border border-white/8 bg-white/[0.04] text-white placeholder:text-slate-600 focus:border-violet-500/40 focus:ring-violet-500/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-slate-500">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 rounded-xl border border-white/8 bg-white/[0.04] text-white placeholder:text-slate-600 focus:border-violet-500/40 focus:ring-violet-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-500" />
                  <span>Ambiente protegido</span>
                </div>
                <Link to="/esqueci-senha" className="text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors hover:underline">
                  Esqueci minha senha
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold rounded-2xl border-0 mt-1 bg-[linear-gradient(135deg,rgba(99,102,241,0.9),rgba(139,92,246,0.8))] text-white shadow-[0_12px_28px_rgba(99,102,241,0.25)] hover:shadow-[0_14px_32px_rgba(99,102,241,0.35)] hover:opacity-95 transition-all"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs mt-5 text-slate-600">
          Acesso somente por convite
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
