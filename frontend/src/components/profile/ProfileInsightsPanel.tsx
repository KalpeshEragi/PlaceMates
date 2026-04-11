"use client";

/**
 * ProfileInsightsPanel.tsx
 *
 * Read-only right panel showing computed profile insights:
 * domains, skill distribution, top tech, project stats,
 * contribution summary, experience level, profile strength.
 */

import { useEffect, useState } from "react";
import {
  Target,
  BarChart3,
  Zap,
  FolderKanban,
  GitBranch,
  Trophy,
  Shield,
  TrendingUp,
} from "lucide-react";
import type { ProfileInsights } from "@/lib/api/profile-api";
import styles from "./profile.module.css";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  Frontend: styles.barFillBlue,
  Backend: styles.barFillGreen,
  "ML/AI": styles.barFillPurple,
  ML: styles.barFillPurple,
  Mobile: styles.barFillOrange,
  DevOps: styles.barFillTeal,
  Other: styles.barFillRed,
};

function getBarColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? styles.barFillBlue;
}

function getStrengthColor(score: number): string {
  if (score >= 80) return "hsl(160, 55%, 42%)";
  if (score >= 50) return "hsl(45, 80%, 45%)";
  return "hsl(0, 55%, 50%)";
}

function getStrengthLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Strong";
  if (score >= 40) return "Growing";
  return "Getting Started";
}

function getContributionLabel(summary: string): {
  label: string;
  bg: string;
  color: string;
} {
  switch (summary) {
    case "frontend-heavy":
      return {
        label: "Frontend-Heavy",
        bg: "hsla(230, 75%, 52%, 0.1)",
        color: "hsl(230, 70%, 48%)",
      };
    case "backend-heavy":
      return {
        label: "Backend-Heavy",
        bg: "hsla(160, 60%, 42%, 0.1)",
        color: "hsl(160, 55%, 35%)",
      };
    case "balanced":
      return {
        label: "Balanced Full-Stack",
        bg: "hsla(270, 55%, 55%, 0.1)",
        color: "hsl(270, 55%, 45%)",
      };
    default:
      return {
        label: "Not enough data",
        bg: "var(--muted)",
        color: "var(--muted-foreground)",
      };
  }
}

function getLevelStyle(level: string) {
  switch (level) {
    case "Advanced":
      return styles.levelAdvanced;
    case "Intermediate":
      return styles.levelIntermediate;
    default:
      return styles.levelBeginner;
  }
}

