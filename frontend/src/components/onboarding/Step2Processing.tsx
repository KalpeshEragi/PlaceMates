"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Lottie from "lottie-react";
import { onboardingApi } from "@/lib/api/onboarding-api";
import { Button } from "@/components/ui/button";

export default function Step2Processing({
  onNextAction,
}: {
  onNextAction: () => void;
}) {
  const steps = [
    "Starting deterministic analysis",
    "Analyzing top GitHub repositories",
    "Parsing LinkedIn export data",
    "Generating summary and bullets",
    "Finalizing portfolio data",
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const [animationData, setAnimationData] = useState(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing...");
  const hasStarted = useRef(false);

  useEffect(() => {
    fetch("/lottie/robo-processing.json")
      .then((res) => res.json())
      .then((data) => setAnimationData(data))
      .catch(() => {});
  }, []);

  const pollForReadyState = useCallback(async () => {
    const maxAttempts = 90;
    let attempts = 0;

    const poll = async (): Promise<void> => {
      attempts++;
      try {
        const status = await onboardingApi.getStatus();

        if (status.analysisStatus === "failed") {
          setError(
            status.analysisError || "Analysis failed. Please restart processing.",
          );
          return;
        }

        if (status.analysisStatus === "success" && status.onboardingStage === "ready") {
          setCurrentStep(4);
          setStatusMessage("Ready. Continue to project selection...");
          setTimeout(() => onNextAction(), 700);
          return;
        }

        if (status.analysisStatus === "running") {
          if (status.dataSummary.projects > 0 && status.dataSummary.experiences > 0) {
            setCurrentStep(3);
            setStatusMessage("Summary generation in progress...");
          } else if (status.dataSummary.projects > 0) {
            setCurrentStep(2);
            setStatusMessage("LinkedIn data merge in progress...");
          } else {
            setCurrentStep(1);
            setStatusMessage("Repository analysis running...");
          }
        } else {
          setCurrentStep(1);
          setStatusMessage("Waiting for analysis tasks to complete...");
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2500);
        } else {
          setError("Processing timed out. Please try starting processing again.");
        }
      } catch (err) {
        console.error("[StepProcessing] Poll error:", err);
        if (attempts < maxAttempts) {
          setTimeout(poll, 2500);
        } else {
          setError("Unable to check processing status.");
        }
      }
    };

    await poll();
  }, [onNextAction]);

  const startAnalysis = useCallback(async () => {
    try {
      setError(null);
      setCurrentStep(0);
      setStatusMessage("Starting backend processing pipeline...");

      await onboardingApi.triggerGithubAnalysis();
      setCurrentStep(2);
      await onboardingApi.triggerLinkedinAnalysis();
      setCurrentStep(3);
      setStatusMessage("Processing started. Waiting for completion...");

      await pollForReadyState();
    } catch (err) {
      console.error("[StepProcessing] Failed to start:", err);
      setError((err as Error).message || "Failed to start processing.");
    }
  }, [pollForReadyState]);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startAnalysis();
  }, [startAnalysis]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-teal-400/20 rounded-full blur-3xl" />
      <div className="absolute inset-0 dot-grid opacity-30" />

      <div className="relative z-10 max-w-xl w-full px-6 text-center space-y-10">
        <div className="flex justify-center">
          {animationData && (
            <Lottie
              animationData={animationData}
              loop={true}
              className="w-64 h-auto"
            />
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold">
            {error ? "Processing failed" : "Step 3 of 6: Processing data"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {error
              ? "A deterministic backend task failed."
              : statusMessage}
          </p>
        </div>

        {!error && (
          <div className="space-y-3 text-left max-w-md mx-auto">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                  index === currentStep
                    ? "text-primary font-medium"
                    : index < currentStep
                      ? "text-green-600"
                      : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? "bg-primary animate-pulse"
                      : index < currentStep
                        ? "bg-green-500"
                        : "bg-gray-300"
                  }`}
                />
                {step}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <p className="text-sm text-red-500 bg-red-50 rounded-lg p-4">
              {error}
            </p>
            <Button onClick={startAnalysis}>Start Processing Again</Button>
          </div>
        )}

        {!error && (
          <p className="text-xs text-muted-foreground">
            Processing may take 1-3 minutes depending on repository count.
          </p>
        )}
      </div>
    </div>
  );
}