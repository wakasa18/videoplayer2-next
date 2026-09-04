"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      router.replace("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Check your credentials and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("w-full", className)} {...props}>
      <div className="tech-panel relative overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div className="tech-scanline" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-cyan-400/[0.08] blur-3xl"
        />

        <div className="relative">
          <div className="mb-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
              <span className="tech-status-dot size-1.5 rounded-full bg-emerald-300" />
              Secure access online
            </div>
            <h1 className="tech-title text-2xl font-semibold tracking-[-0.03em] sm:text-[28px]">
              Welcome back
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
              Sign in with your authorized Damon&apos;s Archive account to open your private workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-200">
                Email address
              </Label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-[15px] pl-10 pr-4"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-200">
                Password
              </Label>
              <div className="relative">
                <KeyRound
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-[15px] pl-10 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 disabled:pointer-events-none disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-start gap-3 rounded-2xl border border-red-300/15 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p className="leading-5">{error}</p>
              </div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="group h-12 w-full rounded-[15px] text-sm"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign in to workspace
                  <ArrowRight
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-white/[0.07] pt-5">
            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.025] px-3.5 py-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-200">Authorized access only</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  Your session is protected by the application&apos;s secure authentication layer.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-slate-600">
        <LockKeyhole className="size-3.5" aria-hidden="true" />
        Private system · Damon&apos;s Archive
      </p>
    </div>
  );
}