function getLevelIcon(level: string): string {
  switch (level) {
    case "Advanced":
      return "🚀";
    case "Intermediate":
      return "⚡";
    default:
      return "🌱";
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

interface Props {
  insights: ProfileInsights | null;
  loading?: boolean;
}

export function ProfileInsightsPanel({ insights, loading }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Delay for bar animations
    const id = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(id);
  }, []);

  if (loading || !insights) {
    return (
      <div className={styles.insightsColumn}>
        {/* Skeleton cards */}
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={styles.sectionCard}
            style={{ minHeight: "6rem", opacity: 0.5 }}
          >
            <div
              style={{
                width: "40%",
                height: "0.75rem",
                borderRadius: "4px",
                background: "var(--muted)",
              }}
            />
            <div
              style={{
                width: "70%",
                height: "0.5rem",
                borderRadius: "4px",
                background: "var(--muted)",
                marginTop: "1rem",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  const contribution = getContributionLabel(insights.contributionSummary);
  const hasData = insights.projectStats.totalProjects > 0;

  return (
    <div className={styles.insightsColumn}>
      {/* ── Profile Strength ──────────────────── */}
      <div className={`${styles.sectionCard} ${styles.sectionCardNth1}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span className={`${styles.sectionIcon} ${styles.sectionIconGreen}`}>
              <Shield size={14} />
            </span>
            Profile Strength
          </div>
        </div>
        <div className={styles.strengthContainer}>
          <div className={styles.strengthHeader}>
            <span
              className={styles.strengthScore}
              style={{ color: getStrengthColor(insights.profileStrength) }}
            >
              {insights.profileStrength}
              <span className={styles.strengthOutOf}> / 100</span>
            </span>
            <span className={styles.strengthLabel}>
              {getStrengthLabel(insights.profileStrength)}
            </span>
          </div>
          <div className={styles.strengthTrack}>
            <div
              className={styles.strengthFill}
              style={{ width: mounted ? `${insights.profileStrength}%` : "0%" }}
            />
          </div>
          {insights.profileStrength < 80 && (
            <p className={styles.strengthHint}>
              Add more projects, skills, or experience to boost your score.
            </p>
          )}
        </div>
      </div>

      {/* ── Primary & Secondary Domain ────────── */}
      <div className={`${styles.sectionCard} ${styles.sectionCardNth2}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span className={`${styles.sectionIcon} ${styles.sectionIconBlue}`}>
              <Target size={14} />
            </span>
            Domain Expertise
          </div>
        </div>
        {insights.primaryDomain ? (
          <div className={styles.domainRow}>
            <div className={`${styles.domainBadge} ${styles.domainBadgePrimary}`}>
              <TrendingUp size={14} />
              {insights.primaryDomain}
            </div>
            {insights.secondaryDomain && (
              <div
                className={`${styles.domainBadge} ${styles.domainBadgeSecondary}`}
              >
                {insights.secondaryDomain}
              </div>
            )}
          </div>
        ) : (
          <p className={styles.emptyState}>
            Connect GitHub or add projects to detect domains.
          </p>
        )}
      </div>

      {/* ── Skill Distribution ────────────────── */}
      {Object.keys(insights.skillDistribution).length > 0 && (
        <div className={`${styles.sectionCard} ${styles.sectionCardNth3}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <span
                className={`${styles.sectionIcon} ${styles.sectionIconPurple}`}
              >
                <BarChart3 size={14} />
              </span>
              Skill Distribution
            </div>
          </div>
          <div className={styles.barChartList}>
            {Object.entries(insights.skillDistribution)
              .sort(([, a], [, b]) => b - a)
              .map(([domain, pct]) => (
                <div key={domain} className={styles.barItem}>
                  <div className={styles.barLabel}>
                    <span className={styles.barLabelName}>{domain}</span>
                    <span className={styles.barLabelValue}>{pct}%</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={`${styles.barFill} ${getBarColor(domain)}`}
                      style={{ width: mounted ? `${pct}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Top Technologies ──────────────────── */}
      {insights.topTechnologies.length > 0 && (
        <div className={`${styles.sectionCard} ${styles.sectionCardNth4}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <span
                className={`${styles.sectionIcon} ${styles.sectionIconOrange}`}
              >
                <Zap size={14} />
              </span>
              Top Technologies
            </div>
          </div>
          <div className={styles.topTechList}>
            {insights.topTechnologies.map((tech, idx) => (
              <div key={tech.name} className={styles.topTechItem}>
                <span className={styles.topTechRank}>#{idx + 1}</span>
                <span className={styles.topTechName}>{tech.name}</span>
                <span className={styles.topTechCount}>
                  {tech.count} {tech.count === 1 ? "project" : "projects"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Project Stats ─────────────────────── */}
      {hasData && (
        <div className={`${styles.sectionCard} ${styles.sectionCardNth5}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <span
                className={`${styles.sectionIcon} ${styles.sectionIconTeal}`}
              >
                <FolderKanban size={14} />
              </span>
              Project Stats
            </div>
          </div>
          <div className={styles.statGrid}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>
                {insights.projectStats.totalProjects}
              </div>
              <div className={styles.statLabel}>Total</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>
                {insights.projectStats.fullStackProjects}
              </div>
              <div className={styles.statLabel}>Full-Stack</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>
                {insights.projectStats.frontendProjects}
              </div>
              <div className={styles.statLabel}>Frontend</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>
                {insights.projectStats.backendProjects}
              </div>
              <div className={styles.statLabel}>Backend</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>
                {insights.projectStats.mobileProjects}
              </div>
              <div className={styles.statLabel}>Mobile</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>
                {insights.projectStats.mlProjects}
              </div>
              <div className={styles.statLabel}>ML/AI</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Contribution Summary ──────────────── */}
      {insights.contributionSummary !== "unknown" && (
        <div className={`${styles.sectionCard} ${styles.sectionCardNth6}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <span
                className={`${styles.sectionIcon} ${styles.sectionIconGreen}`}
              >
                <GitBranch size={14} />
              </span>
              Contribution Focus
            </div>
          </div>
          <div
            className={styles.contributionBadge}
            style={{
              background: contribution.bg,
              color: contribution.color,
            }}
          >
            <GitBranch size={14} />
            {contribution.label}
          </div>
        </div>
      )}

      {/* ── Experience Level ──────────────────── */}
      <div className={`${styles.sectionCard} ${styles.sectionCardNth6}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span className={`${styles.sectionIcon} ${styles.sectionIconPurple}`}>
              <Trophy size={14} />
            </span>
            Experience Level
          </div>
        </div>
        <div
          className={`${styles.levelBadge} ${getLevelStyle(insights.experienceLevel)}`}
        >
          <span>{getLevelIcon(insights.experienceLevel)}</span>
          {insights.experienceLevel}
        </div>
      </div>
    </div>
  );
}
