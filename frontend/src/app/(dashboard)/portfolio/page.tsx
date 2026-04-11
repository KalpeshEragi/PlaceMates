"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Loader2, Save, Eye, Upload, Plus, Trash2, ExternalLink, Palette, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  onboardingApi,
  type UserPreviewPayload,
} from "@/lib/api/onboarding-api";
import type { PortfolioData } from "@/components/templates/portfolio/Template1";
import {
  PORTFOLIO_TEMPLATES,
  portfolioComponentForId,
} from "@/lib/templates/template-registry";

// ── Types ────────────────────────────────────────────────────

type ProjectEdit = {
  id: string;
  name: string;
  techStack: string[];
  descriptionSeed: string;
  bulletsText: string;
  intent: string;
  imageUrl: string | null;
  repoUrl: string;
};

// ── Helpers ──────────────────────────────────────────────────

function buildPortfolioView(
  base: UserPreviewPayload["portfolioData"],
  summary: string,
  skills: string[],
  projects: ProjectEdit[],
  templateId: string,
  profileImageUrl: string | null,
): PortfolioData {
  return {
    name: base.name,
    role: base.role,
    summary,
    profileImageUrl,
    skills,
    projects: projects.map((p) => {
      const lines = p.bulletsText.split("\n").map(l => l.trim()).filter(Boolean);
      return {
        name: p.name,
        description: lines[0] ?? p.descriptionSeed,
        techStack: p.techStack,
        githubUrl: p.repoUrl || undefined,
        repoUrl: p.repoUrl || undefined,
        imageUrl: p.imageUrl,
        finalBullets: lines,
      };
    }),
    experience: base.experience,
    education: base.education,
    awards: base.awards,
  };
}

// ── Component ────────────────────────────────────────────────

