/**
 * templates.ts
 *
 * 60 high-quality, purpose-driven resume bullet templates.
 *
 * Design rules:
 *   1. Every template MUST reference {feature}, {module}, or {commitNarrative}
 *      — no purely generic text is allowed
 *   2. Every template follows: Action + Feature/Module + Tech + Purpose/Impact
 *   3. No two templates share the same (verb + structure) pair
 *   4. Each template has a `slot` for diversity enforcement
 *
 * Placeholder tokens:
 *   {projectName}       — repo name
 *   {primaryTech}       — techStack[0]
 *   {secondaryTech}     — techStack[1]
 *   {techList}          — "React, Node.js, and PostgreSQL"
 *   {techPair}          — "React and Node.js"
 *   {domain}            — Frontend | Backend | ML | etc. (fallback: "software")
 *   {module}            — single module (expanded per module, up to 3)
 *   {area}              — same pool as module
 *   {moduleList}        — all modules joined
 *   {feature}           — single feature from insight (expanded per feature, up to 3)
 *   {commitNarrative}   — verb-phrase from commit analysis
 *   {architectureStyle} — inferred arch style (MVC, service-oriented, etc.)
 *   {collaborators}     — contributor count
 *   {complexity}        — simple | moderate | complex
 *   {projectType}       — solo | collaborative
 *
 * requiredVars: if ANY listed var resolves to "" → template is skipped.
 */

export type ProjectTypeFilter = "solo" | "collaborative" | "both";
export type TemplateCategory = "feature_deep" | "architecture" | "impact" | "contribution" | "integration";
export type BulletSlot = "feature" | "architecture" | "impact" | "contribution" | "flexible";

export interface BulletTemplate {
  id: string;
  text: string;
  category: TemplateCategory;
  slot: BulletSlot;
  typeFilter: ProjectTypeFilter;
  preferredDomain?: string;
  requiredVars: string[];
  actionVerb: string;
}

