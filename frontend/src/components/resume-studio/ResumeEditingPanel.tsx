"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import type { ResumeData } from "@/components/templates/resume/Template1";
import type { ResumeTemplateId } from "@/lib/templates/template-registry";
import { TemplateSwitcher } from "./TemplateSwitcher";
import {
  ChevronDown,
  AlignLeft,
  Zap,
  FolderKanban,
  Briefcase,
  Plus,
  X,
  Palette,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────── */

interface ResumeEditingPanelProps {
  resumeData: ResumeData;
  templateId: ResumeTemplateId;
  onDataChange: (data: ResumeData) => void;
  onTemplateChange: (id: ResumeTemplateId) => void;
}

/* ── Auto-resize textarea hook ──────────────────────────────── */

function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [value]);
  return ref;
}

/* ── Bullet Input ───────────────────────────────────────────── */

function BulletInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useAutoResize(value);
  return (
    <div className="rs-bullet-row">
      <span className="rs-bullet-marker" />
      <textarea
        ref={ref}
        className="rs-bullet-input"
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ── Collapsible Section ────────────────────────────────────── */

function Section({
  icon,
  iconClass,
  title,
  count,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  count?: number | string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rs-section">
      <button
        type="button"
        className="rs-section-header"
        onClick={() => setOpen(!open)}
      >
        <span className="rs-section-header-left">
          <span className={`rs-section-icon ${iconClass}`}>{icon}</span>
          <span className="rs-section-title">{title}</span>
          {count !== undefined && (
            <span className="rs-section-count">{count}</span>
          )}
        </span>
        <ChevronDown size={15} className="rs-section-chevron" data-open={open} />
      </button>
      {open && <div className="rs-section-body">{children}</div>}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */

export function ResumeEditingPanel({
  resumeData,
  templateId,
  onDataChange,
  onTemplateChange,
}: ResumeEditingPanelProps) {
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const newSkillRef = useRef<HTMLInputElement>(null);

  /* ── Helpers ────────────────────────────────────────────────── */

  const update = useCallback(
    (patch: Partial<ResumeData>) => {
      onDataChange({ ...resumeData, ...patch });
    },
    [resumeData, onDataChange],
  );

  const updateProject = useCallback(
    (idx: number, patch: Partial<ResumeData["projects"][number]>) => {
      const projects = resumeData.projects.map((p, i) =>
        i === idx ? { ...p, ...patch } : p,
      );
      update({ projects });
    },
    [resumeData.projects, update],
  );

  const updateBullet = useCallback(
    (projIdx: number, bulletIdx: number, value: string) => {
      const bullets = [...resumeData.projects[projIdx].finalBullets];
      bullets[bulletIdx] = value;
      updateProject(projIdx, { finalBullets: bullets });
    },
    [resumeData.projects, updateProject],
  );

  const addBullet = useCallback(
    (projIdx: number) => {
      const bullets = [...resumeData.projects[projIdx].finalBullets, ""];
      updateProject(projIdx, { finalBullets: bullets });
    },
    [resumeData.projects, updateProject],
  );

  const updateExperience = useCallback(
    (idx: number, patch: Partial<ResumeData["experiences"][number]>) => {
      const experiences = resumeData.experiences.map((e, i) =>
        i === idx ? { ...e, ...patch } : e,
      );
      update({ experiences });
    },
    [resumeData.experiences, update],
  );

  const removeSkill = useCallback(
    (idx: number) => {
      const skills = resumeData.skills.filter((_, i) => i !== idx);
      update({ skills });
    },
    [resumeData.skills, update],
  );

  const commitNewSkill = useCallback(() => {
    const trimmed = newSkill.trim();
    if (trimmed) {
      update({ skills: [...resumeData.skills, { name: trimmed }] });
    }
    setNewSkill("");
    setAddingSkill(false);
  }, [newSkill, resumeData.skills, update]);

  // Focus new skill input when adding
  useEffect(() => {
    if (addingSkill && newSkillRef.current) {
      newSkillRef.current.focus();
    }
  }, [addingSkill]);

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="rs-edit-pane">
      <div className="rs-edit-pane-header">
        <h2>Edit Resume</h2>
      </div>

      {/* ── Template Switch ── */}
      <Section
        icon={<Palette size={13} />}
        iconClass="summary"
        title="Template"
        count={templateId.toUpperCase()}
      >
        <TemplateSwitcher selectedId={templateId} onSelect={onTemplateChange} />
      </Section>

      {/* ── Summary ── */}
      <Section
        icon={<AlignLeft size={13} />}
        iconClass="summary"
        title="Summary"
        defaultOpen
      >
        <textarea
          className="rs-textarea"
          value={resumeData.summary ?? ""}
          onChange={(e) => update({ summary: e.target.value })}
          placeholder="Write a professional summary…"
        />
        <div className="rs-char-count">
          {(resumeData.summary ?? "").length} characters
        </div>
      </Section>

      {/* ── Skills ── */}
      <Section
        icon={<Zap size={13} />}
        iconClass="skills"
        title="Skills"
        count={resumeData.skills.length}
        defaultOpen
      >
        <div className="rs-skills-grid">
          {resumeData.skills.map((skill, idx) => (
            <span key={`${skill.name}-${idx}`} className="rs-skill-tag">
              {skill.name}
              <button
                type="button"
                className="rs-skill-remove"
                onClick={() => removeSkill(idx)}
                aria-label={`Remove ${skill.name}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {addingSkill ? (
            <input
              ref={newSkillRef}
              type="text"
              className="rs-input"
              style={{ width: 120, padding: "0.25rem 0.5rem", fontSize: "0.725rem" }}
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onBlur={commitNewSkill}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNewSkill();
                if (e.key === "Escape") { setNewSkill(""); setAddingSkill(false); }
              }}
              placeholder="Skill name…"
            />
          ) : (
            <button
              type="button"
              className="rs-skill-add-btn"
              onClick={() => setAddingSkill(true)}
            >
              <Plus size={11} />
              Add
            </button>
          )}
        </div>
      </Section>

      {/* ── Projects ── */}
      <Section
        icon={<FolderKanban size={13} />}
        iconClass="projects"
        title="Projects"
        count={resumeData.projects.length}
        defaultOpen
      >
        {resumeData.projects.map((proj, projIdx) => (
          <div key={proj.name} className="rs-item">
            <div className="rs-item-header">
              <span className="rs-item-name">{proj.name}</span>
              {proj.techStack.length > 0 && (
                <span className="rs-item-meta">
                  {proj.techStack.slice(0, 3).join(", ")}
                  {proj.techStack.length > 3 && ` +${proj.techStack.length - 3}`}
                </span>
              )}
            </div>
            {proj.finalBullets.map((bullet, bIdx) => (
              <BulletInput
                key={bIdx}
                value={bullet}
                onChange={(v) => updateBullet(projIdx, bIdx, v)}
              />
            ))}
            <button
              type="button"
              className="rs-add-bullet-btn"
              onClick={() => addBullet(projIdx)}
            >
              <Plus size={11} />
              Add bullet
            </button>

            {/* Impact & Contribution — collapsible */}
            <details className="mt-2 border border-border/50 rounded-lg overflow-hidden">
              <summary
                className="px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none"
                style={{ listStyle: "none" }}
              >
                📊 Impact & Contribution
              </summary>
              <div className="px-3 py-2 space-y-2 border-t border-border/50 bg-muted/20">
                <div>
                  <label className="text-[0.65rem] font-medium text-muted-foreground">
                    Contribution Area
                  </label>
                  <select
                    className="rs-input mt-0.5"
                    value={(proj as any).contributionArea ?? ""}
                    onChange={(e) =>
                      updateProject(projIdx, {
                        ...proj,
                        contributionArea: e.target.value || null,
                      } as any)
                    }
                  >
                    <option value="">— Select —</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Backend">Backend</option>
                    <option value="API">API</option>
                    <option value="Database">Database</option>
                    <option value="Full Stack">Full Stack</option>
                  </select>
                </div>
                <div>
                  <label className="text-[0.65rem] font-medium text-muted-foreground">
                    Extra Notes
                  </label>
                  <textarea
                    className="rs-textarea mt-0.5"
                    style={{ minHeight: "2.5rem", fontSize: "0.75rem" }}
                    placeholder="Any special context about this project..."
                    value={(proj as any).quizExtraNotes ?? ""}
                    onChange={(e) =>
                      updateProject(projIdx, {
                        ...proj,
                        quizExtraNotes: e.target.value || null,
                      } as any)
                    }
                  />
                </div>
              </div>
            </details>
          </div>
        ))}
      </Section>

      {/* ── Experience ── */}
      <Section
        icon={<Briefcase size={13} />}
        iconClass="experience"
        title="Experience"
        count={resumeData.experiences.length}
      >
        {resumeData.experiences.map((exp, idx) => (
          <div key={`${exp.company}-${exp.role}`} className="rs-item">
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
                  Role
                </label>
                <input
                  type="text"
                  className="rs-input"
                  value={exp.role}
                  onChange={(e) => updateExperience(idx, { role: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
                  Company
                </label>
                <input
                  type="text"
                  className="rs-input"
                  value={exp.company}
                  onChange={(e) => updateExperience(idx, { company: e.target.value })}
                />
              </div>
            </div>
            <label style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
              Description
            </label>
            <textarea
              className="rs-textarea"
              style={{ minHeight: "3rem" }}
              value={exp.description ?? ""}
              onChange={(e) => updateExperience(idx, { description: e.target.value })}
              placeholder="Describe responsibilities…"
            />
          </div>
        ))}
      </Section>
    </div>
  );
}
