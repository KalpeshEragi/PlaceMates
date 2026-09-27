const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...authHeaders(),
      ...(options.headers as Record<string, string>),
    },
    cache: "no-store",
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.error as string) || `API error ${res.status}`);
  }
  return body as T;
}

export const resumeApi = {
  uploadResume: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ success: boolean; message: string }>("/resume/upload", {
      method: "POST",
      body: formData,
    });
  },

  analyzeResume: async () => {
    return request<{ success: boolean; status: string; message: string }>("/resume/analyze", {
      method: "POST",
    });
  },

  getResumeData: async () => {
    return request<any>("/resume/data", {
      method: "GET",
    });
  },
};
