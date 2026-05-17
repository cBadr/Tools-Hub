"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function OAuthCompletePage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const oauth   = searchParams.get("oauth");
    const error   = searchParams.get("error");
    const provider = searchParams.get("provider");

    if (window.opener) {
      window.opener.postMessage(
        { type: "oauth_complete", success: oauth === "success", provider, error },
        window.location.origin
      );
      setTimeout(() => window.close(), 300);
    } else {
      // Not opened as popup — redirect to the tool page
      const params = new URLSearchParams();
      if (oauth)    params.set("oauth", oauth);
      if (provider) params.set("provider", provider);
      if (error)    params.set("error", error);
      window.location.replace(`/tools/email-extractor?${params.toString()}`);
    }
  }, [searchParams]);

  const isSuccess = searchParams.get("oauth") === "success";
  const hasError  = !!searchParams.get("error");

  return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        {hasError ? (
          <XCircle className="w-10 h-10 text-red-400" />
        ) : isSuccess ? (
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        ) : (
          <Loader2 className="w-10 h-10 animate-spin text-violet-400" />
        )}
        <p className="text-sm text-slate-400">
          {hasError ? "Authentication failed. Closing…" : isSuccess ? "Connected! Closing…" : "Completing authentication…"}
        </p>
      </div>
    </div>
  );
}
