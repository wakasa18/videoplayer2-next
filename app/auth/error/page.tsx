import { AlertTriangle } from "@/components/ui/icons";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "The verification link is incomplete. Request a new email and try again.",
  verification_failed: "The verification link is invalid or has expired. Request a new email and try again.",
};

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const message = ERROR_MESSAGES[String(params?.code ?? "")] ??
    "The authentication request could not be completed.";

  return <p className="text-sm leading-6 text-slate-400">{message}</p>;
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <span className="grid size-11 place-items-center rounded-2xl border border-red-300/20 bg-red-400/10 text-red-300">
            <AlertTriangle className="size-5" />
          </span>
          <CardTitle className="mt-4 text-2xl">Sorry, something went wrong.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Suspense fallback={<p className="text-sm text-slate-400">Checking the request…</p>}>
            <ErrorContent searchParams={searchParams} />
          </Suspense>
          <Link
            href="/auth/login"
            className="tech-interactive inline-flex min-h-11 items-center justify-center rounded-full border border-primary/20 workspace-primary px-5 text-sm font-semibold text-[#122f29] shadow-none hover:brightness-110"
          >
            Back to login
          </Link>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
