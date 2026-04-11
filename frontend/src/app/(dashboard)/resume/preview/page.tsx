"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingApi, type UserPreviewPayload } from "@/lib/api/onboarding-api";
import { resumeComponentForId } from "@/lib/templates/template-registry";

export default function ResumePreviewPage() {
  const router = useRouter();
  const [data, setData] = useState<UserPreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/Authentication");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const payload = await onboardingApi.getPreviewData();
        if (!cancelled) setData(payload);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Failed to load resume.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const Resume = resumeComponentForId(data.resumeTemplateId);

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 print:hidden backdrop-blur">
        <p className="text-sm text-muted-foreground">Resume preview — use Print to save as PDF</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
            Dashboard
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print / PDF
          </Button>
        </div>
      </div>
      <Resume data={data.resumeData} />
    </div>
  );
}
