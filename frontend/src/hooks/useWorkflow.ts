"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  workflowApi,
  type WorkflowStatusResponse,
} from "@/lib/api/workflow-api";

export type WorkflowState =
  | "idle"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

const POLL_INTERVAL_MS = 4000; // poll every 4 seconds
const STALE_RUN_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export function useWorkflow() {
  const [state, setState] = useState<WorkflowState>("idle");
  const [data, setData] = useState<WorkflowStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  // Track whether the user explicitly triggered the workflow in this session
  const userTriggeredRef = useRef(false);

  // ── Polling controls ─────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const status = await workflowApi.getStatus();
      if (!mountedRef.current) return;

      setData(status);
      setState(status.status);

      // Stop polling on terminal states
      if (
        status.status === "completed" ||
        status.status === "failed" ||
        status.status === "idle"
      ) {
        stopPolling();
      }

      if (status.error) setError(status.error);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Polling failed");
      stopPolling();
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    poll(); // immediate first poll
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [poll, stopPolling]);

  // ── Trigger action ───────────────────────────────────────
  const trigger = useCallback(async () => {
    try {
      userTriggeredRef.current = true;
      setIsTriggering(true);
      setError(null);
      setState("pending");

      await workflowApi.trigger();
      startPolling();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Trigger failed");
      setState("failed");
    } finally {
      setIsTriggering(false);
    }
  }, [startPolling]);

  // ── On mount: load last status for display only ─────────
  // We do NOT auto-start polling here. Polling only starts
  // when the user explicitly clicks "Start Job Matching".
  useEffect(() => {
    mountedRef.current = true;

    const checkExisting = async () => {
      try {
        const status = await workflowApi.getStatus();
        if (!mountedRef.current) return;

        // If there's a pending/processing run but the user didn't
        // trigger it in THIS browser session, always show idle.
        // This prevents the processing spinner from appearing on page load.
        if (
          (status.status === "pending" || status.status === "processing") &&
          !userTriggeredRef.current
        ) {
          setState("idle");
          setData(null);
          return;
        }

        setData(status);
        setState(status.status);
      } catch {
        // silent — user may not have triggered yet
      }
    };

    checkExisting();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPolling]);

  return {
    /** Current workflow state: idle | pending | processing | completed | failed */
    state,
    /** Full status response including results when completed */
    data,
    /** Error message if workflow failed */
    error,
    /** True while the trigger API call is in-flight */
    isTriggering,
    /** Start the job matching workflow */
    trigger,
    /** Manually re-fetch status */
    refresh: poll,
  };
}
