"use client"

import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { groupSkillsByDomain, DOMAIN_ICONS, type SkillDomain } from "@/lib/templates/skillDomainMap"
import { getSkillIconPath } from "@/lib/templates/skillIcons"
import { truncateText, limitBullets } from "@/lib/templates/textUtils"

export type PortfolioData = {
  name: string;
  role: string;
  summary: string;
  profileImageUrl?: string | null;
  skills: (string | { name: string })[];
  projects: {
    name: string;
    description: string;
    techStack?: string[];
    githubUrl?: string;
    repoUrl?: string;
    imageUrl?: string | null;
    finalBullets?: string[];
  }[];
  experience: {
    role: string;
    company: string;
    duration: string;
    description: string;
  }[];
  education?: {
    institution: string;
    degree: string;
    duration: string;
  }[];
  awards?: {
    title: string;
    description?: string;
  }[];
};

function normalizeSkills(skills: (string | { name: string })[]): string[] {
  return skills.map(s => (typeof s === 'string' ? s : s.name));
}

// ── Background 3D (canvas only, pointer-events: none) ─────────

function ParticleField() {
  const count = 90;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = -(Math.random() * 12 + 2);
    }
    return pos;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.018;
      ref.current.rotation.x = clock.elapsedTime * 0.009;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color="#c778dd" transparent opacity={0.28} sizeAttenuation />
    </points>
  );
}

function AmbientGrid() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.008;
  });
  const lines = useMemo(() => {
    const result: { pts: THREE.Vector3[] }[] = [];
    for (let i = -6; i <= 6; i += 2) {
      result.push({ pts: [new THREE.Vector3(-8, i, -12), new THREE.Vector3(8, i, -12)] });
      result.push({ pts: [new THREE.Vector3(i, -8, -12), new THREE.Vector3(i, 8, -12)] });
    }
    return result;
  }, []);
  return (
    <group ref={ref}>
      {lines.map((l, i) => {
        const geo = new THREE.BufferGeometry().setFromPoints(l.pts);
        return (
          <primitive key={i} object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#c778dd', transparent: true, opacity: 0.05 }))} />
        );
      })}
    </group>
  );
}

// ── Hook ──────────────────────────────────────────────────────

function useSectionProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      setP(Math.min(1, el.scrollTop / (el.scrollHeight - el.clientHeight)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // range(start, end) → 0..1
  const range = (start: number, end: number) =>
    Math.max(0, Math.min(1, (p - start) / (end - start)));
  return { p, range };
}

// ── Shared UI ─────────────────────────────────────────────────

function SectionMark({ label, icon }: { label: string; icon?: string }) {
  return (
    <div className="flex items-center gap-3 mb-10">
      <span className="font-['Fira_Code',monospace] text-[#c778dd] text-2xl font-semibold" style={{ textShadow: '0 0 16px rgba(199,120,221,0.5)' }}>
        #
      </span>
      {icon && <span className="text-xl">{icon}</span>}
      <h2 className="font-['Fira_Code',monospace] font-semibold text-white text-2xl md:text-3xl">{label}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-[#c778dd]/40 to-transparent" />
    </div>
  );
}

function SkillTag({ name }: { name: string }) {
  const path = getSkillIconPath(name);
  return (
    <span className="inline-flex items-center gap-1.5 font-['Fira_Code',monospace] text-[11px] px-2.5 py-1 rounded-full border border-[#c778dd]/25 text-[#abb2bf] bg-white/[0.05] hover:border-[#c778dd]/60 hover:text-white transition-all duration-200 cursor-default select-none whitespace-nowrap">
      {path && (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[#c778dd]/60 shrink-0" aria-hidden>
          <path d={path} />
        </svg>
      )}
      {name}
    </span>
  );
}

// ── Section: Hero ─────────────────────────────────────────────

function HeroSection({ data, p }: { data: PortfolioData; p: number }) {
  const fadeOut = Math.max(0, 1 - p * 6.5);
  const translateY = p * -60;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-8 md:px-16"
      style={{ opacity: fadeOut, transform: `translateY(${translateY}px)`, willChange: 'opacity, transform', pointerEvents: fadeOut > 0.05 ? 'auto' : 'none' }}
    >
      <div className="max-w-6xl w-full flex flex-col lg:flex-row items-center gap-14">
        {/* Text */}
        <div className="flex-1 max-w-xl">
          <p className="font-['Fira_Code',monospace] text-[#c778dd] text-sm tracking-widest uppercase mb-4">Hello, I'm</p>
          <h1 className="font-['Fira_Code',monospace] font-bold text-5xl md:text-6xl text-white leading-tight mb-3">
            {data.name}
          </h1>
          <h2 className="font-['Fira_Code',monospace] font-medium text-xl md:text-2xl text-white/60 mb-8">
            — <span className="text-[#c778dd]">{data.role}</span>
          </h2>
          <p className="font-['Lato',sans-serif] text-[#9ca3af] text-lg leading-relaxed max-w-md mb-10">
            {truncateText(data.summary, 220)}
          </p>
          {/* Stats */}
          <div className="flex items-stretch border border-[#c778dd]/20 rounded-2xl overflow-hidden w-fit bg-white/[0.03] backdrop-blur-sm">
            {[
              { val: data.experience.length, label: 'Experiences' },
              { val: data.projects.length, label: 'Projects' },
            ].map((stat, i) => (
              <div key={i} className={`flex flex-col items-center gap-1 px-8 py-4 ${i > 0 ? 'border-l border-[#c778dd]/20' : ''}`}>
                <span className="font-['Fira_Code',monospace] font-bold text-2xl text-[#c778dd]">{stat.val}</span>
                <span className="font-['Lato',sans-serif] text-[#9ca3af] text-sm">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Avatar */}
        <div className="shrink-0">
          <div className="w-52 h-64 md:w-60 md:h-72 rounded-2xl border border-[#c778dd]/20 bg-gradient-to-br from-[#c778dd]/10 to-transparent overflow-hidden flex items-center justify-center shadow-[0_0_50px_rgba(199,120,221,0.08)]">
            {data.profileImageUrl ? (
              <img src={data.profileImageUrl} alt={data.name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-['Fira_Code',monospace] font-bold text-6xl text-[#c778dd]/25">
                {data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section: Skills (Scatter → Organize) ─────────────────────

function SkillsSection({ data, sectionP }: { data: PortfolioData; sectionP: number }) {
  const skills = normalizeSkills(data.skills);
  const grouped = groupSkillsByDomain(skills);
  const domains = Object.keys(grouped) as SkillDomain[];

  // Deterministic scatter offsets per domain card
  const scatter = useMemo(() =>
    domains.map((_, i) => ({
      x: Math.sin(i * 2.39) * 220,
      y: Math.cos(i * 1.61) * 130,
      rotate: Math.sin(i * 3.7) * 18,
      scale: 0.55 + Math.abs(Math.cos(i * 1.2)) * 0.4,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domains.length]
  );

  const isOrganized = sectionP > 0.45;
  const wrapOpacity = Math.min(1, sectionP * 4);

  return (
    <div
      className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 overflow-hidden"
      style={{ opacity: wrapOpacity, pointerEvents: wrapOpacity > 0.1 ? 'auto' : 'none' }}
    >
      <div className="max-w-6xl w-full mx-auto">
        <SectionMark label="skills" icon="💻" />

        {/* Subtitle */}
        <p
          className="font-['Lato',sans-serif] text-[#6b7280] text-base mb-8 transition-all duration-500"
          style={{ opacity: isOrganized ? 1 : 0, transform: isOrganized ? 'translateY(0)' : 'translateY(8px)' }}
        >
          Technologies grouped by domain
        </p>

        {/* Domain cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {domains.map((domain, idx) => {
            const s = scatter[idx];
            const delay = idx * 65;
            return (
              <div
                key={domain}
                className="rounded-xl border border-[#c778dd]/20 bg-white/[0.04] p-4 hover:border-[#c778dd]/45 hover:bg-white/[0.06] transition-colors duration-300"
                style={{
                  transform: isOrganized
                    ? 'translate(0,0) rotate(0deg) scale(1)'
                    : `translate(${s.x}px,${s.y}px) rotate(${s.rotate}deg) scale(${s.scale})`,
                  opacity: isOrganized ? 1 : 0,
                  transition: `transform 0.75s cubic-bezier(0.34,1.15,0.64,1) ${delay}ms, opacity 0.5s ease ${delay}ms`,
                }}
              >
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-[#c778dd]/12">
                  <span className="text-base">{DOMAIN_ICONS[domain]}</span>
                  <span className="font-['Fira_Code',monospace] text-[#c778dd] text-[10px] font-semibold uppercase tracking-wider">
                    {domain}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped[domain].slice(0, 6).map(skill => (
                    <SkillTag key={skill} name={skill} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scattered ghost labels (visible pre-organization) */}
        {!isOrganized && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {skills.slice(0, 18).map((skill, i) => {
              const sx = 8 + Math.abs(Math.sin(i * 1.37)) * 84;
              const sy = 5 + Math.abs(Math.cos(i * 2.09)) * 90;
              const delay = i * 35;
              return (
                <div
                  key={skill}
                  className="absolute font-['Fira_Code',monospace] text-[11px] text-[#c778dd]/45 border border-[#c778dd]/15 rounded-full px-3 py-1 bg-white/[0.03]"
                  style={{
                    left: `${sx}%`, top: `${sy}%`,
                    opacity: sectionP > 0.05 ? 0.8 - sectionP * 2 : 0,
                    transform: `translateY(${sectionP > 0.05 ? 0 : 16}px)`,
                    transition: `all 0.5s ease ${delay}ms`,
                  }}
                >
                  {skill}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section: Projects (Horizontal Carousel) ───────────────────

const CARD_W = 360;
const CARD_GAP = 24;

function ProjectsSection({ data, sectionP }: { data: PortfolioData; sectionP: number }) {
  const projects = data.projects;
  const currentPos = sectionP * (projects.length - 1);
  const offset = currentPos * (CARD_W + CARD_GAP);
  const wrapOpacity = Math.min(1, sectionP * 5);

  return (
    <div
      className="absolute inset-0 flex flex-col justify-center overflow-hidden"
      style={{ opacity: wrapOpacity, pointerEvents: wrapOpacity > 0.1 ? 'auto' : 'none' }}
    >
      <div className="px-8 md:px-16 mb-8 max-w-6xl mx-auto w-full">
        <SectionMark label="projects" icon="🚀" />
      </div>

      {/* Carousel */}
      <div className="overflow-hidden">
        <div
          className="flex"
          style={{
            gap: `${CARD_GAP}px`,
            paddingLeft: `calc(50vw - ${CARD_W / 2}px)`,
            paddingRight: `calc(50vw - ${CARD_W / 2}px)`,
            transform: `translateX(-${offset}px)`,
            willChange: 'transform',
          }}
        >
          {projects.map((project, idx) => {
            const dist = Math.abs(idx - currentPos);
            const isFocus = dist < 0.6;
            const scale = Math.max(0.82, 1 - dist * 0.12);
            const opa = Math.max(0.35, 1 - dist * 0.32);

            return (
              <div
                key={idx}
                className="shrink-0 transition-all duration-200"
                style={{ width: `${CARD_W}px`, transform: `scale(${scale})`, opacity: opa, transformOrigin: 'center center' }}
              >
                <div className={`rounded-2xl border bg-white/[0.04] overflow-hidden transition-shadow duration-300 ${isFocus ? 'border-[#c778dd]/35 shadow-[0_0_40px_rgba(199,120,221,0.12)]' : 'border-[#c778dd]/15'}`}>
                  {/* Thumbnail */}
                  <div className="h-44 bg-gradient-to-br from-[#c778dd]/12 via-[#282c33] to-[#1a1e27] flex items-center justify-center border-b border-[#c778dd]/12 overflow-hidden">
                    {project.imageUrl ? (
                      <img src={project.imageUrl} alt={project.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-['Fira_Code',monospace] font-bold text-5xl text-[#c778dd]/20">
                        {project.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-5">
                    <h3 className="font-['Fira_Code',monospace] font-semibold text-white text-base mb-2">{project.name}</h3>
                    {project.techStack && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {project.techStack.slice(0, 4).map(t => (
                          <span key={t} className="font-['Fira_Code',monospace] text-[9px] text-[#c778dd] bg-[#c778dd]/8 px-2 py-0.5 rounded border border-[#c778dd]/20">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="font-['Lato',sans-serif] text-[#9ca3af] text-sm leading-relaxed line-clamp-2">
                      {truncateText(project.description, 110)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scroll hint dots */}
      <div className="flex justify-center gap-2 mt-8 px-8">
        {projects.map((_, idx) => {
          const isActive = Math.abs(idx - currentPos) < 0.5;
          return (
            <div key={idx} className={`rounded-full transition-all duration-300 ${isActive ? 'w-5 h-1.5 bg-[#c778dd]' : 'w-1.5 h-1.5 bg-white/20'}`} />
          );
        })}
      </div>
    </div>
  );
}

// ── Section: Experience (Staggered Timeline) ──────────────────

function ExperienceSection({ data, sectionP }: { data: PortfolioData; sectionP: number }) {
  const wrapOpacity = Math.min(1, sectionP * 5);

  return (
    <div
      className="absolute inset-0 overflow-y-auto flex flex-col justify-start px-8 md:px-16 py-14"
      style={{ opacity: wrapOpacity, pointerEvents: wrapOpacity > 0.1 ? 'auto' : 'none' }}
    >
      <div className="max-w-4xl w-full mx-auto">
        <SectionMark label="experience" icon="💼" />

        <div className="relative">
          {/* Center spine */}
          <div className="absolute left-1/2 -translate-x-px top-2 bottom-2 w-px bg-gradient-to-b from-[#c778dd]/40 via-[#c778dd]/20 to-transparent" />

          <div className="space-y-10">
            {data.experience.map((item, idx) => {
              const delay = idx * 0.12;
              const itemP = Math.min(1, Math.max(0, (sectionP - delay) * 4.5));
              const isLeft = idx % 2 === 0;
              return (
                <div
                  key={idx}
                  className={`flex items-start ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}
                  style={{
                    opacity: itemP,
                    transform: `translateX(${isLeft ? (itemP - 1) * 30 : (1 - itemP) * 30}px)`,
                    transition: 'none',
                  }}
                >
                  {/* Card */}
                  <div className={`w-[calc(50%-24px)] ${isLeft ? 'text-left pr-8' : 'text-left pl-8'}`}>
                    <div className="rounded-xl border border-[#c778dd]/20 bg-white/[0.04] p-5 hover:border-[#c778dd]/40 transition-colors duration-300">
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div>
                          <h3 className="font-['Fira_Code',monospace] font-semibold text-white text-sm leading-snug">{item.role}</h3>
                          <p className="font-['Fira_Code',monospace] text-[#c778dd] text-sm mt-0.5">{item.company}</p>
                        </div>
                        <span className="font-['Fira_Code',monospace] text-[#c778dd]/70 text-[10px] border border-[#c778dd]/25 px-2.5 py-1 rounded-lg bg-[#c778dd]/6 shrink-0 whitespace-nowrap">
                          {item.duration}
                        </span>
                      </div>
                      <p className="font-['Lato',sans-serif] text-[#9ca3af] text-sm leading-relaxed">
                        {truncateText(item.description, 160)}
                      </p>
                    </div>
                  </div>

                  {/* Timeline dot */}
                  <div className="w-12 flex justify-center items-start pt-5 shrink-0">
                    <div
                      className="w-3 h-3 rounded-full bg-[#c778dd] border-2 border-[#282c33] z-10 relative"
                      style={{ boxShadow: itemP > 0.5 ? '0 0 12px rgba(199,120,221,0.7)' : 'none', transition: 'box-shadow 0.4s ease' }}
                    />
                  </div>
                  <div className="w-[calc(50%-24px)]" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section: Education ────────────────────────────────────────

function EducationSection({ data, sectionP }: { data: PortfolioData; sectionP: number }) {
  const wrapOpacity = Math.min(1, sectionP * 5);

  return (
    <div
      className="absolute inset-0 flex flex-col justify-center px-8 md:px-16"
      style={{ opacity: wrapOpacity, pointerEvents: wrapOpacity > 0.1 ? 'auto' : 'none' }}
    >
      <div className="max-w-5xl w-full mx-auto">
        <SectionMark label="education" icon="🎓" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.education?.map((edu, idx) => {
            const delay = idx * 120;
            const itemP = Math.min(1, Math.max(0, (sectionP - idx * 0.18) * 5));
            return (
              <div
                key={idx}
                className="rounded-xl border border-[#c778dd]/20 bg-white/[0.04] p-5 hover:border-[#c778dd]/40 transition-colors duration-300"
                style={{
                  opacity: itemP,
                  transform: `translateY(${(1 - itemP) * 22}px) scale(${0.96 + itemP * 0.04})`,
                  transition: `opacity 0.6s ease ${delay}ms, transform 0.65s cubic-bezier(0.34,1.1,0.64,1) ${delay}ms`,
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#c778dd]/10 flex items-center justify-center border border-[#c778dd]/20 shrink-0 text-lg">
                    🎓
                  </div>
                  <div>
                    <h3 className="font-['Fira_Code',monospace] font-medium text-white text-sm leading-snug">{edu.institution}</h3>
                    <p className="font-['Lato',sans-serif] text-[#9ca3af] text-sm mt-0.5">{edu.degree}</p>
                    <span className="font-['Fira_Code',monospace] text-[#c778dd]/65 text-[11px] mt-1 block">{edu.duration}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {data.awards && data.awards.length > 0 && (
          <div className="mt-10">
            <SectionMark label="awards" icon="🏆" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.awards.map((award, idx) => {
                const itemP = Math.min(1, Math.max(0, (sectionP - 0.35 - idx * 0.12) * 6));
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#c778dd]/20 bg-white/[0.04] p-4 hover:border-[#c778dd]/40 transition-colors duration-300"
                    style={{
                      opacity: itemP,
                      transform: `translateY(${(1 - itemP) * 16}px)`,
                      transition: `all 0.55s ease ${idx * 100}ms`,
                    }}
                  >
                    <h4 className="font-['Fira_Code',monospace] font-medium text-white text-sm">{award.title}</h4>
                    {award.description && (
                      <p className="font-['Lato',sans-serif] text-[#9ca3af] text-xs mt-1.5 leading-relaxed">
                        {truncateText(award.description, 120)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section Indicator ─────────────────────────────────────────

const SECTIONS = [
  { key: 'hero',       label: 'intro',       start: 0 },
  { key: 'skills',     label: 'skills',      start: 0.15 },
  { key: 'projects',   label: 'projects',    start: 0.37 },
  { key: 'experience', label: 'experience',  start: 0.59 },
  { key: 'education',  label: 'education',   start: 0.80 },
];

function NavDots({ p }: { p: number }) {
  const active = SECTIONS.reduce((acc, s, i) => (p >= s.start ? i : acc), 0);
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 z-50">
      {SECTIONS.map((s, i) => (
        <div key={s.key} className="relative group flex items-center justify-end gap-2">
          <span
            className="font-['Fira_Code',monospace] text-[10px] text-[#c778dd]/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          >
            {s.label}
          </span>
          <div
            className={`rounded-full transition-all duration-350 ${
              active === i ? 'w-2 h-5 bg-[#c778dd]' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────

export default function PortfolioTemplate({ data }: { data: PortfolioData }) {
  const { p, range } = useSectionProgress();

  const sections = {
    hero:       p,
    skills:     range(0.15, 0.37),
    projects:   range(0.37, 0.59),
    experience: range(0.59, 0.80),
    education:  range(0.80, 1.00),
  };

  // Visible bands with slight cross-fade overlap
  const vis = {
    hero:       p < 0.20,
    skills:     p > 0.12 && p < 0.42,
    projects:   p > 0.33 && p < 0.64,
    experience: p > 0.55 && p < 0.85,
    education:  p > 0.76,
  };

  return (
    <div className="bg-[#282c33] text-white antialiased">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&family=Lato:wght@300;400;700;900&display=swap');`}</style>

      {/* Tall scroll driver */}
      <div style={{ height: '600vh' }}>
        {/* Sticky viewport */}
        <div className="sticky top-0 h-screen overflow-hidden">

          {/* R3F — background only, no pointer events */}
          <Canvas
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [0, 0, 12], fov: 60 }}
          >
            <ambientLight intensity={0.4} />
            <ParticleField />
            <AmbientGrid />
          </Canvas>

          {/* Content sections — native HTML, always crisp */}
          <div className="absolute inset-0">
            <HeroSection data={data} p={p} />
            {vis.skills     && <SkillsSection     data={data} sectionP={sections.skills}     />}
            {vis.projects   && <ProjectsSection   data={data} sectionP={sections.projects}   />}
            {vis.experience && <ExperienceSection data={data} sectionP={sections.experience} />}
            {vis.education  && <EducationSection  data={data} sectionP={sections.education}  />}
          </div>

          {/* Nav dots */}
          <NavDots p={p} />
        </div>
      </div>
    </div>
  );
}