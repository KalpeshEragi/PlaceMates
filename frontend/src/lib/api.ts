export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type ItemKind = "experience" | "project" | "education" | "research" | "certification" | "award" | "other";

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

export interface Entity {
  id: string;
  title: string;
  section: string;
  section_label: string;
  section_index: number;
  sections_total: number;
  type: string;
}

export interface Option {
  key: string;
  label: string;
}

export interface AgentQuestion {
  topic_key: string;
  topic_label: string;
  lead_in: string;
  kind: "single" | "multi" | "number" | "short_text" | "long_text";
  text: string;
  options: Option[];
  allow_other: boolean;
  unit: string | null;
}

export type Screen =
  | {
      screen: "topics";
      entity: Entity;
      understanding: string | null;
      topics: { key: string; label: string; why: string | null; info_state: string }[];
      more_available: boolean;
      notices: string[];
      completeness: { complete: number; total: number };
    }
  | {
      screen: "question";
      entity: Entity;
      question: AgentQuestion;
      history: { q: string; a: string }[];
      notices: string[];
      selected_topics: { key: string; label: string; current: boolean }[];
    }
  | {
      screen: "summary";
      entity: Entity;
      saved: string[];
      discussed: string[];
      skipped: string[];
      unexplored: string[];
      next_title: string | null;
      notices: string[];
    }
  | { screen: "done"; notices: string[] };

export interface SectionView {
  key: string;
  label: string;
  entities: { id: string; title: string; status: string; complete: number; total: number }[];
}

export interface EnrichView {
  header: { strength: number; reasons: string[]; summary: string } | null;
  session: { status: "none" | "active" | "paused" | "done"; screen: Screen | null };
  sections: SectionView[];
  failed_answers: number;
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

export interface Preferences {
  target_roles: string[];
  locations: string[];
  remote_ok: boolean;
  experience_level: "intern" | "entry" | "mid";
  job_types: ("full_time" | "internship")[];
  min_salary_lpa: number | null;
}

export interface Match {
  id: string;
  rank: number;
  score: number;
  reasons: string[];
  status: "shortlisted" | "applied" | "dismissed" | "sent";
  resume: ResumeBrief | null;
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    remote: boolean;
    seniority: string;
    source: string;
    posted_at: string;
    apply_url: string;
    description: string;
  };
}

export type ResumeStatus = "running" | "ready" | "failed" | "pending";

export interface ResumeBrief {
  status: ResumeStatus;
  score: number | null;
  band: string | null;
}

export interface Reviewer {
  id: string;
  role: string;
  verdict?: {
    decision: "shortlist" | "maybe" | "reject";
    scores: Record<string, number>;
    one_line: string;
  };
  error?: string;
}

export interface ResumeDetail {
  status: ResumeStatus;
  score: number | null;
  error: string | null;
  text: string | null;
  score_parts: {
    score: number;
    band: string;
    ats: number;
    panel: number;
    truth_penalty: number;
    shortlist_votes: Record<string, number>;
  } | null;
  ats: {
    score: number;
    tier: string;
    grade: string;
    sub_scores: Record<string, number>;
    required_missing: string[];
    note: string;
  } | null;
  panel: { reviewers: Reviewer[]; votes: Record<string, number> } | null;
  interview_prep: string[];
  ask_student: string[];
  seconds: number | null;
}

export interface Digest {
  date: string;
  status: "running" | "sent" | "failed" | "skipped";
  stats: Record<string, number>;
  error: string | null;
  sent_at: string | null;
}
