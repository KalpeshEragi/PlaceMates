"use client";

/**
 * ProfileEditor.tsx
 *
 * Editable left panel — card-based sections for:
 *   - Basic Info (name, email read-only, summary)
 *   - Skills (tag chips with add/remove)
 *   - Experience (inline edit, add, delete)
 *   - Education (inline edit, add, delete)
 *   - Projects (read-only cards)
 */

import { useState, useCallback } from "react";
import {
  User,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  FileText,
  Briefcase,
  GraduationCap,
  Code2,
  FolderGit2,
  Github,
  Linkedin,
} from "lucide-react";
import type {
  ProfileData,
  ExperienceEntry,
  EducationEntry,
  UpdateProfileBody,
} from "@/lib/api/profile-api";
import styles from "./profile.module.css";

// ─────────────────────────────────────────────
// Domain color helpers
// ─────────────────────────────────────────────

const DOMAIN_BG: Record<string, string> = {
  Frontend: "hsla(230, 70%, 96%, 1)",
  Backend: "hsla(160, 45%, 94%, 1)",
  "ML/AI": "hsla(270, 50%, 96%, 1)",
  ML: "hsla(270, 50%, 96%, 1)",
  Mobile: "hsla(30, 80%, 96%, 1)",
  DevOps: "hsla(180, 50%, 94%, 1)",
};

