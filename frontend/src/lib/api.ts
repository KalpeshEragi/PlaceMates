export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type ItemKind = "experience" | "project" | "education" | "certification" | "award";

export interface Fact {
  id: string;
  field: string;
  value: unknown;
  source: "resume" | "mcq" | "note" | "manual";
  confidence: number;
}

export interface Item {
  id: string;
  kind: ItemKind;
  title: string;
  organization: string | null;
  start_date: string | null;
  end_date: string | null;
  original_text: string | null;
  facts: Fact[];
}

export interface Basics {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  links: string[];
}

export interface Profile extends Basics {
  items: Item[];
  skills: { name: string; source: string }[];
}

export interface Question {
  n: number;
  item_id: string;
  item_title: string;
  field: string;
  text: string;
  multi: boolean;
  options: { key: string; label: string }[];
  skip_key: string;
}

export interface EnrichState {
  strength: number;
  batch: { id: string; questions: Question[] } | null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: isForm ? init.headers : { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
