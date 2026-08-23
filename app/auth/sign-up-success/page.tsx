import { MailCheck } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <span className="grid size-11 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
            <MailCheck className="size-5" />
          </span>
          <CardTitle className="mt-4 text-2xl">Thank you for signing up!</CardTitle>
          <CardDescription>Check your email to confirm</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-slate-400">
            You&apos;ve successfully signed up. Please check your email to confirm your account
            before signing in.
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
