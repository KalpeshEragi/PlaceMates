"use client";

import { useState } from "react";
import {
  evaluationApi,
  type UserEvaluation,
} from "@/lib/api/evaluation-api";

export default function EvaluationPage() {
  const [evaluation, setEvaluation] = useState<UserEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runEval = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await evaluationApi.run();
      setEvaluation(res.evaluation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run evaluation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Evaluation Dashboard</h1>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs text-violet-600">
              📊
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            Measure semantic matching quality with IR metrics (Precision@K, Recall@K, NDCG@K).
          </p>
        </div>

        <button
          id="btn-run-evaluation"
          onClick={runEval}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running…
            </>
          ) : (
            <>
              🧪 Run Evaluation
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* No data yet */}
      {!evaluation && !loading && !error && (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center text-3xl">
            📊
          </div>
          <h2 className="text-xl font-semibold">No Evaluation Data Yet</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Click <strong>Run Evaluation</strong> to compute IR metrics for your job matches.
            This compares semantic vs keyword matching quality using standard retrieval metrics.
          </p>
        </div>
      )}

      {/* Results */}
      {evaluation && (
        <div className="space-y-6">
          {/* Match Method Distribution */}
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <h3 className="font-semibold text-lg mb-4">Match Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Semantic Matches"
                value={evaluation.semanticMatches}
                color="text-violet-600"
                bg="bg-violet-500/10"
                icon="🤖"
              />
              <MetricCard
                label="Keyword Matches"
                value={evaluation.keywordMatches}
                color="text-slate-600"
                bg="bg-slate-500/10"
                icon="🔑"
              />
              <MetricCard
                label="Total Resumes"
                value={evaluation.resumeCount}
                color="text-blue-600"
                bg="bg-blue-500/10"
                icon="📄"
              />
              <MetricCard
                label="Avg ATS Score"
                value={evaluation.averageAtsScore != null ? evaluation.averageAtsScore : "—"}
                color="text-green-600"
                bg="bg-green-500/10"
                icon="🎯"
              />
            </div>
          </div>

          {/* IR Metrics */}
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <h3 className="font-semibold text-lg mb-1">Retrieval Quality Metrics</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Standard Information Retrieval metrics measuring ranking quality. Higher = better.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricBar label="Precision@5" value={evaluation.metrics.precision5} />
              <MetricBar label="Precision@10" value={evaluation.metrics.precision10} />
              <MetricBar label="Recall@5" value={evaluation.metrics.recall5} />
              <MetricBar label="Recall@10" value={evaluation.metrics.recall10} />
              <MetricBar label="NDCG@5" value={evaluation.metrics.ndcg5} />
              <MetricBar label="NDCG@10" value={evaluation.metrics.ndcg10} />
            </div>
          </div>

          {/* ATS Score Distribution */}
          {evaluation.atsDistribution.some((b) => b.count > 0) && (
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
              <h3 className="font-semibold text-lg mb-4">ATS Score Distribution</h3>
              <div className="flex items-end gap-2 h-32">
                {evaluation.atsDistribution.map((bucket) => {
                  const maxCount = Math.max(
                    ...evaluation.atsDistribution.map((b) => b.count),
                    1
                  );
                  const height = (bucket.count / maxCount) * 100;
                  return (
                    <div
                      key={bucket.bucket}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <span className="text-xs font-medium">{bucket.count}</span>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-violet-600 to-violet-400 transition-all duration-500"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {bucket.bucket}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function MetricCard({
  label,
  value,
  color,
  bg,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  bg: string;
  icon: string;
}) {
  return (
    <div className={`rounded-xl ${bg} p-4 text-center`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100);
  const barColor =
    percentage >= 80
      ? "bg-green-500"
      : percentage >= 60
        ? "bg-yellow-500"
        : percentage >= 40
          ? "bg-orange-500"
          : "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-bold">{percentage}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-700`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
