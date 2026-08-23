import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Suspense } from "react";

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

  return <p className="text-sm leading-6 text-muted-foreground">{message}</p>;
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sorry, something went wrong.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Suspense fallback={<p className="text-sm text-muted-foreground">Checking the request…</p>}>
              <ErrorContent searchParams={searchParams} />
            </Suspense>
            <Link
              href="/auth/login"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white hover:bg-[#1557b0]"
            >
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
