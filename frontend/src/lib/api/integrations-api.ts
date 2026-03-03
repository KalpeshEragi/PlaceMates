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

export type IntegrationStatus = {
  github_connected: boolean;
  linkedin_uploaded: boolean;
};

export const integrationsApi = {
  async getStatus(): Promise<IntegrationStatus> {
    const response = await fetch(`${API_BASE}/integrations/status`, {
      headers: {
        ...authHeaders(),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Failed to load integration status");
    }

    return response.json();
  },

  redirectToGithubConnect() {
    const token = getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    window.location.href = `${API_BASE}/auth/github`;
  },

  async uploadLinkedinZip(file: File): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/linkedin/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "LinkedIn upload failed");
    }
  },
};