const DOMAIN_COLOR: Record<string, string> = {
  Frontend: "hsl(230, 60%, 48%)",
  Backend: "hsl(160, 55%, 35%)",
  "ML/AI": "hsl(270, 50%, 50%)",
  ML: "hsl(270, 50%, 50%)",
  Mobile: "hsl(30, 70%, 45%)",
  DevOps: "hsl(180, 45%, 35%)",
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

interface Props {
  profile: ProfileData;
  onSave: (body: UpdateProfileBody) => Promise<void>;
  saving: boolean;
}

export function ProfileEditor({ profile, onSave, saving }: Props) {
  // ── Section edit states ──
  const [editingInfo, setEditingInfo] = useState(false);
  const [editingSkills, setEditingSkills] = useState(false);
  const [editingExp, setEditingExp] = useState(false);
  const [editingEdu, setEditingEdu] = useState(false);

  // ── Editable copies ──
  const [name, setName] = useState(profile.name ?? "");
  const [summary, setSummary] = useState(profile.summary ?? "");
  const [skillNames, setSkillNames] = useState(
    profile.skills.map((s) => s.name),
  );
  const [newSkill, setNewSkill] = useState("");
  const [experiences, setExperiences] = useState<ExperienceEntry[]>(
    profile.experiences,
  );
  const [educations, setEducations] = useState<EducationEntry[]>(
    profile.educations,
  );

  // ── Save handlers ──
  const saveInfo = useCallback(async () => {
    await onSave({ name, summary });
    setEditingInfo(false);
  }, [name, summary, onSave]);

  const saveSkills = useCallback(async () => {
    await onSave({ skills: skillNames });
    setEditingSkills(false);
  }, [skillNames, onSave]);

  const saveExperiences = useCallback(async () => {
    await onSave({ experiences });
    setEditingExp(false);
  }, [experiences, onSave]);

  const saveEducation = useCallback(async () => {
    await onSave({ educations });
    setEditingEdu(false);
  }, [educations, onSave]);

  // ── Skill helpers ──
  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skillNames.includes(trimmed)) {
      setSkillNames([...skillNames, trimmed]);
      setNewSkill("");
    }
  };

  const removeSkill = (idx: number) => {
    setSkillNames(skillNames.filter((_, i) => i !== idx));
  };

  // ── Experience helpers ──
  const addExperience = () => {
    setExperiences([
      ...experiences,
      { role: "", company: "", startDate: "", endDate: "", description: "" },
    ]);
  };

  const updateExperience = (
    idx: number,
    field: keyof ExperienceEntry,
    value: string,
  ) => {
    const copy = [...experiences];
    copy[idx] = { ...copy[idx], [field]: value };
    setExperiences(copy);
  };

  const removeExperience = (idx: number) => {
    setExperiences(experiences.filter((_, i) => i !== idx));
  };

  // ── Education helpers ──
  const addEducation = () => {
    setEducations([
      ...educations,
      {
        institution: "",
        degree: "",
        field: "",
        startDate: "",
        endDate: "",
        gpa: "",
      },
    ]);
  };

  const updateEducation = (
    idx: number,
    field: keyof EducationEntry,
    value: string,
  ) => {
    const copy = [...educations];
    copy[idx] = { ...copy[idx], [field]: value };
    setEducations(copy);
  };

  const removeEducation = (idx: number) => {
    setEducations(educations.filter((_, i) => i !== idx));
  };

  const cancelInfo = () => {
    setName(profile.name ?? "");
    setSummary(profile.summary ?? "");
    setEditingInfo(false);
  };

  const cancelSkills = () => {
    setSkillNames(profile.skills.map((s) => s.name));
    setNewSkill("");
    setEditingSkills(false);
  };

  const cancelExp = () => {
    setExperiences(profile.experiences);
    setEditingExp(false);
  };

  const cancelEdu = () => {
    setEducations(profile.educations);
    setEditingEdu(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* ────────────────────────────────────────
       * 1. BASIC INFO
       * ──────────────────────────────────────── */}
      <div className={`${styles.sectionCard} ${styles.sectionCardNth1}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span className={`${styles.sectionIcon} ${styles.sectionIconBlue}`}>
              <User size={14} />
            </span>
            Basic Information
          </div>
          {!editingInfo && (
            <button
              className={styles.editBtn}
              onClick={() => setEditingInfo(true)}
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
        </div>

        {editingInfo ? (
          <>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Full Name</label>
              <input
                className={styles.inputField}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Email</label>
              <input
                className={styles.inputField}
                value={profile.email}
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Professional Summary</label>
              <textarea
                className={styles.textareaField}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Write a brief professional summary..."
                rows={4}
              />
            </div>
            <div className={styles.actionBar}>
              <button className={styles.cancelBtn} onClick={cancelInfo}>
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={saveInfo}
                disabled={saving}
              >
                <Save size={12} />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Full Name</label>
              <p className={styles.infoValue}>
                {profile.name || (
                  <span className={styles.infoValueMuted}>Not set</span>
                )}
              </p>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Email</label>
              <p className={styles.infoValue}>{profile.email}</p>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Professional Summary</label>
              <p className={styles.infoValue}>
                {profile.summary || (
                  <span className={styles.infoValueMuted}>
                    No summary yet. Click Edit to add one.
                  </span>
                )}
              </p>
            </div>

            {/* Connected accounts */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginTop: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              {profile.githubConnected && (
                <span
                  className={styles.skillTag}
                  style={{
                    background: "hsla(0, 0%, 15%, 0.08)",
                    color: "hsl(0, 0%, 25%)",
                    borderColor: "hsla(0, 0%, 15%, 0.15)",
                  }}
                >
                  <Github size={12} />
                  {profile.githubLogin ?? "GitHub"}
                </span>
              )}
              {profile.linkedinImported && (
                <span
                  className={styles.skillTag}
                  style={{
                    background: "hsla(210, 80%, 50%, 0.1)",
                    color: "hsl(210, 70%, 42%)",
                    borderColor: "hsla(210, 80%, 50%, 0.2)",
                  }}
                >
                  <Linkedin size={12} />
                  LinkedIn
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ────────────────────────────────────────
       * 2. SKILLS
       * ──────────────────────────────────────── */}
      <div className={`${styles.sectionCard} ${styles.sectionCardNth2}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span
              className={`${styles.sectionIcon} ${styles.sectionIconPurple}`}
            >
              <Code2 size={14} />
            </span>
            Skills
          </div>
          {!editingSkills && (
            <button
              className={styles.editBtn}
              onClick={() => setEditingSkills(true)}
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
        </div>

        {skillNames.length > 0 ? (
          <div className={styles.skillTagList}>
            {skillNames.map((skill, idx) => (
              <span key={`${skill}-${idx}`} className={styles.skillTag}>
                {skill}
                {editingSkills && (
                  <button
                    className={styles.skillTagRemove}
                    onClick={() => removeSkill(idx)}
                    title="Remove skill"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>
            No skills yet. Connect GitHub or add manually.
          </p>
        )}

        {editingSkills && (
          <>
            <div className={styles.addSkillRow}>
              <input
                className={styles.addSkillInput}
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSkill()}
                placeholder="Type a skill and press Enter..."
              />
              <button className={styles.addSkillBtn} onClick={addSkill}>
                <Plus size={12} />
                Add
              </button>
            </div>
            <div className={styles.actionBar}>
              <button className={styles.cancelBtn} onClick={cancelSkills}>
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={saveSkills}
                disabled={saving}
              >
                <Save size={12} />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ────────────────────────────────────────
       * 3. EXPERIENCE
       * ──────────────────────────────────────── */}
      <div className={`${styles.sectionCard} ${styles.sectionCardNth3}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span
              className={`${styles.sectionIcon} ${styles.sectionIconGreen}`}
            >
              <Briefcase size={14} />
            </span>
            Experience
          </div>
          {!editingExp && (
            <button
              className={styles.editBtn}
              onClick={() => setEditingExp(true)}
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
        </div>

        {editingExp ? (
          <>
            {experiences.map((exp, idx) => (
              <div key={idx} className={styles.entryItem}>
                <div className={styles.entryHeader}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.inputRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Role</label>
                        <input
                          className={styles.inputField}
                          value={exp.role}
                          onChange={(e) =>
                            updateExperience(idx, "role", e.target.value)
                          }
                          placeholder="Job title"
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Company</label>
                        <input
                          className={styles.inputField}
                          value={exp.company}
                          onChange={(e) =>
                            updateExperience(idx, "company", e.target.value)
                          }
                          placeholder="Company name"
                        />
                      </div>
                    </div>
                    <div className={styles.inputRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Start Date</label>
                        <input
                          className={styles.inputField}
                          value={exp.startDate ?? ""}
                          onChange={(e) =>
                            updateExperience(idx, "startDate", e.target.value)
                          }
                          placeholder="e.g. Jan 2023"
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>End Date</label>
                        <input
                          className={styles.inputField}
                          value={exp.endDate ?? ""}
                          onChange={(e) =>
                            updateExperience(idx, "endDate", e.target.value)
                          }
                          placeholder="e.g. Present"
                        />
                      </div>
                    </div>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Description</label>
                      <textarea
                        className={styles.textareaField}
                        value={exp.description ?? ""}
                        onChange={(e) =>
                          updateExperience(idx, "description", e.target.value)
                        }
                        placeholder="Describe your responsibilities..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className={styles.entryActions}>
                    <button
                      className={`${styles.entryActionBtn} ${styles.deleteBtn}`}
                      onClick={() => removeExperience(idx)}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button className={styles.addEntryBtn} onClick={addExperience}>
              <Plus size={14} />
              Add Experience
            </button>
            <div className={styles.actionBar}>
              <button className={styles.cancelBtn} onClick={cancelExp}>
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={saveExperiences}
                disabled={saving}
              >
                <Save size={12} />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        ) : experiences.length > 0 ? (
          experiences.map((exp, idx) => (
            <div key={idx} className={styles.entryItem}>
              <div className={styles.entryRole}>{exp.role}</div>
              <div className={styles.entryCompany}>{exp.company}</div>
              <div className={styles.entryDuration}>
                {[exp.startDate, exp.endDate ?? "Present"]
                  .filter(Boolean)
                  .join(" — ")}
              </div>
              {exp.description && (
                <div className={styles.entryDesc}>{exp.description}</div>
              )}
            </div>
          ))
        ) : (
          <p className={styles.emptyState}>
            No experience added yet. Import from LinkedIn or add manually.
          </p>
        )}
      </div>

      {/* ────────────────────────────────────────
       * 4. EDUCATION
       * ──────────────────────────────────────── */}
      <div className={`${styles.sectionCard} ${styles.sectionCardNth4}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span
              className={`${styles.sectionIcon} ${styles.sectionIconOrange}`}
            >
              <GraduationCap size={14} />
            </span>
            Education
          </div>
          {!editingEdu && (
            <button
              className={styles.editBtn}
              onClick={() => setEditingEdu(true)}
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
        </div>

        {editingEdu ? (
          <>
            {educations.map((edu, idx) => (
              <div key={idx} className={styles.entryItem}>
                <div className={styles.entryHeader}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Institution</label>
                      <input
                        className={styles.inputField}
                        value={edu.institution}
                        onChange={(e) =>
                          updateEducation(idx, "institution", e.target.value)
                        }
                        placeholder="University / School"
                      />
                    </div>
                    <div className={styles.inputRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Degree</label>
                        <input
                          className={styles.inputField}
                          value={edu.degree ?? ""}
                          onChange={(e) =>
                            updateEducation(idx, "degree", e.target.value)
                          }
                          placeholder="e.g. B.Tech"
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>
                          Field of Study
                        </label>
                        <input
                          className={styles.inputField}
                          value={edu.field ?? ""}
                          onChange={(e) =>
                            updateEducation(idx, "field", e.target.value)
                          }
                          placeholder="e.g. Computer Science"
                        />
                      </div>
                    </div>
                    <div className={styles.inputRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Start Date</label>
                        <input
                          className={styles.inputField}
                          value={edu.startDate ?? ""}
                          onChange={(e) =>
                            updateEducation(idx, "startDate", e.target.value)
                          }
                          placeholder="e.g. 2020"
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>End Date</label>
                        <input
                          className={styles.inputField}
                          value={edu.endDate ?? ""}
                          onChange={(e) =>
                            updateEducation(idx, "endDate", e.target.value)
                          }
                          placeholder="e.g. 2024"
                        />
                      </div>
                    </div>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>GPA</label>
                      <input
                        className={styles.inputField}
                        value={edu.gpa ?? ""}
                        onChange={(e) =>
                          updateEducation(idx, "gpa", e.target.value)
                        }
                        placeholder="e.g. 8.5 / 10"
                      />
                    </div>
                  </div>
                  <div className={styles.entryActions}>
                    <button
                      className={`${styles.entryActionBtn} ${styles.deleteBtn}`}
                      onClick={() => removeEducation(idx)}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button className={styles.addEntryBtn} onClick={addEducation}>
              <Plus size={14} />
              Add Education
            </button>
            <div className={styles.actionBar}>
              <button className={styles.cancelBtn} onClick={cancelEdu}>
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={saveEducation}
                disabled={saving}
              >
                <Save size={12} />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        ) : educations.length > 0 ? (
          educations.map((edu, idx) => (
            <div key={idx} className={styles.entryItem}>
              <div className={styles.entryRole}>{edu.institution}</div>
              <div className={styles.entryCompany}>
                {[edu.degree, edu.field].filter(Boolean).join(" in ")}
              </div>
              <div className={styles.entryDuration}>
                {[edu.startDate, edu.endDate].filter(Boolean).join(" — ")}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </div>
            </div>
          ))
        ) : (
          <p className={styles.emptyState}>
            No education added yet. Import from LinkedIn or add manually.
          </p>
        )}
      </div>

      {/* ────────────────────────────────────────
       * 5. PROJECTS (Read-Only)
       * ──────────────────────────────────────── */}
      <div className={`${styles.sectionCard} ${styles.sectionCardNth5}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span
              className={`${styles.sectionIcon} ${styles.sectionIconTeal}`}
            >
              <FolderGit2 size={14} />
            </span>
            Projects
          </div>
          <span
            style={{
              fontSize: "0.6875rem",
              color: "var(--muted-foreground)",
              fontStyle: "italic",
            }}
          >
            Managed via GitHub analysis
          </span>
        </div>

        {profile.projects.length > 0 ? (
          profile.projects.slice(0, 8).map((project) => (
            <div key={project.id} className={styles.projectCard}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <span className={styles.projectName}>{project.name}</span>
                {project.domain && (
                  <span
                    className={styles.projectDomain}
                    style={{
                      background:
                        DOMAIN_BG[project.domain] ??
                        "var(--muted)",
                      color:
                        DOMAIN_COLOR[project.domain] ??
                        "var(--muted-foreground)",
                    }}
                  >
                    {project.domain}
                  </span>
                )}
              </div>
              {project.techStack.length > 0 && (
                <div className={styles.projectTechList}>
                  {project.techStack.slice(0, 6).map((tech) => (
                    <span key={tech} className={styles.projectTechTag}>
                      {tech}
                    </span>
                  ))}
                  {project.techStack.length > 6 && (
                    <span className={styles.projectTechTag}>
                      +{project.techStack.length - 6}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className={styles.emptyState}>
            No projects yet. Connect GitHub to import your repositories.
          </p>
        )}
      </div>
    </div>
  );
}
