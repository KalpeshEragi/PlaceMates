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

// ── Accent palette ────────────────────────────────────────────

const A = {
  accent:  '#fd6f00',
  accent2: '#e05d00',
  bg:      '#111111',
  surface: '#1a1a1a',
  border:  'rgba(253,111,0,0.18)',
  text1:   '#f5f5f5',
  text2:   '#a3a3a3',
  text3:   '#5a5a5a',
};

// ── Background 3D ─────────────────────────────────────────────

function WarmOrbs() {
  const count = 5;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const phases = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      x: (Math.random() - 0.5) * 16,
      y: (Math.random() - 0.5) * 12,
      z: -(Math.random() * 6 + 6),
      speed: 0.3 + Math.random() * 0.4,
      amp: 0.8 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
    })),
    []
  );

  useFrame(({ clock }) => {
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const p = phases[i];
      mesh.position.y = p.y + Math.sin(clock.elapsedTime * p.speed + p.phase) * p.amp;
      mesh.position.x = p.x + Math.cos(clock.elapsedTime * p.speed * 0.7 + p.phase) * (p.amp * 0.5);
    });
  });

  return (
    <group>
      {phases.map((p, i) => (
        <mesh
          key={i}
          ref={el => { refs.current[i] = el; }}
          position={[p.x, p.y, p.z]}
        >
          <sphereGeometry args={[1.2 + i * 0.3, 16, 16]} />
          <meshBasicMaterial color="#fd6f00" transparent opacity={0.025 + i * 0.008} />
        </mesh>
      ))}
    </group>
  );
}

function OrangeParticles() {
  const count = 70;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 36;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 28;
      pos[i * 3 + 2] = -(Math.random() * 14 + 3);
    }
    return pos;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = clock.elapsedTime * 0.013;
      ref.current.position.y = Math.sin(clock.elapsedTime * 0.08) * 0.3;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#fd6f00" transparent opacity={0.22} sizeAttenuation />
    </points>
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

function OrangeDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-[#fd6f00]/35 via-[#fd6f00]/15 to-transparent my-8" />;
}

function SectionTitle({ label, icon }: { label: string; icon?: string }) {
  return (
    <div className="flex items-center gap-4 mb-10">
      {icon && <span className="text-2xl">{icon}</span>}
      <h2
        className="font-['Syne',sans-serif] font-extrabold text-3xl md:text-4xl text-[#f5f5f5] leading-none"
        style={{ letterSpacing: '-0.02em' }}
      >
        {label}
      </h2>
      <div className="flex-1 h-px bg-gradient-to-r from-[#fd6f00]/30 to-transparent" />
    </div>
  );
}

function OrangeTag({ text }: { text: string }) {
  return (
    <span className="font-['Lato',sans-serif] font-semibold text-[11px] px-3 py-1 rounded-full border border-[#fd6f00]/30 text-[#fd6f00] bg-[#fd6f00]/8 whitespace-nowrap">
      {text}
    </span>
  );
}

