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
    <main className="grid min-h-[100svh] lg:grid-cols-2">
      {/* Illustration: full right half on large screens, a banner on top on phones. */}
      <section className="relative h-64 sm:h-80 lg:order-2 lg:h-auto lg:min-h-[100svh]">
        <Image src="/login-art.jpg" alt="A student at a laptop, ticking off finding opportunities, tailoring a resume and preparing, with getting placed next"
          fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover object-[center_35%]" />
      </section>

      <section className="relative isolate flex flex-col items-center justify-center overflow-hidden bg-white px-6 py-14 sm:px-14 lg:order-1">
        <div className="absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-lavender/70 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -right-16 -z-10 h-80 w-80 rounded-full bg-peach/20 blur-3xl" aria-hidden="true" />

        <div className="flex w-full max-w-md flex-col items-center">
          <Link href="/" aria-label="PlaceMates home"><Logo large /></Link>
          <h1 className="mt-12 font-display text-5xl font-semibold tracking-tight text-ink lg:text-6xl">Welcome back</h1>
          <p className="mt-4 text-center text-lg text-ink-soft">Sign in to continue your placement journey</p>

          <a href={`${BACKEND_URL}/auth/google/login`}
            className="mt-12 flex w-full items-center justify-center gap-3 rounded-2xl border border-lavender bg-mist px-6 py-4 text-base font-semibold text-ink shadow-[0_8px_20px_-14px_rgb(43_42_92/0.5)] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet">
            <GoogleMark /> Continue with Google
          </a>

          <p className="mt-6 text-center text-sm leading-relaxed text-ink-soft">
            PlaceMates uses your Google account so your daily jobs and tailored resumes arrive from your own Gmail, to
            you. New here? The same button creates your account.
          </p>

          <Link href="/" className="mt-12 text-sm font-semibold text-violet hover:underline">Back to home</Link>
        </div>
      </section>
    </main>
  );
}
