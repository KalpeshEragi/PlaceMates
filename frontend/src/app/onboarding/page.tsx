// src/app/onboarding/page.tsx

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api/auth-api";
import { onboardingApi } from "@/lib/api/onboarding-api";

import Step1Connect from "@/components/onboarding/Step1Connect";
import Step2LinkedinUpload from "@/components/onboarding/Step2LinkedinUpload";
import Step2Processing from "@/components/onboarding/Step2Processing";
import Step3SelectProjects from "@/components/onboarding/Step3SelectProjects";
import Step3ProjectQuiz from "@/components/onboarding/Step3ProjectQuiz";
import Step4Templates from "@/components/onboarding/Step4Templates";
import StepPreviewEdit from "@/components/onboarding/StepPreviewEdit";
import Step5Done from "@/components/onboarding/Step5Done";

function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editContent = searchParams.get("edit") === "content";

  const [step, setStep] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolveStep() {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.replace("/Authentication");
          return;
        }

        const user = await authApi.getMe();
        const status = await onboardingApi.getStatus();

        if (editContent) {
          setStep(7);
          return;
        }

        if (status.analysisStatus === "running") {
          setStep(3); // Step2Processing
          return;
        }

        if (!user.githubConnected || status.onboardingStage === "new") {
          setStep(1);
        } else if (!user.linkedinImported || status.onboardingStage === "github_connected") {
          setStep(2);
        } else if (status.onboardingStage === "linkedin_imported") {
          setStep(3);
        } else if (status.onboardingStage === "ready") {
          if (!status.portfolioQuizCompleted) {
            if (status.selectedProjectCount >= 5) {
              setStep(5);
            } else {
              setStep(4);
            }
          } else if (status.onboardingOutputFinalized === true) {
            setStep(8);
          } else if (!status.portfolioTemplateId || !status.resumeTemplateId) {
            setStep(6);
          } else {
            setStep(7);
          }
        } else {
          setStep(8);
        }
      } catch (err) {
        console.error("[Onboarding] Failed to resolve step:", err);
        router.replace("/Authentication");
      } finally {
        setLoading(false);
      }
    }

    resolveStep();
  }, [router, editContent]);

  if (loading || step === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  switch (step) {
    case 1:
      return <Step1Connect onNext={() => setStep(2)} />;
    case 2:
      return <Step2LinkedinUpload onNext={() => setStep(3)} />;
    case 3:
      return <Step2Processing onNextAction={() => setStep(4)} />;
    case 4:
      return <Step3SelectProjects onNextAction={() => setStep(5)} />;
    case 5:
      return <Step3ProjectQuiz onNextAction={() => setStep(6)} />;
    case 6:
      return <Step4Templates onNextAction={() => setStep(7)} />;
    case 7:
      return <StepPreviewEdit onNextAction={() => setStep(8)} />;
    case 8:
      return <Step5Done />;
    default:
      return null;
  }
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <OnboardingFlow />
    </Suspense>
  );
}
