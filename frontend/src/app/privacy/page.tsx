import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata: Metadata = { title: "Privacy · PlaceMates" };

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "What we collect",
    body: (
      <ul className="list-disc space-y-2 pl-6">
        <li>From Google sign-in: your name, email address and profile picture.</li>
        <li>What you add to your profile: your resume, projects, experience, education, skills, links and the answers
          you give the profile assistant.</li>
        <li>Your job preferences (roles, cities, level) and which jobs you mark as applied or not for you.</li>
      </ul>
    ),
  },
  {
    title: "How we use your Google account",
    body: (
      <>
        <p>We ask for one Gmail permission: <strong>send email on your behalf</strong>. We use it only to send your
          daily job matches and tailored resumes from your Gmail address to your own inbox.</p>
        <p className="mt-3">We cannot read, search or delete your emails, and we never send email to anyone else.
          The permission is stored encrypted, and you can remove it at any time from your Google Account under
          Security, Third-party apps.</p>
      </>
    ),
  },
  {
    title: "How your data is used",
    body: (
      <ul className="list-disc space-y-2 pl-6">
        <li>To match you with job openings and write resumes tailored to them.</li>
        <li>Your profile text is sent to AI providers (Groq and Google Gemini) to analyse jobs and write resumes. It
          is used only to produce your results.</li>
        <li>Resumes use only facts from your profile. We never add achievements you haven&apos;t told us about.</li>
        <li>We do not sell your data, show ads, or share your profile with employers.</li>
      </ul>
    ),
  },
  {
    title: "Where it is stored",
    body: <p>In a managed Postgres database (Neon) and on our application server (Render). Job listings come from
      public job boards.</p>,
  },
  {
    title: "Deleting your data",
    body: <p>You can delete any item, fact or skill from your profile at any time. To delete your whole account and
      everything in it, open an issue on our GitHub page and we will remove it.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-[100svh] bg-mist px-5 py-12 text-ink sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" aria-label="PlaceMates home"><Logo large /></Link>
        <h1 className="mt-12 font-display text-5xl font-semibold tracking-[-0.02em]">Privacy policy</h1>
        <p className="mt-4 text-lg text-ink-soft">
          PlaceMates is a student project that matches students with tech jobs and writes tailored resumes. This page
          explains what we collect and why. Last updated 10 November 2026.
        </p>
        <div className="mt-10 space-y-10 text-lg leading-relaxed">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-2xl font-semibold">{s.title}</h2>
              <div className="mt-3 text-ink/85">{s.body}</div>
            </section>
          ))}
          <section>
            <h2 className="font-display text-2xl font-semibold">Contact</h2>
            <p className="mt-3 text-ink/85">
              Questions or deletion requests:{" "}
              <a href="https://github.com/KalpeshEragi/PlaceMates/issues" className="font-semibold text-violet underline-offset-4 hover:underline">
                github.com/KalpeshEragi/PlaceMates/issues
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
