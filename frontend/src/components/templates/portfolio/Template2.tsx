"use client"

import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { groupSkillsByDomain, DOMAIN_ICONS, type SkillDomain } from "@/lib/templates/skillDomainMap"
import { getSkillIconPath } from "@/lib/templates/skillIcons"
import { truncateText, limitBullets } from "@/lib/templates/textUtils"
import type { PortfolioData } from "./Template1"

function normalizeSkills(skills: (string | { name: string })[]): string[] {
  return skills.map(s => (typeof s === 'string' ? s : s.name));
}

// ── Background 3D ─────────────────────────────────────────────

function GeometricWeb({ scrollP }: { scrollP: number }) {
  const count = 22;
  const posRef = useRef<Float32Array | null>(null);
  const lineRef = useRef<THREE.LineSegments>(null);

  const { positions, indices } = useMemo(() => {
    const pts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < count; i++) {
      pts.push(
        (Math.random() - 0.5) * 24,
        (Math.random() - 0.5) * 18,
        -(Math.random() * 8 + 4)
      );
    }
    // Connect nearby nodes
    for (let a = 0; a < count; a++) {
      for (let b = a + 1; b < count; b++) {
        const dx = pts[a*3] - pts[b*3];
        const dy = pts[a*3+1] - pts[b*3+1];
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 8) { idx.push(a, b); }
      }
    }
    return { positions: new Float32Array(pts), indices: idx };
  }, []);

  posRef.current = positions;

  const nodeRef = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (lineRef.current) lineRef.current.rotation.z = clock.elapsedTime * 0.012;
    if (nodeRef.current) nodeRef.current.rotation.z = clock.elapsedTime * 0.012;
  });

  const lineGeo = useMemo(() => {
    const idxPts: number[] = [];
    const pos = positions;
    for (let i = 0; i < indices.length; i += 2) {
      const a = indices[i]; const b = indices[i + 1];
      idxPts.push(pos[a*3], pos[a*3+1], pos[a*3+2]);
      idxPts.push(pos[b*3], pos[b*3+1], pos[b*3+2]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(idxPts, 3));
    return geo;
  }, [positions, indices]);

  return (
    <group>
      <lineSegments ref={lineRef} geometry={lineGeo}>
        <lineBasicMaterial color="#c778dd" transparent opacity={0.08} />
      </lineSegments>
      <points ref={nodeRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.06} color="#c778dd" transparent opacity={0.25} sizeAttenuation />
      </points>
    </group>
  );
}

// ── Scroll hook ───────────────────────────────────────────────

function useScrollP() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const h = () => {
      const el = document.documentElement;
      setP(Math.min(1, el.scrollTop / (el.scrollHeight - el.clientHeight)));
    };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  const range = (s: number, e: number) => Math.max(0, Math.min(1, (p - s) / (e - s)));
  return { p, range };
}

// ── UI primitives ─────────────────────────────────────────────

function SectionLabel({ label, icon }: { label: string; icon?: string }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <span className="font-['Fira_Code',monospace] text-[#c778dd] text-xl font-semibold">#</span>
      {icon && <span className="text-lg">{icon}</span>}
      <h2 className="font-['Fira_Code',monospace] font-semibold text-white text-xl md:text-2xl">{label}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-[#c778dd]/35 to-transparent" />
    </div>
  );
}

function Pill({ text, accent = false }: { text: string; accent?: boolean }) {
  return (
    <span className={`inline-flex items-center font-['Fira_Code',monospace] text-[10px] px-2.5 py-1 rounded border whitespace-nowrap ${accent ? 'border-[#c778dd]/40 text-[#c778dd] bg-[#c778dd]/8' : 'border-white/12 text-[#9ca3af] bg-white/[0.04]'}`}>
      {text}
    </span>
  );
}

// ── Top Navigation Bar ────────────────────────────────────────

const NAV = ['intro', 'skills', 'projects', 'experience', 'education'];
const NAV_STARTS = [0, 0.15, 0.37, 0.59, 0.80];

