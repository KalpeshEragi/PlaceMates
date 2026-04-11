import type { FeatureConfidence, FeatureSource } from "../types/index";

const SOURCE_WEIGHTS: Record<FeatureSource, number> = {
  readme: 0.5,
  files: 0.3,
  commits: 0.2,
};

const FEATURE_NORMALIZATION: Record<string, string> = {
  authentication: "authentication",
  "user authentication system": "authentication",
  "admin panel with role-based access": "admin panel",
  "admin & rbac": "admin panel",
  "api layer": "api",
  "restful api layer": "api",
  "database management layer": "database layer",
  database: "database layer",
  "dashboard & analytics": "analytics dashboard",
  "analytics dashboard": "analytics dashboard",
  "search & filtering": "search",
  "search and filtering engine": "search",
  "messaging & realtime": "realtime",
  "real-time communication system": "realtime",
  "file upload and storage system": "file storage",
  "file management": "file storage",
  "email notification service": "notifications",
  "email & notifications": "notifications",
};

function normalizeFeatureName(feature: string): string {
  const cleaned = feature.trim().toLowerCase();
  if (!cleaned) return "";
  return FEATURE_NORMALIZATION[cleaned] ?? cleaned;
}

function sortedSources(sources: Set<FeatureSource>): FeatureSource[] {
  return ["readme", "files", "commits"].filter((s) =>
    sources.has(s as FeatureSource),
  ) as FeatureSource[];
}

export function extractFeatureConfidence(input: {
  readmeFeatures: string[];
  fileFeatures: string[];
  commitFeatures: string[];
  minConfidence?: number;
}): FeatureConfidence[] {
  const minConfidence = input.minConfidence ?? 0.6;
  const signals = new Map<string, Set<FeatureSource>>();

  const addFeatures = (features: string[], source: FeatureSource) => {
    for (const raw of features) {
      const normalized = normalizeFeatureName(raw);
      if (!normalized) continue;
      if (!signals.has(normalized)) signals.set(normalized, new Set<FeatureSource>());
      signals.get(normalized)!.add(source);
    }
  };

  addFeatures(input.readmeFeatures, "readme");
  addFeatures(input.fileFeatures, "files");
  addFeatures(input.commitFeatures, "commits");

  const ranked: FeatureConfidence[] = [...signals.entries()]
    .map(([name, sources]) => {
      const confidence = sortedSources(sources).reduce(
        (acc, source) => acc + SOURCE_WEIGHTS[source],
        0,
      );

      return {
        name,
        confidence: Math.min(1, Number(confidence.toFixed(2))),
        sources: sortedSources(sources),
      };
    })
    .filter((feature) => feature.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));

  return ranked;
}
