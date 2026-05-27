'use client';

import { useState, useCallback } from 'react';
import { Shield, Eye, EyeOff, LogIn, AlertCircle, BarChart3, FileText, Calculator } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/auth-store';
import { getLocalLicenseKey } from '@/lib/license-engine';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LoginScreenProps {
  onLoginSuccess: (user: {
    id: string;
    username: string;
    name: string;
    role: string;
    isMaster: boolean;
  }, token: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Login Screen Component                                             */
/* ------------------------------------------------------------------ */

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  const { login } = useAuthStore();

  // Check if there's no active license to show default credentials hint
  const hasLicenseKey = typeof window !== 'undefined' ? !!getLocalLicenseKey() : false;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(`Cuenta bloqueada. Intente nuevamente en ${remaining} segundos.`);
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError('Ingrese usuario y contraseña.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle rate limiting / lockout
        if (res.status === 429 && data.lockoutUntil) {
          const lockTime = new Date(data.lockoutUntil).getTime();
          setLockoutUntil(lockTime);
          const remaining = Math.ceil((lockTime - Date.now()) / 1000);
          setError(`Demasiados intentos fallidos. Cuenta bloqueada por ${remaining} segundos.`);
        } else {
          setError(data.error || 'Error de autenticación.');
        }
        return;
      }

      // Success
      const { user, token } = data;
      login(user, token);
      onLoginSuccess(user, token);
    } catch {
      setError('Error de conexión. Verifique su red e intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  }, [username, password, lockoutUntil, login, onLoginSuccess]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" style={{ animation: 'bg-drift-1 25s ease-in-out infinite' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/3 blur-3xl" style={{ animation: 'bg-drift-2 30s ease-in-out infinite' }} />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-info/5 blur-2xl" style={{ animation: 'bg-drift-1 35s ease-in-out infinite' }} />
        <div className="absolute top-3/4 right-1/3 w-72 h-72 rounded-full bg-primary/4 blur-3xl" style={{ animation: 'bg-drift-2 28s ease-in-out infinite 3s' }} />
        <div className="absolute top-1/2 right-1/4 w-48 h-48 rounded-full bg-info/4 blur-2xl" style={{ animation: 'bg-drift-1 22s ease-in-out infinite 5s' }} />
        <div className="absolute bottom-1/4 left-1/6 w-56 h-56 rounded-full bg-primary/3 blur-3xl" style={{ animation: 'bg-drift-2 32s ease-in-out infinite 2s' }} />
      </div>

      <Card className="glass-card w-full max-w-4xl animate-slide-up relative z-10 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* ── Left Panel: Branding ── */}
          <div className="relative flex flex-col items-center justify-center px-10 py-12 md:px-12 md:py-14 md:min-w-[380px] gradient-primary text-primary-foreground overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-20 -left-20 w-52 h-52 rounded-full bg-white/8" style={{ animation: 'float-slow 16s ease-in-out infinite' }} />
            <div className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full bg-white/6" style={{ animation: 'float-medium 12s ease-in-out infinite' }} />
            <div className="absolute top-1/2 left-1/3 w-24 h-24 rounded-full bg-white/10" style={{ animation: 'float-fast 10s ease-in-out infinite' }} />
            <div className="absolute top-1/4 right-1/4 w-16 h-16 rounded-full bg-white/8" style={{ animation: 'orbit 20s linear infinite' }} />
            <div className="absolute bottom-1/3 left-1/4 w-20 h-20 rounded-full bg-white/6" style={{ animation: 'float-slow 14s ease-in-out infinite 2s' }} />
            <div className="absolute top-[15%] right-[10%] w-28 h-28 rounded-full bg-white/7" style={{ animation: 'float-slow 18s ease-in-out infinite 4s' }} />
            <div className="absolute bottom-[10%] right-[30%] w-14 h-14 rounded-full bg-white/9" style={{ animation: 'float-medium 11s ease-in-out infinite 1s' }} />
            <div className="absolute top-[60%] left-[10%] w-18 h-18 rounded-full bg-white/5" style={{ animation: 'float-fast 9s ease-in-out infinite 3s' }} />
            <div className="absolute top-[35%] left-[60%] w-10 h-10 rounded-full bg-white/11" style={{ animation: 'orbit 25s linear infinite reverse' }} />
            <div className="absolute bottom-[45%] right-[15%] w-32 h-32 rounded-full bg-white/4" style={{ animation: 'float-slow 20s ease-in-out infinite 6s' }} />
            <div className="absolute top-[5%] left-[40%] w-12 h-12 rounded-full bg-white/7" style={{ animation: 'float-medium 13s ease-in-out infinite 5s' }} />
            <div className="absolute bottom-[20%] left-[50%] w-8 h-8 rounded-full bg-white/10" style={{ animation: 'float-fast 8s ease-in-out infinite 2s' }} />

            <div className="relative z-10 flex flex-col items-center text-center space-y-6">
              {/* Logo icon */}
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm shadow-lg">
                <Shield className="h-10 w-10 text-primary-foreground" />
              </div>

              {/* App name */}
              <div>
                <h1 className="text-4xl font-bold tracking-tight">
                  BARAPRO
                </h1>
                <Badge
                  variant="secondary"
                  className="mt-2 h-[22px] px-2.5 text-[11px] font-mono font-semibold bg-white/15 text-primary-foreground border-white/20"
                >
                  v10.2
                </Badge>
              </div>

              {/* Tagline */}
              <p className="text-lg font-medium text-primary-foreground/90">
                Evaluación Financiera de Proyectos
              </p>

              {/* Feature icons */}
              <div className="flex items-center gap-6 pt-2">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] text-primary-foreground/70">Cálculos</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] text-primary-foreground/70">Indicadores</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] text-primary-foreground/70">Informes</span>
                </div>
              </div>

              {/* Resolution reference */}
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 text-xs text-primary-foreground/70">
                <Shield className="h-3.5 w-3.5" />
                <span>Resolución 1/2022 del MINCEX</span>
              </div>
            </div>
          </div>

          {/* ── Right Panel: Login Form ── */}
          <div className="flex-1 flex items-center justify-center px-10 py-12 md:px-14 md:py-14">
            <div className="w-full max-w-sm space-y-8">
              {/* Welcome text */}
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Bienvenido
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Ingrese sus credenciales para acceder al sistema
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error message */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 animate-fade-in-up">
                    <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                    <p className="text-sm text-danger">{error}</p>
                  </div>
                )}

                {/* Username field */}
                <div className="space-y-2.5">
                  <Label htmlFor="username" className="text-sm font-medium">
                    Usuario
                  </Label>
                  <div className="relative">
                    <Input
                      id="username"
                      type="text"
                      placeholder="Ingrese su usuario"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      autoFocus
                      className="h-11 pl-4 text-base"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="space-y-2.5">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Ingrese su contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="h-11 pr-11 pl-4 text-base"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Login button */}
                <Button
                  type="submit"
                  className="w-full h-11 gradient-primary text-primary-foreground font-medium text-base shadow-card-md hover:shadow-card-lg transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      <span>Verificando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      <span>Iniciar Sesión</span>
                    </div>
                  )}
                </Button>

                {/* Default credentials hint — always shown for convenience */}
                <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-1">
                  <p className="text-center text-xs font-medium text-primary/80">
                    Credenciales predeterminadas
                  </p>
                  <p className="text-center text-xs text-muted-foreground">
                    Usuario: <span className="font-mono font-semibold text-foreground">admin</span> &nbsp;|&nbsp; Contraseña: <span className="font-mono font-semibold text-foreground">2026</span>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
