import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/Logo";
import { BACKEND_URL } from "@/lib/api";

export const metadata: Metadata = { title: "Sign in · PlaceMates" };

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#e9ecfb] px-4 py-10 sm:px-8">
      {/* Soft shapes behind the card, as in the design. */}
      <div className="absolute -bottom-40 -left-20 -z-10 h-96 w-[36rem] rounded-full bg-lavender/80 blur-2xl" aria-hidden="true" />
      <div className="absolute -right-24 bottom-16 -z-10 h-80 w-80 rounded-full bg-powder/50 blur-2xl" aria-hidden="true" />

      <div className="relative w-full max-w-6xl">
      <div className="absolute -left-10 -top-10 -z-10 h-36 w-36 rounded-full bg-gradient-to-br from-violet to-[#8b7cf0] sm:-left-14 sm:-top-14 sm:h-44 sm:w-44" aria-hidden="true" />
      <div className="grid w-full overflow-hidden rounded-[2.5rem] bg-white shadow-[0_40px_100px_-40px_rgb(43_42_92/0.45)] lg:grid-cols-2">
        <section className="flex flex-col items-center justify-center px-6 py-14 sm:px-14 lg:py-20">
          <Link href="/" aria-label="PlaceMates home"><Logo large /></Link>
          <h1 className="mt-10 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Welcome back</h1>
          <p className="mt-3 text-center text-lg text-ink-soft">Sign in to continue your placement journey</p>

          <a href={`${BACKEND_URL}/auth/google/login`}
            className="mt-10 flex w-full max-w-md items-center justify-center gap-3 rounded-2xl border border-lavender bg-mist px-6 py-4 text-base font-semibold text-ink shadow-[0_8px_20px_-14px_rgb(43_42_92/0.5)] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet">
            <GoogleMark /> Continue with Google
          </a>

          <p className="mt-6 max-w-md text-center text-sm leading-relaxed text-ink-soft">
            PlaceMates uses your Google account so your daily jobs and tailored resumes arrive from your own Gmail, to
            you. New here? The same button creates your account.
          </p>

          <p className="mt-10 text-sm text-ink-soft">
            <Link href="/" className="font-semibold text-violet hover:underline">Back to home</Link>
          </p>
        </section>

        <section className="relative hidden min-h-[36rem] lg:block">
          <Image src="/login-art.jpg" alt="A student at a laptop, ticking off finding opportunities, tailoring a resume and preparing, with getting placed next"
            fill priority sizes="(min-width: 1152px) 576px, 50vw" className="object-cover" />
        </section>
      </div>
      </div>
    </main>
  );
}
