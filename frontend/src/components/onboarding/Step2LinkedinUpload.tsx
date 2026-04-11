"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { integrationsApi } from "@/lib/api/integrations-api";

interface Step2LinkedinUploadProps {
  onNext: () => void;
}

export default function Step2LinkedinUpload({ onNext }: Step2LinkedinUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkedinImported, setLinkedinImported] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await integrationsApi.getStatus();
        setLinkedinImported(status.linkedinImported);
      } catch (err) {
        console.error("[Step2] Failed to fetch status:", err);
      }
    }

    checkStatus();
  }, []);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      await integrationsApi.uploadLinkedinZip(file);
      setLinkedinImported(true);
    } catch (err) {
      setError((err as Error).message || "Failed to upload LinkedIn ZIP.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-20 left-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-cyan-400/20 rounded-full blur-3xl" />
      <div className="absolute inset-0 dot-grid opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Step 2 of 6
            </p>
            <h1 className="text-4xl font-bold">
              Upload <span className="gradient-text">LinkedIn ZIP</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Upload your LinkedIn export ZIP to import experience, education, and skills.
            </p>
          </div>

          <div className="feature-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Image src="/images/linkedin.png" alt="LinkedIn" width={24} height={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">LinkedIn data import</h3>
                <p className="text-sm text-muted-foreground">
                  Accepted file format: LinkedIn export `.zip` (max 50 MB).
                </p>
              </div>
            </div>

            {linkedinImported ? (
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                LinkedIn data uploaded
              </div>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button
                  variant="outline"
                  className="w-full rounded-xl h-12"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="mr-2 w-4 h-4" />
                      Upload ZIP
                    </>
                  )}
                </Button>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button className="rounded-xl h-11" onClick={onNext} disabled={!linkedinImported}>
            Start Processing
          </Button>
        </div>

        <div className="relative hidden lg:flex justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-3xl blur-2xl" />
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/50">
            <Image
              src="/images/onboarding-illustration.png"
              alt="LinkedIn Upload"
              width={500}
              height={400}
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
