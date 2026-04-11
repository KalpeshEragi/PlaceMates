import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Skill = {
  name: string;
  domain?: string;
};

type Project = {
  name: string;
  techStack: string[];
  finalBullets: string[];
  description?: string;
};

type Experience = {
  role: string;
  company: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

type Education = {
  institution: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
};

type Award = {
  title: string;
  description?: string;
  issuedAt?: string;
};

type Certification = {
  name: string;
  issuer?: string;
  issuedAt?: string;
};

export type ResumeData = {
  name?: string;
  email: string;
  summary?: string;
  skills: Skill[];
  projects: Project[];
  experiences: Experience[];
  educations: Education[];
  awards?: Award[];
  certifications?: Certification[];
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 mb-2">
      <h2 className="text-xs font-bold tracking-widest uppercase text-gray-400 pb-1">
        <span className="border-b-2 border-gray-800 pb-1">{children}</span>
      </h2>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block border border-gray-300 text-gray-600 text-xs px-2 py-0.5 mr-1 mb-1">
      {children}
    </span>
  );
}

function SkillsSection({ skills }: { skills: Skill[] }) {
  if (!skills.length) return null;

  const grouped = skills.reduce<Record<string, string[]>>((acc, s) => {
    const key = s.domain ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s.name);
    return acc;
  }, {});

  return (
    <section>
      <SectionHeading>Skills</SectionHeading>
      <div className="space-y-1">
        {Object.entries(grouped).map(([domain, names]) => (
          <div key={domain} className="flex text-sm leading-snug">
            <span className="w-44 shrink-0 font-medium text-gray-600 text-xs pt-0.5">
              {domain}
            </span>
            <span className="text-gray-800 text-sm">{names.join(", ")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExperienceSection({ experiences }: { experiences: Experience[] }) {
  if (!experiences.length) return null;

  return (
    <section>
      <SectionHeading>Experience</SectionHeading>
      <div className="space-y-4">
        {experiences.map((exp) => (
          <div key={`${exp.company}-${exp.role}`}>
            <div className="flex justify-between items-baseline flex-wrap gap-x-2">
              <span className="font-semibold text-sm text-gray-900">
                {exp.role}
              </span>
              {(exp.startDate ?? exp.endDate) && (
                <span className="text-xs text-gray-400 shrink-0">
                  {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
                </span>
              )}
            </div>
            {exp.company && (
              <div className="text-xs text-gray-500 mb-1">{exp.company}</div>
            )}
            {exp.description && (
              <ul className="list-disc list-outside ml-4 space-y-0.5">
                {exp.description
                  .split(". ")
                  .filter(Boolean)
                  .map((pt) => (
                    <li
                      key={pt.slice(0, 40)}
                      className="text-sm text-gray-700 leading-snug"
                    >
                      {pt.trim().replace(/\.$/, "")}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProjectsSection({ projects }: { projects: Project[] }) {
  if (!projects.length) return null;

  return (
    <section>
      <SectionHeading>Projects</SectionHeading>
      <div className="space-y-4">
        {projects.map((proj) => (
          <div key={proj.name}>
            <div className="font-semibold text-sm text-gray-900">
              {proj.name}
            </div>
            {proj.description && (
              <div className="text-xs text-gray-500 mb-1">
                {proj.description}
              </div>
            )}
            {proj.techStack.length > 0 && (
              <div className="mb-1">
                {proj.techStack.map((tech) => (
                  <Tag key={tech}>{tech}</Tag>
                ))}
              </div>
            )}
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              {proj.finalBullets.map((bullet) => (
                <li
                  key={bullet.slice(0, 40)}
                  className="text-sm text-gray-700 leading-snug"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function EducationSection({ educations }: { educations: Education[] }) {
  if (!educations.length) return null;

  return (
    <section>
      <SectionHeading>Education</SectionHeading>
      <div className="space-y-2">
        {educations.map((edu) => (
          <div
            key={edu.institution}
            className="flex justify-between items-start"
          >
            <div>
              <span className="font-semibold text-sm text-gray-900">
                {edu.institution}
              </span>
              {(edu.degree ?? edu.field) && (
                <div className="text-xs text-gray-500">
                  {[edu.degree, edu.field].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
            <div className="text-right shrink-0 ml-4">
              {edu.endDate && (
                <div className="text-xs text-gray-400">{edu.endDate}</div>
              )}
              {edu.gpa && (
                <div className="text-xs text-gray-600 font-medium">
                  {edu.gpa}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AwardsSection({ awards }: { awards?: Award[] }) {
  if (!awards?.length) return null;

  return (
    <section>
      <SectionHeading>Honors &amp; Achievements</SectionHeading>
      <div className="space-y-2">
        {awards.map((award) => (
          <div key={award.title}>
            <div className="flex justify-between items-baseline flex-wrap gap-x-2">
              <span className="font-semibold text-sm text-gray-900">
                {award.title}
              </span>
              {award.issuedAt && (
                <span className="text-xs text-gray-400 shrink-0">
                  {award.issuedAt}
                </span>
              )}
            </div>
            {award.description && (
              <p className="text-sm text-gray-700 leading-snug mt-0.5">
                {award.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CertificationsSection({
  certifications,
}: {
  certifications?: Certification[];
}) {
  if (!certifications?.length) return null;

  return (
    <section>
      <SectionHeading>Certifications</SectionHeading>
      <ul className="list-disc list-outside ml-4 space-y-0.5">
        {certifications.map((cert) => (
          <li key={cert.name} className="text-sm text-gray-800 leading-snug">
            {cert.name}
            {cert.issuer && (
              <span className="text-gray-400"> — {cert.issuer}</span>
            )}
            {cert.issuedAt && (
              <span className="text-gray-400"> ({cert.issuedAt})</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function KalpeshResumeTemplate({
  data,
}: {
  data: ResumeData;
}) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 print:bg-white print:py-0 print:px-0">
      <div className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none">

        {/* ── Header ── */}
        <div className="px-10 pt-10 pb-6 print:px-8 print:pt-8 border-b border-gray-200">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              {data.name && (
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 uppercase leading-none">
                  {data.name}
                </h1>
              )}
              <div className="mt-1.5 text-sm text-gray-500">{data.email}</div>
            </div>
          </div>
          {data.summary && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed max-w-2xl border-l-2 border-gray-300 pl-3">
              {data.summary}
            </p>
          )}
        </div>

        {/* ── Body ── */}
        <div className="px-10 pb-10 print:px-8 print:pb-8">
          <ExperienceSection experiences={data.experiences} />
          <ProjectsSection projects={data.projects} />
          <SkillsSection skills={data.skills} />
          <EducationSection educations={data.educations} />
          <AwardsSection awards={data.awards} />
          <CertificationsSection certifications={data.certifications} />
        </div>

      </div>
    </div>
  );
}