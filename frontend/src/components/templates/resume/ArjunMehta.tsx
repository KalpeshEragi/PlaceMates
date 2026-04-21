import React from "react";
import type { ResumeData } from "./Template1";

// ── Helpers ─────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-gray-900 border-b-[2px] border-gray-800 pb-1 mb-3 mt-6">
      {children}
    </h2>
  );
}

function SidebarHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white border-b border-white/20 pb-1 mb-3 mt-6">
      {children}
    </h3>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function ArjunMehtaTemplate({ data }: { data: ResumeData }) {
  const { name, email, summary, experiences, projects, skills, educations, awards, certifications } = data;

  // Assuming social links might be available in a real user's profile, but defaulting to placeholders/email
  const contactLines: React.ReactNode[] = [
    <span key="email" className="flex items-center gap-2">
      <span className="w-4 h-3 bg-pink-200 rounded-sm inline-block shrink-0" />
      {email}
    </span>,
    <span key="github" className="flex items-center gap-2">
      <span className="w-4 h-3 bg-blue-200 rounded-sm inline-block shrink-0" />
      github.com/profile
    </span>
  ];

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-[#1a1a1a] font-sans flex flex-row shadow-[0_0_10px_rgba(0,0,0,0.1)]">
      
      {/* ── Main Column (Left) ── */}
      <div className="flex-1 py-10 pl-10 pr-8">
        <h1 className="text-[32px] font-extrabold tracking-tight text-gray-900 mb-2">
          {name || "Your Name"}
        </h1>

        {summary && (
          <p className="text-[13px] leading-relaxed text-gray-600 mb-6 font-medium">
            {summary}
          </p>
        )}

        {summary && (
          <div>
            <SectionHeading>Professional Summary</SectionHeading>
            <p className="text-xs leading-relaxed text-gray-700">{summary}</p>
          </div>
        )}

        {experiences && experiences.length > 0 && (
          <div>
            <SectionHeading>Work Experience</SectionHeading>
            <div className="space-y-5">
              {experiences.map((exp, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-bold text-sm text-gray-900">{exp.company}</span>
                    <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                      {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
                    </span>
                  </div>
                  <div className="text-[13px] italic text-gray-700 mb-1.5">{exp.role}</div>
                  {exp.description && (
                    <ul className="list-disc list-outside ml-4 space-y-1">
                      {exp.description.split(". ").filter(Boolean).map((pt, i) => (
                        <li key={i} className="text-xs text-gray-700 leading-snug">{pt.trim().replace(/\.$/, "")}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div>
            <SectionHeading>Projects</SectionHeading>
            <div className="space-y-5">
              {projects.map((proj, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-bold text-sm text-gray-900">{proj.name}</span>
                    {proj.techStack && proj.techStack.length > 0 && (
                      <span className="text-[11px] text-gray-500 max-w-[50%] text-right truncate font-medium">
                        {proj.techStack.join(", ")}
                      </span>
                    )}
                  </div>
                  <ul className="list-disc list-outside ml-4 space-y-1 mt-1.5">
                    {proj.finalBullets.map((bullet, i) => (
                      <li key={i} className="text-xs text-gray-700 leading-snug">{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Sidebar (Right) ── */}
      {/* Deep Slate background like the screenshot (#2f3640 or so) */}
      <div className="w-[70mm] bg-[#2a303c] py-10 px-6 shrink-0 flex flex-col text-gray-300">
        
        {/* Contact */}
        <div className="mt-[-10px]">
          <SidebarHeading>Contact</SidebarHeading>
          <div className="space-y-3 mt-4">
            {contactLines.map((line, idx) => (
               <div key={idx} className="text-[11px] leading-tight break-all text-gray-200">
                 {line}
               </div>
            ))}
          </div>
        </div>

        {/* Skills */}
        {skills && skills.length > 0 && (
          <div>
            <SidebarHeading>Skills</SidebarHeading>
            <div className="flex flex-wrap gap-2 mt-4">
              {skills.map((s, i) => (
                <span key={i} className="text-[10px] font-medium bg-white/10 text-gray-200 px-2.5 py-1 rounded-full border border-white/5">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {educations && educations.length > 0 && (
          <div>
            <SidebarHeading>Education</SidebarHeading>
            <div className="space-y-4 mt-4">
              {educations.map((edu, idx) => (
                <div key={idx} className="text-xs">
                  <p className="font-bold text-white leading-snug mb-1">{edu.institution}</p>
                  {(edu.degree || edu.field) && (
                    <p className="text-gray-300 leading-snug mb-1 text-[11px]">
                      {edu.degree} {edu.field ? `– ${edu.field}` : ""}
                    </p>
                  )}
                  {(edu.startDate || edu.endDate) && (
                     <p className="text-gray-400 text-[10px] mb-0.5">
                       {[edu.startDate, edu.endDate].filter(Boolean).join(" – ")}
                     </p>
                  )}
                  {edu.gpa && <p className="text-gray-400 text-[10px]">GPA: {edu.gpa}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Awards */}
        {awards && awards.length > 0 && (
          <div>
            <SidebarHeading>Awards</SidebarHeading>
            <div className="space-y-3 mt-4">
              {awards.map((a, idx) => (
                 <p key={idx} className="text-[11px] text-gray-200 leading-snug font-medium">
                   {a.title} {a.issuedAt && <span className="text-gray-400 block text-[10px] mt-0.5">({a.issuedAt})</span>}
                 </p>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {certifications && certifications.length > 0 && (
          <div>
            <SidebarHeading>Certifications</SidebarHeading>
            <div className="space-y-3 mt-4">
              {certifications.map((c, idx) => (
                 <div key={idx} className="text-[11px] leading-snug">
                   <p className="text-white font-medium">{c.name}</p>
                   {c.issuer && <p className="text-gray-400 mt-0.5">{c.issuer}</p>}
                 </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
