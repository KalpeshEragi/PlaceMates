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
    <div className="mt-5 mb-2">
      <h2 className="text-xs font-bold tracking-widest uppercase text-gray-500 border-b border-gray-300 pb-1">
        {children}
      </h2>
    </div>
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
      <SectionHeading>Technical Skills</SectionHeading>
      <div className="space-y-1">
        {Object.entries(grouped).map(([domain, names]) => (
          <div key={domain} className="flex text-sm leading-snug">
            <span className="w-44 shrink-0 font-semibold text-gray-700">
              {domain}
            </span>
            <span className="text-gray-800">{names.join(", ")}</span>
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
      <SectionHeading>Professional Experience</SectionHeading>
      <div className="space-y-4">
        {experiences.map((exp) => (
          <div key={`${exp.company}-${exp.role}`}>
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-sm text-gray-900">
                {exp.role}
              </span>
              {(exp.startDate ?? exp.endDate) && (
                <span className="text-xs text-gray-500 shrink-0 ml-2">
                  {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-600 mb-1">{exp.company}</div>
            {exp.description && (
              <ul className="list-disc list-outside ml-4 space-y-0.5">
                {exp.description
                  .split(". ")
                  .filter(Boolean)
                  .map((pt) => (
                    <li
                      key={pt.slice(0, 40)}
                      className="text-sm text-gray-800 leading-snug"
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
              <div className="text-xs text-gray-600 mb-1">
                {proj.description}
              </div>
            )}
            {proj.techStack.length > 0 && (
              <div className="text-xs text-gray-500 mb-1">
                <span className="font-medium">Tech Stack: </span>
                {proj.techStack.join(", ")}
              </div>
            )}
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              {proj.finalBullets.map((bullet) => (
                <li
                  key={bullet.slice(0, 40)}
                  className="text-sm text-gray-800 leading-snug"
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
            className="flex justify-between items-baseline"
          >
            <div>
              <span className="font-semibold text-sm text-gray-900">
                {edu.institution}
              </span>
              {(edu.degree ?? edu.field) && (
                <div className="text-xs text-gray-600">
                  {[edu.degree, edu.field].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
            <div className="text-right shrink-0 ml-2">
              {edu.endDate && (
                <div className="text-xs text-gray-500">{edu.endDate}</div>
              )}
              {edu.gpa && (
                <div className="text-xs text-gray-600">{edu.gpa}</div>
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
      <SectionHeading>Awards</SectionHeading>
      <div className="space-y-2">
        {awards.map((award) => (
          <div key={award.title}>
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-sm text-gray-900">
                {award.title}
              </span>
              {award.issuedAt && (
                <span className="text-xs text-gray-500 shrink-0 ml-2">
                  {award.issuedAt}
                </span>
              )}
            </div>
            {award.description && (
              <p className="text-sm text-gray-700 leading-snug">
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
              <span className="text-gray-500"> — {cert.issuer}</span>
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

export default function TejashriResumeTemplate({
  data,
}: {
  data: ResumeData;
}) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 print:bg-white print:py-0 print:px-0">
      <div className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none">

        {/* ── Header ── */}
        <div className="border-b-2 border-gray-900 px-10 pt-10 pb-6 print:px-8 print:pt-8">
          {data.name && (
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 uppercase">
              {data.name}
            </h1>
          )}
          <div className="mt-1 text-sm text-gray-600">{data.email}</div>
          {data.summary && (
            <p className="mt-3 text-sm text-gray-700 leading-relaxed max-w-2xl">
              {data.summary}
            </p>
          )}
        </div>

        {/* ── Body ── */}
        <div className="px-10 pb-10 print:px-8 print:pb-8">
          <SkillsSection skills={data.skills} />
          <ExperienceSection experiences={data.experiences} />
          <ProjectsSection projects={data.projects} />
          <EducationSection educations={data.educations} />
          <AwardsSection awards={data.awards} />
          <CertificationsSection certifications={data.certifications} />
        </div>

      </div>
    </div>
  );
}