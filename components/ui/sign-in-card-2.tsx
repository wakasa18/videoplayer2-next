"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
} from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
} from "@/components/ui/icons";

import { LordIcon } from "@/components/ui/lord-icon";
import { useUIMotionEnabled } from "@/components/ui/ui-performance-controller";
import { cn } from "@/lib/utils";

type FocusedInput = "email" | "password" | null;

export interface SignInCard2Props {
  className?: string;
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-white flex h-10 w-full min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.045] px-3 py-1 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] outline-none transition-[border-color,background-color,box-shadow,transform] duration-300 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus:border-primary/30 focus:bg-primary/[0.07] focus:ring-4 focus:ring-primary/[0.08]",
        "aria-invalid:border-red-400/45 aria-invalid:ring-4 aria-invalid:ring-red-500/10",
        className,
      )}
      {...props}
    />
  );
}

export function Component({ className }: SignInCard2Props) {
  const router = useRouter();
  const reduceMotion = !useUIMotionEnabled();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<FocusedInput>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to sign in.");

      try {
        if (rememberMe) {
          window.localStorage.setItem("damons-archive:remembered-email", email.trim());
        } else {
          window.localStorage.removeItem("damons-archive:remembered-email");
        }
      } catch {
        // Storage can be unavailable in private/restricted browser contexts.
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to sign in. Check your credentials and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return <main className={cn("flex min-h-svh items-center justify-center px-4 py-10", className)}><section className="auth-login-card w-full max-w-[420px] rounded-2xl border border-border bg-card p-6 sm:p-8"><div className="relative z-10">
                <div className="mb-6 text-center">
                  <div
                    id="sign-in-card-brand"
                    className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl border border-primary/15 bg-primary/[0.10] shadow-none"
                  >
                    <LordIcon
                      name="brand"
                      size={24}
                      active
                      targetId="sign-in-card-brand"
                      className="text-primary"
                    />
                  </div>

                  <p
                    className="mb-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
                  >
                    Secure command workspace
                  </p>
                  <h1
                    className="text-[27px] font-semibold tracking-[-0.045em] text-white sm:text-[30px]"
                  >
                    Welcome back
                  </h1>
                  <p
                    className="mt-2 text-[12px] leading-5 text-muted-foreground"
                  >
                    Sign in to continue to Damon&apos;s Archive.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-3">
                    <div
                      className={cn("relative", focusedInput === "email" && "z-10")}
                    >
                      <div className="relative flex items-center overflow-hidden rounded-xl">
                        <Mail
                          className={cn(
                            "pointer-events-none absolute left-3.5 z-10 size-4 transition-colors duration-300",
                            focusedInput === "email" ? "text-primary" : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                        <Input
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          aria-label="Email address"
                          aria-invalid={Boolean(error)}
                          placeholder="Email address"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          onFocus={() => setFocusedInput("email")}
                          onBlur={() => setFocusedInput(null)}
                          disabled={isLoading}
                          required
                          className="h-11 pl-10 pr-3"
                        />
                      </div>
                    </div>

                    <div
                      className={cn("relative", focusedInput === "password" && "z-10")}
                    >
                      <div className="relative flex items-center overflow-hidden rounded-xl">
                        <Lock
                          className={cn(
                            "pointer-events-none absolute left-3.5 z-10 size-4 transition-colors duration-300",
                            focusedInput === "password" ? "text-primary" : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                        <Input
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          aria-label="Password"
                          aria-invalid={Boolean(error)}
                          placeholder="Password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          onFocus={() => setFocusedInput("password")}
                          onBlur={() => setFocusedInput(null)}
                          disabled={isLoading}
                          required
                          className="h-11 pl-10 pr-11"
                        />
                        <button
                          type="button"
                          data-no-glass
                          data-liquid-glass
                          onClick={() => setShowPassword((current) => !current)}
                          disabled={isLoading}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                          className="absolute right-2 z-20 grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" aria-hidden="true" />
                          ) : (
                            <Eye className="size-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center pt-0.5">
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                      <span className="relative grid size-4 place-items-center">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(event) => setRememberMe(event.target.checked)}
                          disabled={isLoading}
                          className="peer size-4 appearance-none rounded-[5px] border border-primary/20 bg-white/[0.04] transition checked:border-primary/45 checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                        />
                        <Check className="pointer-events-none absolute size-3 text-[#122f29] opacity-0 transition peer-checked:opacity-100" strokeWidth={3} aria-hidden="true" />
                      </span>
                      Remember me
                    </label>
                  </div>

                  <AnimatePresence initial={false}>
                    {error ? (
                      <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
                        role="alert"
                        aria-live="polite"
                        className="flex items-start gap-2.5 rounded-xl border border-red-400/15 bg-red-400/[0.07] px-3.5 py-3 text-[11px] leading-5 text-red-200"
                      >
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>{error}</span>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <button
                    type="submit"
                    data-no-glass
                    data-liquid-glass
                    disabled={isLoading}

                    className="workspace-primary group relative mt-1 h-11 w-full rounded-lg font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    <AnimatePresence mode="wait" initial={false}>
                      {isLoading ? (
                        <motion.span
                          key="loading"
                          initial={reduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={reduceMotion ? undefined : { opacity: 0 }}
                          className="relative flex items-center justify-center gap-2 text-[12px]"
                        >
                          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                          Authenticating...
                        </motion.span>
                      ) : (
                        <motion.span
                          key="ready"
                          initial={reduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={reduceMotion ? undefined : { opacity: 0 }}
                          className="relative flex items-center justify-center gap-2 text-[12px]"
                        >
                          Sign in to workspace
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </form>

                <div className="mt-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.08]" />
                  <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Private access</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.08]" />
                </div>

                <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/[0.07] bg-primary/[0.035] px-3.5 py-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-primary/12 bg-primary/[0.07] text-primary/70">
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                  </span>
                  <p className="text-[10px] leading-5 text-muted-foreground">
                    Login attempts and active sessions are protected by Damon&apos;s Archive security controls.
                  </p>
                </div>

              </div></section></main>;
}

export default Component;