function GrayTag({ text }: { text: string }) {
  const path = getSkillIconPath(text);
  return (
    <span className="inline-flex items-center gap-1 font-['Lato',sans-serif] text-[11px] px-2.5 py-1 rounded-full border border-white/[0.1] text-[#a3a3a3] bg-white/[0.04] hover:border-[#fd6f00]/30 hover:text-[#f5f5f5] transition-all duration-200 cursor-default whitespace-nowrap">
      {path && (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[#fd6f00]/55 shrink-0">
          <path d={path} />
        </svg>
      )}
      {text}
    </span>
  );
}

// ── Section: Hero ─────────────────────────────────────────────

function HeroSection({ data, p }: { data: PortfolioData; p: number }) {
  const fade = Math.max(0, 1 - p * 7);
  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-8 md:px-16"
      style={{ opacity: fade, transform: `translateY(${-p * 55}px)`, pointerEvents: fade > 0.05 ? 'auto' : 'none' }}
    >
      <div className="max-w-6xl w-full flex flex-col lg:flex-row items-center gap-16">
        {/* Left */}
        <div className="flex-1 max-w-2xl">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-px bg-[#fd6f00]" />
            <span className="font-['Lato',sans-serif] font-bold text-[#fd6f00] text-sm tracking-widest uppercase">Portfolio</span>
          </div>
          <h1
            className="font-['Syne',sans-serif] font-extrabold text-[clamp(3rem,7vw,5.5rem)] text-[#f5f5f5] leading-none mb-4"
            style={{ letterSpacing: '-0.03em' }}
          >
            {data.name}
          </h1>
          <h2
            className="font-['Syne',sans-serif] font-bold text-2xl md:text-3xl leading-tight mb-6"
            style={{ color: A.accent, letterSpacing: '-0.02em' }}
          >
            {data.role}
          </h2>
          <p className="font-['Lato',sans-serif] text-[#a3a3a3] text-lg leading-relaxed max-w-md mb-10">
            {truncateText(data.summary, 220)}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-8">
            {[
              { val: data.experience.length, label: 'Experiences' },
              { val: data.projects.length,   label: 'Projects' },
              { val: normalizeSkills(data.skills).length, label: 'Skills' },
            ].map((stat, i) => (
              <div key={i} className={`flex flex-col gap-0.5 ${i > 0 ? 'border-l border-white/[0.08] pl-8' : ''}`}>
                <span
                  className="font-['Syne',sans-serif] font-extrabold text-3xl text-[#fd6f00]"
                  style={{ letterSpacing: '-0.03em' }}
                >
                  {stat.val}
                </span>
                <span className="font-['Lato',sans-serif] text-[#a3a3a3] text-sm">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — avatar */}
        <div className="shrink-0">
          <div
            className="w-56 h-64 md:w-64 md:h-76 rounded-3xl overflow-hidden flex items-center justify-center border border-[#fd6f00]/20"
            style={{ background: `linear-gradient(135deg, rgba(253,111,0,0.12) 0%, #1a1a1a 100%)`, boxShadow: '0 0 60px rgba(253,111,0,0.08)' }}
          >
            {data.profileImageUrl ? (
              <img src={data.profileImageUrl} alt={data.name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-['Syne',sans-serif] font-extrabold text-7xl text-[#fd6f00]/20">
                {data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            )}
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

  const scatter = useMemo(() =>
    domains.map((_, i) => ({
      tx: Math.sin(i * 2.1 + 0.3) * 200,
      ty: Math.cos(i * 1.7 + 1.0) * 110,
      r:  Math.sin(i * 3.8) * 20,
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
        <SectionTitle label="Skills" icon="💻" />

        <p
          className="font-['Lato',sans-serif] text-[#5a5a5a] text-sm mb-8 transition-all duration-500"
          style={{ opacity: organized ? 1 : 0, transform: organized ? 'none' : 'translateY(6px)' }}
        >
          {organized ? 'Organized by domain' : 'Raw data points — assembling…'}
        </p>

        {/* Domain cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {domains.map((domain, idx) => {
            const s = scatter[idx];
            const delay = idx * 60;
            return (
              <div
                key={domain}
                className="rounded-2xl p-4 hover:border-[#fd6f00]/40 transition-colors duration-300"
                style={{
                  border: `1px solid ${A.border}`,
                  background: A.surface,
                  transform: organized
                    ? 'none'
                    : `translate(${s.tx}px,${s.ty}px) rotate(${s.r}deg) scale(0.55)`,
                  opacity: organized ? 1 : 0,
                  transition: `transform 0.8s cubic-bezier(0.34,1.1,0.64,1) ${delay}ms, opacity 0.5s ease ${delay}ms`,
                }}
              >
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
                  <span className="text-base">{DOMAIN_ICONS[domain]}</span>
                  <span className="font-['Syne',sans-serif] font-bold text-[#fd6f00] text-[10px] uppercase tracking-widest">
                    {domain}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped[domain].slice(0, 6).map(skill => (
                    <GrayTag key={skill} text={skill} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scattered ghosts */}
        {!organized && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {skills.slice(0, 20).map((skill, i) => {
              const sx = 5 + Math.abs(Math.sin(i * 1.37 + 0.5)) * 88;
              const sy = 3 + Math.abs(Math.cos(i * 2.13 + 1)) * 92;
              return (
                <div
                  key={skill}
                  className="absolute font-['Lato',sans-serif] font-semibold text-[11px] text-[#fd6f00]/40 border border-[#fd6f00]/15 rounded-full px-3 py-1 bg-[#fd6f00]/4"
                  style={{
                    left: `${sx}%`, top: `${sy}%`,
                    opacity: sectionP > 0.05 ? 0.85 - sectionP * 2 : 0,
                    transform: `translateY(${sectionP > 0.05 ? 0 : 14}px)`,
                    transition: `all 0.5s ease ${i * 38}ms`,
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

// ── Section: Projects ─────────────────────────────────────────

const PW = 370;
const PG = 22;

function ProjectsSection({ data, sectionP }: { data: PortfolioData; sectionP: number }) {
  const projects = data.projects;
  const pos = sectionP * (projects.length - 1);
  const offset = pos * (PW + PG);
  const wrapOpa = Math.min(1, sectionP * 5);

  return (
    <div
      className="absolute inset-0 flex flex-col justify-center overflow-hidden"
      style={{ opacity: wrapOpa, pointerEvents: wrapOpa > 0.1 ? 'auto' : 'none' }}
    >
      <div className="px-8 md:px-16 max-w-6xl mx-auto w-full mb-8">
        <SectionTitle label="Projects" icon="🚀" />
        <div className="flex items-center gap-3">
          {projects.map((_, i) => {
            const active = Math.abs(i - pos) < 0.5;
            return (
              <div
                key={i}
                className="font-['Lato',sans-serif] font-bold text-sm transition-all duration-300"
                style={{ color: active ? A.accent : A.text3 }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rail */}
      <div className="overflow-hidden">
        <div
          className="flex"
          style={{
            gap: `${PG}px`,
            paddingLeft: `calc(50vw - ${PW / 2}px)`,
            paddingRight: `calc(50vw - ${PW / 2}px)`,
            transform: `translateX(-${offset}px)`,
            willChange: 'transform',
          }}
        >
          {projects.map((project, idx) => {
            const dist = Math.abs(idx - pos);
            const focus = dist < 0.55;
            const scale = Math.max(0.78, 1 - dist * 0.15);
            const opa = Math.max(0.28, 1 - dist * 0.4);

            return (
              <div
                key={idx}
                className="shrink-0 transition-all duration-150"
                style={{ width: `${PW}px`, transform: `scale(${scale})`, opacity: opa, transformOrigin: 'center' }}
              >
                <div
                  className="rounded-3xl overflow-hidden transition-all duration-300"
                  style={{
                    border: `1px solid ${focus ? 'rgba(253,111,0,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    background: A.surface,
                    boxShadow: focus ? '0 0 45px rgba(253,111,0,0.1)' : 'none',
                  }}
                >
                  {/* Image */}
                  <div
                    className="h-48 flex items-center justify-center overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, rgba(253,111,0,0.12) 0%, #111 100%)' }}
                  >
                    {project.imageUrl ? (
                      <img src={project.imageUrl} alt={project.name} className="w-full h-full object-cover" />
                    ) : (
                      <span
                        className="font-['Syne',sans-serif] font-extrabold text-6xl"
                        style={{ color: 'rgba(253,111,0,0.15)', letterSpacing: '-0.04em' }}
                      >
                        {project.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-6">
                    <h3
                      className="font-['Syne',sans-serif] font-bold text-lg text-[#f5f5f5] mb-2"
                      style={{ letterSpacing: '-0.02em' }}
                    >
                      {project.name}
                    </h3>
                    {project.techStack && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {project.techStack.slice(0, 5).map(t => <OrangeTag key={t} text={t} />)}
                      </div>
                    )}
                    <p className="font-['Lato',sans-serif] text-[#a3a3a3] text-sm leading-relaxed line-clamp-2">
                      {truncateText(project.description, 110)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress line */}
      <div className="flex justify-center mt-6 px-8">
        <div className="w-48 h-0.5 bg-white/[0.08] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#fd6f00] rounded-full transition-all duration-150"
            style={{ width: `${(pos / (projects.length - 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Section: Experience ───────────────────────────────────────

function ExperienceSection({ data, sectionP }: { data: PortfolioData; sectionP: number }) {
  const wrapOpa = Math.min(1, sectionP * 5);

  return (
    <div
      className="absolute inset-0 overflow-y-auto flex flex-col justify-start px-8 md:px-16 py-14"
      style={{ opacity: wrapOpa, pointerEvents: wrapOpa > 0.1 ? 'auto' : 'none' }}
    >
      <div className="max-w-4xl w-full mx-auto">
        <SectionTitle label="Experience" icon="💼" />

        <div className="space-y-5">
          {data.experience.map((item, idx) => {
            const itemP = Math.min(1, Math.max(0, (sectionP - idx * 0.1) * 4.5));
            const isLeft = idx % 2 === 0;

            return (
              <div
                key={idx}
                style={{
                  opacity: itemP,
                  transform: `translateX(${isLeft ? (itemP - 1) * 35 : (1 - itemP) * 35}px)`,
                  transition: 'none',
                }}
              >
                <div
                  className="rounded-2xl p-5 hover:border-[#fd6f00]/35 transition-all duration-300"
                  style={{ border: '1px solid rgba(253,111,0,0.15)', background: A.surface }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: A.accent, boxShadow: itemP > 0.5 ? '0 0 10px rgba(253,111,0,0.7)' : 'none' }}
                      />
                      <div>
                        <h3
                          className="font-['Syne',sans-serif] font-bold text-[#f5f5f5] text-base"
                          style={{ letterSpacing: '-0.01em' }}
                        >
                          {item.role}
                        </h3>
                        <p className="font-['Lato',sans-serif] font-semibold text-[#fd6f00] text-sm mt-0.5">
                          {item.company}
                        </p>
                      </div>
                    </div>
                    <span
                      className="font-['Lato',sans-serif] font-bold text-[11px] px-3 py-1.5 rounded-xl border shrink-0"
                      style={{ borderColor: 'rgba(253,111,0,0.25)', color: '#fd6f00', background: 'rgba(253,111,0,0.07)' }}
                    >
                      {item.duration}
                    </span>
                  </div>
                  <p className="font-['Lato',sans-serif] text-[#a3a3a3] text-sm leading-relaxed pl-5">
                    {truncateText(item.description, 180)}
                  </p>
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
      <div className="max-w-5xl w-full mx-auto">
        <SectionTitle label="Education" icon="🎓" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.education?.map((edu, idx) => {
            const itemP = Math.min(1, Math.max(0, (sectionP - idx * 0.18) * 5));
            return (
              <div
                key={idx}
                className="rounded-2xl p-5 hover:border-[#fd6f00]/35 transition-colors duration-300"
                style={{
                  border: '1px solid rgba(253,111,0,0.15)',
                  background: A.surface,
                  opacity: itemP,
                  transform: `translateY(${(1 - itemP) * 24}px) scale(${0.96 + itemP * 0.04})`,
                  transition: `all 0.65s cubic-bezier(0.34,1.1,0.64,1) ${idx * 130}ms`,
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border"
                    style={{ border: 'rgba(253,111,0,0.2)', background: 'rgba(253,111,0,0.08)' }}
                  >
                    🎓
                  </div>
                  <div>
                    <h3 className="font-['Syne',sans-serif] font-bold text-[#f5f5f5] text-sm" style={{ letterSpacing: '-0.01em' }}>
                      {edu.institution}
                    </h3>
                    <p className="font-['Lato',sans-serif] text-[#a3a3a3] text-sm mt-0.5">{edu.degree}</p>
                    <span className="font-['Lato',sans-serif] font-bold text-[#fd6f00]/70 text-[11px] mt-1 block">{edu.duration}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {data.awards && data.awards.length > 0 && (
          <div className="mt-10">
            <SectionTitle label="Awards" icon="🏆" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.awards.map((award, idx) => {
                const itemP = Math.min(1, Math.max(0, (sectionP - 0.3 - idx * 0.15) * 6));
                return (
                  <div
                    key={idx}
                    className="rounded-2xl p-4 transition-colors duration-300"
                    style={{
                      border: '1px solid rgba(253,111,0,0.15)',
                      background: A.surface,
                      opacity: itemP,
                      transform: `translateY(${(1 - itemP) * 16}px)`,
                      transition: `all 0.55s ease ${idx * 100}ms`,
                    }}
                  >
                    <h4 className="font-['Syne',sans-serif] font-bold text-[#f5f5f5] text-sm">{award.title}</h4>
                    {award.description && (
                      <p className="font-['Lato',sans-serif] text-[#a3a3a3] text-xs mt-1.5 leading-relaxed">
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

// ── Side Nav ──────────────────────────────────────────────────

const NAVS = [
  { label: 'intro',      start: 0 },
  { label: 'skills',     start: 0.15 },
  { label: 'projects',   start: 0.37 },
  { label: 'experience', start: 0.59 },
  { label: 'education',  start: 0.80 },
];

function SideNav({ p }: { p: number }) {
  const active = NAVS.reduce((a, s, i) => (p >= s.start ? i : a), 0);
  return (
    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-end gap-2.5 z-50">
      {NAVS.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2 group">
          <span
            className="font-['Lato',sans-serif] font-bold text-[9px] uppercase tracking-widest transition-all duration-200 opacity-0 group-hover:opacity-100"
            style={{ color: active === i ? A.accent : A.text3 }}
          >
            {s.label}
          </span>
          <div
            className="rounded-full transition-all duration-350"
            style={{
              width:  active === i ? '6px' : '5px',
              height: active === i ? '20px' : '5px',
              background: active === i ? A.accent : 'rgba(255,255,255,0.15)',
              boxShadow: active === i ? `0 0 10px ${A.accent}` : 'none',
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────

export default function PortfolioTemplate3({ data }: { data: PortfolioData }) {
  const { p, range } = useScrollP();

  const vis = {
    hero:       p < 0.20,
    skills:     p > 0.12 && p < 0.42,
    projects:   p > 0.33 && p < 0.64,
    experience: p > 0.55 && p < 0.85,
    education:  p > 0.76,
  };

  return (
    <div style={{ background: A.bg }} className="text-white antialiased">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Lato:wght@300;400;700;900&display=swap');`}</style>

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
            <WarmOrbs />
            <OrangeParticles />
          </Canvas>

          {/* Content */}
          <div className="absolute inset-0">
            <HeroSection data={data} p={p} />
            {vis.skills     && <SkillsSection     data={data} sectionP={range(0.15, 0.37)} />}
            {vis.projects   && <ProjectsSection   data={data} sectionP={range(0.37, 0.59)} />}
            {vis.experience && <ExperienceSection data={data} sectionP={range(0.59, 0.80)} />}
            {vis.education  && <EducationSection  data={data} sectionP={range(0.80, 1.00)} />}
          </div>

          {/* Side nav */}
          <SideNav p={p} />
        </div>
      </div>
    </div>
  );
}