export const TEMPLATES: BulletTemplate[] = [

  // ═══════════════════════════════════════════════════════════════
  // FEATURE DEEP (F01–F20) — highlights specific detected features
  // ═══════════════════════════════════════════════════════════════

  {
    id: "F01", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Engineered",
    requiredVars: ["feature", "primaryTech"],
    text: "Engineered {feature} for {projectName} using {primaryTech}, enabling secure and scalable operations",
  },
  {
    id: "F02", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Developed",
    requiredVars: ["feature", "techPair"],
    text: "Developed {feature} in {projectName} with {techPair} to streamline core application workflows",
  },
  {
    id: "F03", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Implemented",
    requiredVars: ["feature", "primaryTech"],
    text: "Implemented {feature} within {projectName} using {primaryTech} to enhance platform functionality",
  },
  {
    id: "F04", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Built",
    requiredVars: ["feature", "techList"],
    text: "Built {feature} for {projectName} leveraging {techList} for production-grade reliability",
  },
  {
    id: "F05", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Designed",
    requiredVars: ["feature", "primaryTech"],
    text: "Designed and shipped {feature} in {projectName} with {primaryTech}, improving user-facing capabilities",
  },
  {
    id: "F06", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Constructed",
    requiredVars: ["feature", "techPair"],
    text: "Constructed {feature} end-to-end in {projectName} using {techPair}",
  },
  {
    id: "F07", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Delivered",
    requiredVars: ["feature", "primaryTech"],
    text: "Delivered {feature} as a core capability of {projectName}, powered by {primaryTech}",
  },
  {
    id: "F08", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Architected",
    requiredVars: ["feature", "primaryTech"],
    text: "Architected {feature} for {projectName} using {primaryTech} with clean separation of concerns",
  },
  {
    id: "F09", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Integrated",
    requiredVars: ["feature", "techPair"],
    text: "Integrated {feature} into {projectName} using {techPair} to extend application scope",
  },
  {
    id: "F10", category: "feature_deep", slot: "feature", typeFilter: "solo",
    actionVerb: "Created",
    requiredVars: ["feature", "primaryTech"],
    text: "Created {feature} from scratch for {projectName} using {primaryTech} with full test coverage",
  },
  {
    id: "F11", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Developed",
    requiredVars: ["feature", "module", "primaryTech"],
    text: "Developed {feature} within the {module} layer of {projectName} using {primaryTech}",
  },
  {
    id: "F12", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Implemented",
    requiredVars: ["feature", "module"],
    text: "Implemented {feature} integrated with {module} logic to power {projectName}'s core experience",
  },
  {
    id: "F13", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Engineered",
    requiredVars: ["feature", "secondaryTech"],
    text: "Engineered {feature} using {secondaryTech} to enable data-driven functionality in {projectName}",
  },
  {
    id: "F14", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Shipped",
    requiredVars: ["feature", "primaryTech"],
    text: "Shipped {feature} for {projectName} using {primaryTech} with robust error handling and validation",
  },
  {
    id: "F15", category: "feature_deep", slot: "feature", typeFilter: "both",
    actionVerb: "Built",
    requiredVars: ["feature"],
    text: "Built {feature} for {projectName}, incorporating industry-standard patterns for maintainability",
  },

  // ═══════════════════════════════════════════════════════════════
  // ARCHITECTURE (A01–A15) — design decisions and system structure
  // ═══════════════════════════════════════════════════════════════

  {
    id: "A01", category: "architecture", slot: "architecture", typeFilter: "solo",
    actionVerb: "Architected",
    requiredVars: ["module", "primaryTech"],
    text: "Architected {projectName}'s {module} layer with {primaryTech} using a clean {architectureStyle} design pattern",
  },
  {
    id: "A02", category: "architecture", slot: "architecture", typeFilter: "solo",
    actionVerb: "Designed",
    requiredVars: ["moduleList", "techPair"],
    text: "Designed the {moduleList} architecture for {projectName} using {techPair} with clear separation of concerns",
  },
  {
    id: "A03", category: "architecture", slot: "architecture", typeFilter: "solo",
    actionVerb: "Structured",
    requiredVars: ["module", "primaryTech"],
    text: "Structured {projectName} as a {architectureStyle} application with {module} and {area} layers in {primaryTech}",
  },
  {
    id: "A04", category: "architecture", slot: "architecture", typeFilter: "solo",
    actionVerb: "Planned",
    requiredVars: ["moduleList", "primaryTech"],
    text: "Planned and implemented {projectName}'s technical architecture spanning {moduleList} using {primaryTech}",
  },
  {
    id: "A05", category: "architecture", slot: "architecture", typeFilter: "both",
    actionVerb: "Established",
    requiredVars: ["module", "primaryTech"],
    text: "Established scalable {module} abstractions for {projectName} in {primaryTech} to support future extensibility",
  },
  {
    id: "A06", category: "architecture", slot: "architecture", typeFilter: "solo",
    actionVerb: "Designed",
    requiredVars: ["feature", "primaryTech"],
    text: "Designed database schema and data access patterns for {feature} in {projectName} using {primaryTech}",
  },
  {
    id: "A07", category: "architecture", slot: "architecture", typeFilter: "both",
    actionVerb: "Defined",
    requiredVars: ["module", "feature"],
    text: "Defined API contracts and {module} interfaces for {feature} in {projectName}",
  },
  {
    id: "A08", category: "architecture", slot: "architecture", typeFilter: "solo",
    actionVerb: "Engineered",
    requiredVars: ["moduleList", "techList"],
    text: "Engineered clean separation across {projectName}'s {moduleList} using {techList}",
  },
  {
    id: "A09", category: "architecture", slot: "architecture", typeFilter: "solo",
    actionVerb: "Structured",
    requiredVars: ["feature", "techPair"],
    text: "Structured {feature} with event-driven patterns in {projectName} using {techPair}",
  },
  {
    id: "A10", category: "architecture", slot: "architecture", typeFilter: "both",
    actionVerb: "Architected",
    requiredVars: ["feature", "module"],
    text: "Architected {feature} pipeline integrated with the {module} system in {projectName}",
  },

  // ═══════════════════════════════════════════════════════════════
  // ARCHITECTURE — domain-specific (A11–A15)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "A11", category: "architecture", slot: "architecture", typeFilter: "both",
    preferredDomain: "Frontend",
    actionVerb: "Designed",
    requiredVars: ["module", "primaryTech"],
    text: "Designed reusable {module} component library for {projectName} using {primaryTech} with consistent theming",
  },
  {
    id: "A12", category: "architecture", slot: "architecture", typeFilter: "both",
    preferredDomain: "Backend",
    actionVerb: "Architected",
    requiredVars: ["module", "primaryTech"],
    text: "Architected RESTful {module} endpoints for {projectName} using {primaryTech} with middleware validation",
  },
  {
    id: "A13", category: "architecture", slot: "architecture", typeFilter: "both",
    preferredDomain: "Backend",
    actionVerb: "Designed",
    requiredVars: ["feature", "primaryTech"],
    text: "Designed {feature} data model and query optimization layer for {projectName} in {primaryTech}",
  },
  {
    id: "A14", category: "architecture", slot: "architecture", typeFilter: "both",
    preferredDomain: "ML / AI",
    actionVerb: "Engineered",
    requiredVars: ["feature", "primaryTech"],
    text: "Engineered {feature} training and inference pipeline for {projectName} using {primaryTech}",
  },
  {
    id: "A15", category: "architecture", slot: "architecture", typeFilter: "both",
    preferredDomain: "Mobile",
    actionVerb: "Structured",
    requiredVars: ["module", "primaryTech"],
    text: "Structured native {module} navigation and state management for {projectName} using {primaryTech}",
  },

  // ═══════════════════════════════════════════════════════════════
  // IMPACT (I01–I15) — outcomes, optimization, improvements
  // ═══════════════════════════════════════════════════════════════

  {
    id: "I01", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Optimized",
    requiredVars: ["module", "primaryTech"],
    text: "Optimized {module} performance in {projectName} using {primaryTech} patterns, reducing response latency",
  },
  {
    id: "I02", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Streamlined",
    requiredVars: ["feature", "primaryTech"],
    text: "Streamlined {feature} workflow in {projectName} with {primaryTech}, cutting code complexity significantly",
  },
  {
    id: "I03", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Automated",
    requiredVars: ["module", "primaryTech"],
    text: "Automated {module} validation and error handling for {projectName} using {primaryTech}",
  },
  {
    id: "I04", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Secured",
    requiredVars: ["feature", "primaryTech"],
    text: "Secured {projectName} by hardening {feature} with {primaryTech} and industry-standard practices",
  },
  {
    id: "I05", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Enhanced",
    requiredVars: ["module", "feature"],
    text: "Enhanced {projectName} reliability by adding comprehensive error recovery across {module} and {feature}",
  },
  {
    id: "I06", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Refactored",
    requiredVars: ["module", "primaryTech"],
    text: "Refactored {module} logic in {projectName} using {primaryTech} to improve code reuse and testability",
  },
  {
    id: "I07", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Scaled",
    requiredVars: ["feature", "primaryTech"],
    text: "Scaled {feature} in {projectName} using {primaryTech} to handle increased concurrent load",
  },
  {
    id: "I08", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Improved",
    requiredVars: ["module"],
    text: "Improved {module} maintainability in {projectName} through modular refactoring and documentation",
  },
  {
    id: "I09", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Resolved",
    requiredVars: ["module", "primaryTech"],
    text: "Resolved critical {module} bottlenecks in {projectName} through targeted {primaryTech} optimization",
  },
  {
    id: "I10", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Extended",
    requiredVars: ["commitNarrative"],
    text: "Extended {projectName} with {commitNarrative}, expanding the core feature set",
  },
  {
    id: "I11", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Hardened",
    requiredVars: ["feature", "module"],
    text: "Hardened {projectName} by implementing input validation across {feature} and {module} boundaries",
  },
  {
    id: "I12", category: "impact", slot: "impact", typeFilter: "both",
    actionVerb: "Reduced",
    requiredVars: ["module", "primaryTech"],
    text: "Reduced technical debt in {projectName} by restructuring {module} layer with clean {primaryTech} patterns",
  },
  {
    id: "I13", category: "impact", slot: "impact", typeFilter: "both",
    preferredDomain: "DevOps",
    actionVerb: "Containerized",
    requiredVars: ["module", "primaryTech"],
    text: "Containerized {projectName} with Docker, configuring {module} deployment using {primaryTech}",
  },

  // ═══════════════════════════════════════════════════════════════
  // CONTRIBUTION (CO1–CO10) — collaborative work
  // ═══════════════════════════════════════════════════════════════

  {
    id: "CO1", category: "contribution", slot: "contribution", typeFilter: "collaborative",
    actionVerb: "Contributed",
    requiredVars: ["feature", "collaborators"],
    text: "Contributed {feature} to {projectName}, collaborating with {collaborators} engineers on a shared codebase",
  },
  {
    id: "CO2", category: "contribution", slot: "contribution", typeFilter: "collaborative",
    actionVerb: "Owned",
    requiredVars: ["module", "primaryTech"],
    text: "Owned {module} implementation in {projectName} using {primaryTech} within a multi-contributor team",
  },
  {
    id: "CO3", category: "contribution", slot: "contribution", typeFilter: "collaborative",
    actionVerb: "Led",
    requiredVars: ["module", "primaryTech"],
    text: "Led development of the {module} component in {projectName} using {primaryTech}",
  },
  {
    id: "CO4", category: "contribution", slot: "contribution", typeFilter: "collaborative",
    actionVerb: "Drove",
    requiredVars: ["feature", "collaborators"],
    text: "Drove {feature} development in {projectName} as part of a {collaborators}-person engineering team",
  },
  {
    id: "CO5", category: "contribution", slot: "contribution", typeFilter: "collaborative",
    actionVerb: "Delivered",
    requiredVars: ["commitNarrative", "module"],
    text: "Delivered {commitNarrative} and {module} enhancements to the {projectName} codebase",
  },
  {
    id: "CO6", category: "contribution", slot: "contribution", typeFilter: "collaborative",
    actionVerb: "Authored",
    requiredVars: ["feature", "primaryTech"],
    text: "Authored {feature} logic in {projectName} using {primaryTech}, improving shared codebase quality",
  },
  {
    id: "CO7", category: "contribution", slot: "contribution", typeFilter: "collaborative",
    actionVerb: "Implemented",
    requiredVars: ["feature", "module"],
    text: "Implemented {feature} and {module} functionality in {projectName}, coordinating with team through code reviews",
  },

  // ═══════════════════════════════════════════════════════════════
  // INTEGRATION (IN1–IN5) — multi-tech, multi-module sentences
  // ═══════════════════════════════════════════════════════════════

  {
    id: "IN1", category: "integration", slot: "flexible", typeFilter: "both",
    actionVerb: "Integrated",
    requiredVars: ["feature", "module", "techPair"],
    text: "Integrated {feature} with {module} layer in {projectName} using {techPair} for seamless data flow",
  },
  {
    id: "IN2", category: "integration", slot: "flexible", typeFilter: "both",
    actionVerb: "Developed",
    requiredVars: ["feature", "module", "primaryTech"],
    text: "Developed end-to-end {feature} spanning {module} and API layers in {projectName} with {primaryTech}",
  },
  {
    id: "IN3", category: "integration", slot: "flexible", typeFilter: "both",
    actionVerb: "Connected",
    requiredVars: ["feature", "primaryTech", "secondaryTech"],
    text: "Connected {feature} across {primaryTech} frontend and {secondaryTech} backend in {projectName}",
  },
  {
    id: "IN4", category: "integration", slot: "flexible", typeFilter: "both",
    actionVerb: "Orchestrated",
    requiredVars: ["module", "feature", "primaryTech"],
    text: "Orchestrated {module} and {feature} integration in {projectName} using {primaryTech}",
  },
  {
    id: "IN5", category: "integration", slot: "flexible", typeFilter: "both",
    actionVerb: "Unified",
    requiredVars: ["feature", "techPair"],
    text: "Unified {feature} data pipeline across services in {projectName} using {techPair}",
  },
];