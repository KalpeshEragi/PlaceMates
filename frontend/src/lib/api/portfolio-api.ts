const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface SetupPortfolioData {
  email: string;
  github?: string;
  linkedin?: string;
  website?: string;
  photoBase64?: string;
}

export interface SetupPortfolioResponse {
  success: boolean;
  slug: string;
}

export async function setupPortfolio(
  data: SetupPortfolioData
): Promise<SetupPortfolioResponse> {
  const response = await fetch(`${API_BASE}/portfolio/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });

  const body = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw new Error(
      body.error || "You are not authenticated. Please log in again."
    );
  }

  if (!response.ok) {
    throw new Error(
      body.error || "Failed to set up portfolio"
    );
  }

  return body as SetupPortfolioResponse;
}