export default function PortfolioPage() {
  const [base, setBase] = useState<UserPreviewPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [projects, setProjects] = useState<ProjectEdit[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("p1");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingProject, setUploadingProject] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      const data = await onboardingApi.getPreviewData();
      setBase(data);
      setSummary(data.portfolioData.summary);
      setSkillsText(data.portfolioData.skills.join("\n"));
      setSelectedTemplate(data.portfolioTemplateId ?? "p1");
      setProfileImageUrl(data.meta.profileImageUrl ?? null);
      setProjects(
        data.portfolioData.projects
          .filter((p): p is typeof p & { id: string } => Boolean(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name,
            techStack: p.techStack ?? [],
            descriptionSeed: p.description,
            bulletsText: (p.finalBullets ?? []).join("\n"),
            intent: (p.projectIntent ?? "").trim(),
            imageUrl: p.imageUrl ?? null,
            repoUrl: p.repoUrl ?? "",
          })),
      );
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message || "Failed to load.");
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const skillList = useMemo(
    () => skillsText.split("\n").map(s => s.trim()).filter(Boolean),
    [skillsText],
  );

  const portfolioData = useMemo(() => {
    if (!base) return null;
    return buildPortfolioView(base.portfolioData, summary, skillList, projects, selectedTemplate, profileImageUrl);
  }, [base, summary, skillList, projects, selectedTemplate, profileImageUrl]);

  const PortfolioComponent = portfolioComponentForId(selectedTemplate);

  // ── Handlers ──────────────────────────────────────────────

  const handleSave = async () => {
    if (!base) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await onboardingApi.finalizeOutput({
        portfolioTemplate: selectedTemplate,
        resumeTemplate: base.resumeTemplateId ?? "r1",
        summary: summary.trim(),
        skills: skillList,
        projects: projects.map(p => ({
          id: p.id,
          finalBullets: p.bulletsText.split("\n").map(l => l.trim()).filter(Boolean),
          projectIntent: p.intent.trim() || null,
        })),
      });
      setSaveMsg("Saved successfully!");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (e) {
      setSaveMsg((e as Error).message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleProfileImageUpload = async (file: File) => {
    setUploadingProfile(true);
    try {
      const res = await onboardingApi.uploadProfileImage(file);
      setProfileImageUrl(res.imageUrl);
    } catch (e) {
      console.error("Profile image upload failed:", e);
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleProjectImageUpload = async (projectId: string, file: File) => {
    setUploadingProject(projectId);
    try {
      const res = await onboardingApi.uploadProjectImage(projectId, file);
      setProjects(prev =>
        prev.map(p => p.id === projectId ? { ...p, imageUrl: res.imageUrl } : p),
      );
    } catch (e) {
      console.error("Project image upload failed:", e);
    } finally {
      setUploadingProject(null);
    }
  };

  // ── Render ────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[50vh]">
        <p className="text-sm text-red-600">{loadError}</p>
        <Button variant="outline" onClick={reload}>Retry</Button>
      </div>
    );
  }

  if (!base || !portfolioData) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── LEFT: Editor Panel ── */}
      <div className="w-full lg:w-[440px] xl:w-[480px] border-r bg-background overflow-y-auto shrink-0">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                Portfolio Studio
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Edit your portfolio with live preview</p>
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
          </div>

          {saveMsg && (
            <div className={`text-xs px-3 py-2 rounded-lg ${saveMsg.includes("success") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
              {saveMsg}
            </div>
          )}

          {/* Template Selector */}
          <section>
            <label className="text-sm font-semibold mb-3 block">Template</label>
            <div className="grid grid-cols-3 gap-3">
              {PORTFOLIO_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`relative rounded-xl border-2 p-1 transition-all duration-200 ${
                    selectedTemplate === t.id
                      ? "border-primary shadow-md ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="h-16 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <span className="text-[10px] text-gray-400 font-mono">{t.id.toUpperCase()}</span>
                  </div>
                  <p className="text-[10px] text-center mt-1 font-medium truncate">{t.label}</p>
                  {selectedTemplate === t.id && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-white">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Profile Image */}
          <section>
            <label className="text-sm font-semibold mb-2 block">Profile Image (optional)</label>
            <input
              ref={profileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleProfileImageUpload(file);
              }}
            />
            <div
              className="border-2 border-dashed rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => profileInputRef.current?.click()}
            >
              {profileImageUrl ? (
                <img src={profileImageUrl} alt="Profile" className="w-14 h-14 rounded-full object-cover border-2 border-primary/30" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{profileImageUrl ? "Change image" : "Upload profile image"}</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP · Max 5MB</p>
              </div>
              {uploadingProfile && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
          </section>

          {/* Summary */}
          <section>
            <label className="text-sm font-semibold mb-2 block">Professional Summary</label>
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </section>

          {/* Skills */}
          <section>
            <label className="text-sm font-semibold mb-2 block">Skills (one per line)</label>
            <textarea
              className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder={"React\nNode.js\nPython"}
            />
          </section>

          {/* Projects */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold">Projects ({projects.length})</label>
            </div>
            <div className="space-y-4">
              {projects.map((p, idx) => (
                <ProjectEditor
                  key={p.id}
                  project={p}
                  index={idx}
                  uploading={uploadingProject === p.id}
                  onUpdate={(updated) => setProjects(prev => prev.map((x, i) => i === idx ? updated : x))}
                  onUploadImage={(file) => handleProjectImageUpload(p.id, file)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── RIGHT: Live Preview ── */}
      <div className="flex-1 bg-gray-100 overflow-y-auto relative">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Live Preview</span>
            <span className="text-xs text-muted-foreground">· {PORTFOLIO_TEMPLATES.find(t => t.id === selectedTemplate)?.label}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const { portfolioUrl } = await onboardingApi.getPortfolioUrl();
                window.open(portfolioUrl, "_blank");
              } catch { /* ignore */ }
            }}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Open Public
          </Button>
        </div>
        <div className="p-4">
          <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-200 bg-[#282c33]">
            <div className="transform scale-[0.55] origin-top-left w-[182%] pointer-events-none">
              <PortfolioComponent data={portfolioData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Project Editor Sub-component ────────────────────────────

function ProjectEditor({
  project,
  index,
  uploading,
  onUpdate,
  onUploadImage,
}: {
  project: ProjectEdit;
  index: number;
  uploading: boolean;
  onUpdate: (p: ProjectEdit) => void;
  onUploadImage: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm truncate flex-1">{project.name}</h4>
        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">#{index + 1}</span>
      </div>

      {/* Project Image */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadImage(file);
        }}
      />
      <div
        className="border border-dashed rounded-lg h-24 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden relative"
        onClick={() => fileRef.current?.click()}
      >
        {project.imageUrl ? (
          <img src={project.imageUrl} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <Upload className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground">Add image (optional)</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* GitHub URL */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">GitHub URL</label>
        <input
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs mt-1"
          value={project.repoUrl}
          onChange={(e) => onUpdate({ ...project, repoUrl: e.target.value })}
          placeholder="https://github.com/..."
        />
      </div>

      {/* Tech Stack */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tech Stack (comma-separated)</label>
        <input
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs mt-1"
          value={project.techStack.join(", ")}
          onChange={(e) => onUpdate({ ...project, techStack: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
        />
      </div>

      {/* Bullets */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Description / Bullets (one per line)</label>
        <textarea
          className="w-full min-h-[70px] rounded-md border border-input bg-background px-2.5 py-1.5 text-xs mt-1 resize-none"
          value={project.bulletsText}
          onChange={(e) => onUpdate({ ...project, bulletsText: e.target.value })}
        />
      </div>
    </div>
  );
}