function TopNav({ p }: { p: number }) {
  const active = NAV_STARTS.reduce((a, s, i) => (p >= s ? i : a), 0);
  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-16 py-5">
      <span className="font-['Fira_Code',monospace] text-[#c778dd] font-bold text-sm tracking-widest select-none">
        &lt;portfolio /&gt;
      </span>
      <nav className="hidden md:flex items-center gap-1">
        {NAV.map((n, i) => (
          <span
            key={n}
            className={`font-['Fira_Code',monospace] text-xs px-3 py-1.5 rounded transition-all duration-300 ${
              active === i ? 'text-[#c778dd] bg-[#c778dd]/10 border border-[#c778dd]/30' : 'text-white/30'
            }`}
          >
            {n}
          </span>
        ))}
      </nav>
      {/* Progress bar */}
      <div className="w-20 h-px bg-white/10 relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-[#c778dd] transition-all duration-150" style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}

// ── Section: Hero ─────────────────────────────────────────────

function HeroSection({ data, p }: { data: PortfolioData; p: number }) {
  const fade = Math.max(0, 1 - p * 7);
  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-8 md:px-16 pt-20"
      style={{ opacity: fade, transform: `translateY(${-p * 50}px)`, pointerEvents: fade > 0.05 ? 'auto' : 'none' }}
    >
      <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-14 items-center">
        {/* Left */}
        <div>
          {/* Code comment style greeting */}
          <div className="font-['Fira_Code',monospace] text-[#6b7280] text-sm mb-6 space-y-0.5">
            <div><span className="text-[#c778dd]">{'/**'}</span></div>
            <div className="pl-4"><span className="text-[#6b7280]">* Hello, world!</span></div>
            <div className="pl-4"><span className="text-[#6b7280]">* I am </span><span className="text-white font-medium">{data.name}</span></div>
            <div className="pl-4"><span className="text-[#6b7280]">* {data.role}</span></div>
            <div><span className="text-[#c778dd]">{' */'}</span></div>
          </div>

          <h1 className="font-['Fira_Code',monospace] font-bold text-4xl md:text-5xl text-white leading-tight mb-4">
            {data.name}<span className="text-[#c778dd] animate-pulse">_</span>
          </h1>
          <p className="font-['Lato',sans-serif] text-[#9ca3af] text-base leading-relaxed max-w-md mb-8">
            {truncateText(data.summary, 200)}
          </p>

          {/* Tech stack preview */}
          <div className="flex flex-wrap gap-1.5 mb-8">
            {normalizeSkills(data.skills).slice(0, 8).map(skill => (
              <Pill key={skill} text={skill} accent />
            ))}
          </div>
        </div>

        {/* Right — stat panel */}
        <div className="flex flex-col gap-4">
          {/* Avatar block */}
          <div className="flex gap-5 items-start">
            <div className="w-20 h-24 rounded-xl border border-[#c778dd]/20 bg-gradient-to-br from-[#c778dd]/10 to-transparent overflow-hidden flex items-center justify-center shrink-0">
              {data.profileImageUrl ? (
                <img src={data.profileImageUrl} alt={data.name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-['Fira_Code',monospace] font-bold text-2xl text-[#c778dd]/30">
                  {data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              )}
            </div>
            <div>
              <p className="font-['Fira_Code',monospace] text-white font-semibold text-lg">{data.name}</p>
              <p className="font-['Fira_Code',monospace] text-[#c778dd] text-sm mt-0.5">{data.role}</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: data.experience.length, label: 'Experiences', icon: '💼' },
              { val: data.projects.length, label: 'Projects', icon: '🚀' },
              { val: normalizeSkills(data.skills).length, label: 'Skills', icon: '💻' },
              { val: data.education?.length ?? 0, label: 'Degrees', icon: '🎓' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border border-[#c778dd]/15 bg-white/[0.04] p-4 flex items-center gap-3">
                <span className="text-xl">{stat.icon}</span>
                <div>
                  <p className="font-['Fira_Code',monospace] font-bold text-xl text-white">{stat.val}</p>
                  <p className="font-['Lato',sans-serif] text-[#6b7280] text-xs">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section: Skills ───────────────────────────────────────────

function SkillsSection({ data, sectionP }: { data: PortfolioData; sectionP: number }) {
  const skills = normalizeSkills(data.skills);
  const grouped = groupSkillsByDomain(skills);
  const domains = Object.keys(grouped) as SkillDomain[];

  // Scatter: each domain card starts offset & rotated, then snaps to grid
  const scatter = useMemo(() =>
    domains.map((_, i) => ({
      tx: Math.sin(i * 2.39 + 1) * 180,
      ty: Math.cos(i * 1.61 + 0.5) * 120,
      r: Math.sin(i * 4.1) * 22,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domains.length]
  );

  const organized = sectionP > 0.42;
  const wrapOpa = Math.min(1, sectionP * 4);

  return (
    <div
      className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 overflow-hidden"
      style={{ opacity: wrapOpa, pointerEvents: wrapOpa > 0.1 ? 'auto' : 'none' }}
    >
      <div className="max-w-6xl w-full mx-auto">
        <SectionLabel label="skills" icon="💻" />

        {/* Phase indicator */}
        <div className="flex items-center gap-3 mb-8 font-['Fira_Code',monospace] text-xs text-[#6b7280]">
          <span className={`transition-colors duration-500 ${!organized ? 'text-[#c778dd]' : ''}`}>{'// scatter'}</span>
          <span>→</span>
          <span className={`transition-colors duration-500 ${organized ? 'text-[#c778dd]' : ''}`}>{'// organize'}</span>
        </div>

        {/* Grid of domain cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {domains.map((domain, idx) => {
            const s = scatter[idx];
            const delay = idx * 55;
            return (
              <div
                key={domain}
                className="rounded-xl border border-[#c778dd]/18 bg-white/[0.04] p-4 hover:border-[#c778dd]/45 transition-colors duration-200"
                style={{
                  transform: organized
                    ? 'none'
                    : `translate(${s.tx}px,${s.ty}px) rotate(${s.r}deg) scale(0.6)`,
                  opacity: organized ? 1 : 0,
                  transition: `transform 0.7s cubic-bezier(0.34,1.1,0.64,1) ${delay}ms, opacity 0.45s ease ${delay}ms`,
                }}
              >
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
                  <span className="text-sm">{DOMAIN_ICONS[domain]}</span>
                  <span className="font-['Fira_Code',monospace] text-[#c778dd] text-[9px] font-bold uppercase tracking-widest">
                    {domain}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped[domain].slice(0, 6).map(skill => {
                    const path = getSkillIconPath(skill);
                    return (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 font-['Fira_Code',monospace] text-[10px] text-[#9ca3af] bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded hover:text-white hover:border-[#c778dd]/35 transition-colors duration-150 cursor-default"
                      >
                        {path && (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5 text-[#c778dd]/50 shrink-0">
                            <path d={path} />
                          </svg>
                        )}
                        {skill}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Section: Projects ─────────────────────────────────────────

const CW = 340;
const CG = 20;

function ProjectsSection({ data, sectionP }: { data: PortfolioData; sectionP: number }) {
  const projects = data.projects;
  const pos = sectionP * (projects.length - 1);
  const offset = pos * (CW + CG);
  const wrapOpa = Math.min(1, sectionP * 5);

  return (
    <div
      className="absolute inset-0 flex flex-col justify-center overflow-hidden"
      style={{ opacity: wrapOpa, pointerEvents: wrapOpa > 0.1 ? 'auto' : 'none' }}
    >
      <div className="px-8 md:px-16 max-w-6xl mx-auto w-full mb-8">
        <SectionLabel label="projects" icon="🚀" />
        <div className="flex items-center gap-2 font-['Fira_Code',monospace] text-xs text-[#6b7280]">
          <span className="text-[#c778dd]">{Math.round(pos) + 1}</span>
          <span>/</span>
          <span>{projects.length}</span>
          <span className="ml-2">{projects[Math.round(pos)]?.name}</span>
        </div>
      </div>

      {/* Horizontal rail */}
      <div className="overflow-hidden">
        <div
          className="flex"
          style={{
            gap: `${CG}px`,
            paddingLeft: `calc(50vw - ${CW / 2}px)`,
            paddingRight: `calc(50vw - ${CW / 2}px)`,
            transform: `translateX(-${offset}px)`,
            willChange: 'transform',
          }}
        >
          {projects.map((project, idx) => {
            const dist = Math.abs(idx - pos);
            const focus = dist < 0.55;
            const scale = Math.max(0.8, 1 - dist * 0.14);
            const opa = Math.max(0.3, 1 - dist * 0.38);

            return (
              <div
                key={idx}
                className="shrink-0 transition-all duration-150"
                style={{ width: `${CW}px`, transform: `scale(${scale})`, opacity: opa, transformOrigin: 'center' }}
              >
                <div className={`rounded-2xl border overflow-hidden transition-shadow duration-300 bg-[#1e2227] ${focus ? 'border-[#c778dd]/40 shadow-[0_0_35px_rgba(199,120,221,0.14)]' : 'border-white/[0.08]'}`}>
                  {/* Code header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.03]">
                    <div className="flex gap-1.5">
                      {['#f87171','#fbbf24','#4ade80'].map(c => (
                        <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.7 }} />
                      ))}
                    </div>
                    <span className="font-['Fira_Code',monospace] text-[#6b7280] text-[10px] ml-2">{project.name.toLowerCase().replace(/ /g, '-')}.ts</span>
                  </div>
                  {/* Image */}
                  <div className="h-36 bg-gradient-to-br from-[#c778dd]/10 via-[#1a1e27] to-[#282c33] flex items-center justify-center overflow-hidden">
                    {project.imageUrl ? (
                      <img src={project.imageUrl} alt={project.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-['Fira_Code',monospace] font-bold text-4xl text-[#c778dd]/18">
                        {project.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Body */}
                  <div className="p-5">
                    <h3 className="font-['Fira_Code',monospace] font-semibold text-white text-sm mb-2">{project.name}</h3>
                    {project.techStack && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {project.techStack.slice(0, 4).map(t => <Pill key={t} text={t} accent />)}
                      </div>
                    )}
                    <p className="font-['Lato',sans-serif] text-[#9ca3af] text-xs leading-relaxed line-clamp-2">
                      {truncateText(project.description, 100)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-6">
        {projects.map((_, i) => {
          const active = Math.abs(i - pos) < 0.5;
          return (
            <div key={i} className={`rounded-full transition-all duration-300 ${active ? 'w-4 h-1 bg-[#c778dd]' : 'w-1 h-1 bg-white/20'}`} />
          );
        })}
      </div>
    </div>
  );
}

// ── Section: Experience ───────────────────────────────────────

function ExperienceSection({ data, sectionP }: { data: PortfolioData; sectionP: number }) {
  const wrapOpa = Math.min(1, sectionP * 5);

  return (
    <div
      className="absolute inset-0 overflow-y-auto flex flex-col justify-start px-8 md:px-16 py-16"
      style={{ opacity: wrapOpa, pointerEvents: wrapOpa > 0.1 ? 'auto' : 'none' }}
    >
      <div className="max-w-3xl w-full mx-auto">
        <SectionLabel label="experience" icon="💼" />

        <div className="space-y-6">
          {data.experience.map((item, idx) => {
            const delay = idx * 0.1;
            const itemP = Math.min(1, Math.max(0, (sectionP - delay) * 4));
            const isLeft = idx % 2 === 0;

            return (
              <div
                key={idx}
                style={{
                  opacity: itemP,
                  transform: `translateX(${isLeft ? (itemP - 1) * 40 : (1 - itemP) * 40}px)`,
                  transition: 'none',
                }}
              >
                <div className="flex gap-4 items-start">
                  {/* Accent line */}
                  <div className="flex flex-col items-center pt-1.5 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#c778dd]" style={{ boxShadow: itemP > 0.5 ? '0 0 10px rgba(199,120,221,0.7)' : 'none' }} />
                    {idx < data.experience.length - 1 && <div className="w-px flex-1 bg-[#c778dd]/20 mt-1" style={{ minHeight: 40 }} />}
                  </div>
                  {/* Card */}
                  <div className="flex-1 rounded-xl border border-[#c778dd]/18 bg-white/[0.04] p-5 mb-2 hover:border-[#c778dd]/40 transition-colors duration-300">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="font-['Fira_Code',monospace] font-semibold text-white text-sm">{item.role}</h3>
                        <p className="font-['Fira_Code',monospace] text-[#c778dd] text-sm mt-0.5">{item.company}</p>
                      </div>
                      <span className="font-['Fira_Code',monospace] text-[#c778dd]/65 text-[10px] border border-[#c778dd]/20 px-2.5 py-1 rounded-lg bg-[#c778dd]/6 whitespace-nowrap shrink-0">
                        {item.duration}
                      </span>
                    </div>
                    <p className="font-['Lato',sans-serif] text-[#9ca3af] text-sm leading-relaxed">
                      {truncateText(item.description, 180)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Section: Education ────────────────────────────────────────

function EducationSection({ data, sectionP }: { data: PortfolioData; sectionP: number }) {
  const wrapOpa = Math.min(1, sectionP * 5);
  return (
    <div
      className="absolute inset-0 flex flex-col justify-center px-8 md:px-16"
      style={{ opacity: wrapOpa, pointerEvents: wrapOpa > 0.1 ? 'auto' : 'none' }}
    >
      <div className="max-w-4xl w-full mx-auto">
        <SectionLabel label="education" icon="🎓" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.education?.map((edu, idx) => {
            const itemP = Math.min(1, Math.max(0, (sectionP - idx * 0.18) * 5));
            return (
              <div
                key={idx}
                className="rounded-xl border border-[#c778dd]/18 bg-white/[0.04] p-5 hover:border-[#c778dd]/40 transition-colors duration-300"
                style={{
                  opacity: itemP,
                  transform: `translateY(${(1 - itemP) * 24}px) scale(${0.96 + itemP * 0.04})`,
                  transition: `all 0.6s cubic-bezier(0.34,1.1,0.64,1) ${idx * 130}ms`,
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#c778dd]/10 border border-[#c778dd]/18 flex items-center justify-center shrink-0 text-lg">
                    🎓
                  </div>
                  <div>
                    <h3 className="font-['Fira_Code',monospace] font-medium text-white text-sm">{edu.institution}</h3>
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
            <SectionLabel label="awards" icon="🏆" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.awards.map((award, idx) => {
                const itemP = Math.min(1, Math.max(0, (sectionP - 0.3 - idx * 0.15) * 6));
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#c778dd]/18 bg-white/[0.04] p-4"
                    style={{ opacity: itemP, transform: `translateY(${(1 - itemP) * 16}px)`, transition: `all 0.5s ease ${idx * 100}ms` }}
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

// ── Root ──────────────────────────────────────────────────────

export default function PortfolioTemplate2({ data }: { data: PortfolioData }) {
  const { p, range } = useScrollP();

  const vis = {
    hero:       p < 0.20,
    skills:     p > 0.12 && p < 0.42,
    projects:   p > 0.33 && p < 0.64,
    experience: p > 0.55 && p < 0.85,
    education:  p > 0.76,
  };

  return (
    <div className="bg-[#1a1e27] text-white antialiased">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&family=Lato:wght@300;400;700;900&display=swap');`}</style>

      <div style={{ height: '600vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden">

          {/* R3F — background only */}
          <Canvas
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [0, 0, 12], fov: 60 }}
          >
            <ambientLight intensity={0.3} />
            <GeometricWeb scrollP={p} />
          </Canvas>

          {/* Content */}
          <div className="absolute inset-0">
            <HeroSection data={data} p={p} />
            {vis.skills     && <SkillsSection     data={data} sectionP={range(0.15, 0.37)} />}
            {vis.projects   && <ProjectsSection   data={data} sectionP={range(0.37, 0.59)} />}
            {vis.experience && <ExperienceSection data={data} sectionP={range(0.59, 0.80)} />}
            {vis.education  && <EducationSection  data={data} sectionP={range(0.80, 1.00)} />}
          </div>

          {/* Top nav */}
          <TopNav p={p} />
        </div>
      </div>
    </div>
  );
}