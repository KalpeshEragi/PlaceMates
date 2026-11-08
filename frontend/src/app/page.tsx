import { BACKEND_URL } from "@/lib/api";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <h1 className="text-4xl font-semibold tracking-tight">PlaceMates</h1>
      <p className="mt-3 text-lg text-zinc-600">
        Upload your resume once. Every morning, get five fresh jobs that fit you, each with a
        resume tailored to it.
      </p>
      <a
        href={`${BACKEND_URL}/auth/google/login`}
        className="mt-8 inline-flex w-fit items-center rounded-lg bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-700"
      >
        Continue with Google
      </a>
      <p className="mt-3 text-sm text-zinc-500">
        We ask permission to send email from your Gmail, so your daily resumes arrive from you, to you.
      </p>
    </main>
  );
}
