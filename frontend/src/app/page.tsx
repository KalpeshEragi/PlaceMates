import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import { BACKEND_URL } from "@/lib/api";

const LOGIN = `${BACKEND_URL}/auth/google/login`;

/* Small line icons, drawn once and reused. */
function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
const PATHS = {
  chat: <><path d="M4 5h16v10H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 16v-4M12 16V8M17 16v-7" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
  hand: <><path d="M8 12V6.5a1.5 1.5 0 013 0V11M11 10V5.5a1.5 1.5 0 013 0V11M14 10V7a1.5 1.5 0 013 0v6c0 4-2.5 7-6 7s-5.5-2-6.5-4.5L3 12.5a1.5 1.5 0 012.6-1.5L8 14" /></>,
};

function Logo({ light = false, large = false }: { light?: boolean; large?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 font-display font-semibold ${large ? "text-[1.4rem]" : "text-lg"} ${light ? "text-white" : "text-ink"}`}>
      <span className={`relative ${large ? "h-8 w-11" : "h-6 w-8"}`} aria-hidden="true">
        <span className={`absolute left-0 top-0 rounded-full bg-powder-deep/80 ${large ? "h-8 w-8" : "h-6 w-6"}`} />
        <span className={`absolute right-0 top-0 rounded-full bg-peach/90 mix-blend-multiply ${large ? "h-8 w-8" : "h-6 w-6"}`} />
      </span>
      PlaceMates
    </span>
  );
}

const primaryBtn =
  "inline-flex items-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_30px_-10px_rgb(90_72_198/0.7)] transition-colors hover:bg-violet-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export default function Home() {
  return (
    <div className="bg-mist text-ink">
      <Hero />
      <Forward />
      <YourStory />
      <Journey />
      <Companion />
      <Closing />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="glass-light flex w-full items-center justify-between gap-3 rounded-[1.4rem] py-2.5 pl-4 pr-2.5 sm:py-3.5 sm:pl-7 sm:pr-3.5">
      <Logo large />
      <div className="hidden items-center gap-10 text-[0.95rem] font-medium text-ink lg:flex">
        <a href="#how" className="hover:text-violet">How it works</a>
        <a href="#features" className="hover:text-violet">Features</a>
        <a href="#resume" className="hover:text-violet">Resume Intelligence</a>
      </div>
      <div className="flex items-center gap-6">
        <a href={LOGIN} className="hidden text-[0.95rem] font-medium text-ink hover:text-violet sm:block">Sign in</a>
        <a href={LOGIN} className="inline-flex items-center gap-2 whitespace-nowrap rounded-2xl bg-violet px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_26px_-10px_rgb(90_72_198/0.8)] hover:bg-violet-deep sm:px-6 sm:py-3.5 sm:text-[0.95rem]">
          Get started <Icon name="arrow" className="h-4 w-4" />
        </a>
      </div>
    </nav>
  );
}

/* The hero artwork fills the screen. Text hugs the left edge and scales with the screen,
   so it stays clear of the path illustrated on the right. */
function Hero() {
  const art = ["hero.jpg", "hero.png", "hero.webp"].find((f) => existsSync(join(process.cwd(), "public", f)));
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden px-4 pb-14 pt-5 sm:px-8 lg:px-14">
      {art ? (
        <Image src={`/${art}`} alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[0%_center]" />
      ) : (
        <div className="dusk-scene -z-20" aria-hidden="true" />
      )}
      <div className="hero-shade -z-10" aria-hidden="true" />

      <Nav />
      <div className="flex flex-1 items-center py-12">
        <div className="max-w-[36rem]">
          <p className="rise flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.32em] text-white/85">
            Your AI placement companion <span className="h-px w-16 bg-white/60" aria-hidden="true" />
          </p>
          <h1 className="rise mt-6 font-display text-[clamp(3.4rem,6.2vw,6.6rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-white drop-shadow-[0_4px_30px_rgb(20_16_70/0.45)]">
            Build.
            <br />
            Apply.
            <br />
            <span className="bg-gradient-to-r from-[#d9d0ff] via-[#c5b3ff] to-peach bg-clip-text text-transparent">Get placed.</span>
          </h1>
          <p className="rise rise-2 mt-7 max-w-md text-lg leading-relaxed text-white/90 drop-shadow-[0_1px_10px_rgb(20_16_70/0.55)] sm:text-xl">
            Jobs that fit what you&apos;ve really done, and a tailored resume for each one.
          </p>
          <div className="rise rise-3 mt-9 flex flex-wrap items-center gap-3">
            <a href={LOGIN}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-[0.95rem] font-semibold text-violet shadow-[0_16px_40px_-14px_rgb(20_16_70/0.7)] transition-colors hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Get started <Icon name="arrow" className="h-4 w-4" />
            </a>
            <a href="#how"
              className="inline-flex items-center rounded-2xl border border-white/40 bg-white/10 px-7 py-4 text-[0.95rem] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20">
              See how it works
            </a>
          </div>
          <p className="rise rise-3 mt-4 text-sm text-white/75">Start with the resume you already have.</p>
        </div>
      </div>
    </section>
  );
}

/* One content width for every section below the hero: wide enough to fill large screens. */
const WRAP = "mx-auto w-full max-w-[120rem] px-5 sm:px-8 lg:px-14";
const H2 = "font-display text-[clamp(2.4rem,4vw,4rem)] font-semibold leading-[1.05] tracking-[-0.02em]";

function Forward() {
  const items = [
    { icon: "search", tone: "bg-powder/45 text-[#3d6a9e]", title: "Discover opportunities that fit",
      text: "Relevant tech openings matched to your skills, experience, preferred roles and location. Spend less time searching and more time finding the right opportunities." },
    { icon: "doc", tone: "bg-lavender text-violet", title: "Make every application count",
      text: "Create a resume tailored to each opportunity, highlighting the experience and projects that matter most." },
    { icon: "chart", tone: "bg-peach/30 text-peach-deep", title: "Know what needs improvement",
      text: "Get actionable feedback on your resume, identify skill gaps and understand how to strengthen your profile." },
  ] as const;
  return (
    <section id="features" className={`${WRAP} py-20 lg:py-28`}>
      <h2 className={H2}>A smarter way to move forward</h2>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {items.map((f) => (
          <article key={f.title} className="rounded-[2rem] border border-lavender bg-white p-8 lg:p-10">
            <span className={`grid h-16 w-16 place-items-center rounded-2xl ${f.tone}`}>
              <Icon name={f.icon} className="h-7 w-7" />
            </span>
            <h3 className="mt-8 font-display text-2xl font-semibold lg:text-[1.75rem]">{f.title}</h3>
            <p className="mt-3 text-base leading-relaxed text-ink-soft lg:text-lg">{f.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function YourStory() {
  const points = [
    { icon: "check", title: "Grounded in your experience",
      text: "Every resume is built from your profile, projects, internships and the information you've provided." },
    { icon: "shield", title: "No invented achievements",
      text: "Unsupported metrics, skills and accomplishments are never presented as facts." },
    { icon: "hand", title: "You stay in control",
      text: "Review suggestions, answer questions and approve changes before using your resume." },
  ] as const;
  return (
    <section id="resume" className="bg-white">
      <div className={`${WRAP} grid gap-12 py-20 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:py-28`}>
        <div className="lg:sticky lg:top-10 lg:self-start">
          <h2 className={H2}>Your experience. Your story. Your resume.</h2>
          <p className="mt-6 font-display text-2xl font-medium leading-snug text-violet lg:text-3xl">
            AI should make your experience clearer, not invent a better version of it.
          </p>
          <p className="mt-4 text-lg text-ink-soft">PlaceMates builds on what you&apos;ve actually accomplished.</p>
        </div>
        <ul className="space-y-5">
          {points.map((p) => (
            <li key={p.title} className="flex gap-6 rounded-[2rem] border border-lavender bg-mist/60 p-8">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-lavender text-violet">
                <Icon name={p.icon} className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-display text-2xl font-semibold">{p.title}</span>
                <span className="mt-2 block text-base leading-relaxed text-ink-soft lg:text-lg">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Journey() {
  const steps = [
    { title: "Understand your profile",
      text: "Start with your existing resume. PlaceMates identifies your experience, strengths and missing information." },
    { title: "Discover your matches",
      text: "Explore opportunities that align with your actual skills, experience and career preferences." },
    { title: "Build for each opportunity",
      text: "Generate tailored resumes that bring relevant experience to the forefront." },
    { title: "Review and improve",
      text: "Get recruiter-style feedback, understand what's missing and make every application stronger." },
  ];
  return (
    <section id="how" className={`${WRAP} py-20 lg:py-28`}>
      <h2 className={`${H2} max-w-3xl`}>From your first resume to your next opportunity.</h2>
      <ol className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-[2rem] border border-lavender bg-white p-8 lg:p-9">
            <span className={`font-display text-5xl font-semibold ${i === 3 ? "text-peach-deep" : "text-violet/80"}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-6 font-display text-2xl font-semibold">{s.title}</h3>
            <p className="mt-3 text-base leading-relaxed text-ink-soft lg:text-lg">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Companion() {
  const rows = [
    { icon: "chat", name: "Profile Assistant", text: "Build a more complete picture of your experience." },
    { icon: "search", name: "Job Discovery", text: "Find relevant opportunities without endless searching." },
    { icon: "doc", name: "Resume Intelligence", text: "Tailor your resume to individual job descriptions." },
    { icon: "chart", name: "Resume Review", text: "Identify weaknesses and improve your applications." },
  ] as const;
  return (
    <section className="hero-sky text-white">
      <div className={`${WRAP} grid items-center gap-12 py-20 lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:py-28`}>
        <div>
          <h2 className={H2}>More than a resume builder.</h2>
          <p className="mt-5 font-display text-2xl text-white/85 lg:text-3xl">Your personal placement companion.</p>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.name} className="glass-light rounded-[2rem] p-8 text-ink">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/80 text-violet">
                <Icon name={r.icon} className="h-6 w-6" />
              </span>
              <p className="mt-6 font-display text-2xl font-semibold">{r.name}</p>
              <p className="mt-2 text-base leading-relaxed text-ink-soft lg:text-lg">{r.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className={`${WRAP} py-24 text-center lg:py-32`}>
      <h2 className={`${H2} mx-auto max-w-4xl`}>Make your next application count.</h2>
      <p className="mx-auto mt-5 max-w-2xl text-xl text-ink-soft">
        You already have the experience. Let&apos;s make sure the right opportunities see it.
      </p>
      <div className="mt-10 flex flex-col items-center gap-4">
        <a href={LOGIN} className={`${primaryBtn} px-8 py-4 text-base`}>
          Get started with PlaceMates <Icon name="arrow" className="h-4 w-4" />
        </a>
        <p className="text-base text-ink-soft">Upload your resume. Build your profile. Find your next opportunity.</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className={`${WRAP} grid gap-10 py-16 md:grid-cols-[2fr_1fr_1fr]`}>
        <div>
          <Logo light />
          <p className="mt-4 font-semibold">Your AI-powered placement companion.</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/70">
            Helping students and freshers discover opportunities and present their best work.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Product</p>
          <ul className="mt-3 space-y-2 text-white/70">
            <li><a href="#how" className="hover:text-white">How it works</a></li>
            <li><a href="#features" className="hover:text-white">Features</a></li>
            <li><a href="#resume" className="hover:text-white">Resume Intelligence</a></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Project</p>
          <ul className="mt-3 space-y-2 text-white/70">
            <li><a href="https://github.com/KalpeshEragi/PlaceMates" target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a></li>
            <li><a href={LOGIN} className="hover:text-white">Sign in</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
