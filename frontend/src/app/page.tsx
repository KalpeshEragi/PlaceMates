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

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`flex items-center gap-2 font-display text-lg font-semibold ${light ? "text-white" : "text-ink"}`}>
      <span className="relative h-6 w-8" aria-hidden="true">
        <span className="absolute left-0 top-0 h-6 w-6 rounded-full bg-powder-deep/80" />
        <span className="absolute right-0 top-0 h-6 w-6 rounded-full bg-peach/90 mix-blend-multiply" />
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
    <nav className="glass-light mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl py-2.5 pl-5 pr-2.5">
      <Logo />
      <div className="hidden items-center gap-8 text-sm font-medium text-ink md:flex">
        <a href="#how" className="hover:text-violet">How it works</a>
        <a href="#features" className="hover:text-violet">Features</a>
        <a href="#resume" className="hover:text-violet">Resume Intelligence</a>
      </div>
      <div className="flex items-center gap-4">
        <a href={LOGIN} className="hidden text-sm font-medium text-ink hover:text-violet sm:block">Sign in</a>
        <a href={LOGIN} className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-deep">
          Get started <Icon name="arrow" className="h-4 w-4" />
        </a>
      </div>
    </nav>
  );
}

/* Headline on a twilight sky that matches the artwork, then the artwork itself in a glowing frame. */
function Hero() {
  const art = ["hero.jpg", "hero.png", "hero.webp"].find((f) => existsSync(join(process.cwd(), "public", f)));
  return (
    <section className="hero-sky relative overflow-hidden px-4 pb-20 pt-5 sm:px-8">
      <Nav />
      <div className="mx-auto mt-16 max-w-4xl text-center sm:mt-20">
        <h1 className="rise text-balance font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]">
          Your next opportunity starts with what you&apos;ve already done.
        </h1>
        <p className="rise rise-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85">
          Find roles that match your skills, turn your real experience into tailored resumes, and know where you stand
          before you apply.
        </p>
        <p className="rise rise-2 mx-auto mt-3 max-w-2xl text-white/70">
          Your projects, internships and skills deserve more than a generic resume.
        </p>
        <div className="rise rise-3 mt-9 flex flex-col items-center gap-3">
          <a href={LOGIN}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-violet shadow-[0_14px_34px_-12px_rgb(20_16_70/0.6)] transition-colors hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Get started <Icon name="arrow" className="h-4 w-4" />
          </a>
          <p className="text-sm text-white/70">Start with the resume you already have.</p>
        </div>
      </div>

      <div className="rise rise-3 relative mx-auto mt-14 max-w-6xl">
        <div className="absolute -inset-6 rounded-[3rem] bg-peach/30 blur-3xl" aria-hidden="true" />
        <div className="relative aspect-[16/9] overflow-hidden rounded-[2rem] border border-white/40 shadow-[0_40px_90px_-30px_rgb(20_16_70/0.8)]">
          {art ? (
            <Image src={`/${art}`} alt="A student with a laptop at sunset, looking out at the path from analysing a profile to getting placed"
              fill priority sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover" />
          ) : (
            <div className="dusk-scene" aria-hidden="true" />
          )}
        </div>
      </div>
    </section>
  );
}

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
    <section id="features" className="mx-auto max-w-6xl px-5 py-24 sm:px-10">
      <h2 className="text-center font-display text-4xl font-semibold tracking-tight">A smarter way to move forward</h2>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {items.map((f) => (
          <article key={f.title} className="rounded-3xl border border-lavender bg-white p-7">
            <span className={`grid h-14 w-14 place-items-center rounded-2xl ${f.tone}`}>
              <Icon name={f.icon} className="h-6 w-6" />
            </span>
            <h3 className="mt-6 font-display text-xl font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.text}</p>
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
    <section id="resume" className="bg-white py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight">
            Your experience. Your story. Your resume.
          </h2>
          <p className="mt-5 text-lg font-semibold text-violet">
            AI should make your experience clearer, not invent a better version of it.
          </p>
          <p className="mt-2 text-ink-soft">PlaceMates builds on what you&apos;ve actually accomplished.</p>
          <ul className="mt-8 space-y-6">
            {points.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lavender text-violet">
                  <Icon name={p.icon} className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{p.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="absolute inset-4 rounded-[3rem] bg-gradient-to-br from-powder/70 via-lavender to-peach/50 blur-2xl" aria-hidden="true" />
          <div className="relative rounded-[2rem] border border-lavender bg-white p-6 shadow-[0_30px_60px_-30px_rgb(43_42_92/0.35)] sm:p-8">
            <p className="font-display text-lg font-semibold">Research Intern</p>
            <p className="text-sm text-ink-soft">Patent analysis project</p>
            <ul className="mt-5 space-y-5 text-sm leading-relaxed">
              <li>
                <p>Built a two-stage NLP pipeline that judges patent novelty, reaching 92.67% accuracy on individual claims.</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-xs text-ink-soft">
                  <Icon name="check" className="h-3.5 w-3.5 text-violet" /> From your answer: &ldquo;Evaluated on 25 real patents&rdquo;
                </p>
              </li>
              <li>
                <p>Added claim-level knowledge graphs, ensuring faster reviews for examiners.</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-peach/25 px-3 py-1 text-xs text-[#9a4a2b]">
                  Not in your profile yet. Confirm it, or it stays off your resume.
                </p>
              </li>
            </ul>
          </div>
        </div>
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
    <section id="how" className="mx-auto max-w-6xl px-5 py-24 sm:px-10">
      <h2 className="mx-auto max-w-2xl text-center font-display text-4xl font-semibold leading-tight tracking-tight">
        From your first resume to your next opportunity.
      </h2>
      <ol className="relative mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="relative rounded-3xl border border-lavender bg-white p-7">
            <span className={`grid h-11 w-11 place-items-center rounded-full font-display text-base font-semibold ${i === 3
              ? "bg-peach text-white" : "bg-lavender text-violet"}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-5 font-display text-xl font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.text}</p>
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
    <section className="hero-sky py-24 text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-10 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight">More than a resume builder.</h2>
          <p className="mt-3 text-xl text-white/80">Your personal placement companion.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.name} className="glass-light rounded-3xl p-6 text-ink">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/80 text-violet">
                <Icon name={r.icon} className="h-5 w-5" />
              </span>
              <p className="mt-4 font-display text-lg font-semibold">{r.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{r.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="px-5 py-24 text-center sm:px-10">
      <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Make your next application count.</h2>
      <p className="mx-auto mt-4 max-w-xl text-lg text-ink-soft">
        You already have the experience. Let&apos;s make sure the right opportunities see it.
      </p>
      <div className="mt-9 flex flex-col items-center gap-3">
        <a href={LOGIN} className={primaryBtn}>Get started with PlaceMates <Icon name="arrow" className="h-4 w-4" /></a>
        <p className="text-sm text-ink-soft">Upload your resume. Build your profile. Find your next opportunity.</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-10 md:grid-cols-[2fr_1fr_1fr]">
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
