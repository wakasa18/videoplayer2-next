"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Check, Copy } from "../ui/icons";

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <pre className="bg-muted rounded-md p-6 my-6 relative">
      <Button size="icon" onClick={copy} variant="outline" className="absolute right-2 top-2" aria-label={copied ? "Copied" : "Copy code"}>
        {copied ? <Check active /> : <Copy />}
      </Button>
      <code className="text-xs p-3">{code}</code>
    </pre>
  );
}
