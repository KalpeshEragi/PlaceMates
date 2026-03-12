/* ──────────────────────────────────────────────────────────
 * Connect API — LinkedIn validation & ZIP upload
 * ────────────────────────────────────────────────────────── */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function authHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export const connectApi = {
    /**
     * POST /linkedin/validate-url
     * Validate and scrape a public LinkedIn profile.
     * NOTE: Currently disabled due to Apify API limit exhaustion.
     */
    async validateLinkedInUrl(url: string) {
        const res = await fetch(`${API_BASE}/linkedin/validate-url`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify({ url }),
        });

        const data = await res.json();

        if (!res.ok) {
            return {
                success: false,
                error: data.error || `API error ${res.status}`,
                isPrivate: data.isPrivate || false,
            };
        }

        return { success: true, profile: data.profile };
    },

    /**
     * POST /linkedin/upload-zip
     * Upload a LinkedIn data export ZIP file.
     */
    async uploadLinkedInZip(file: File) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API_BASE}/linkedin/upload-zip`, {
                method: "POST",
                headers: {
                    ...authHeaders(),
                },
                body: formData,
            });

            let data;
            try {
                data = await res.json();
            } catch {
                // Server returned non-JSON (e.g. HTML 404 page)
                return {
                    success: false,
                    error: `Server error ${res.status}: unexpected response`,
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    error: data.error || `API error ${res.status}`,
                };
            }

            return { success: true, profile: data.profile };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Network error",
            };
        }
    },
};
