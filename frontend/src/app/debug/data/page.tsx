"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
}

export default function DebugDataPage() {
    const [githubData, setGithubData] = useState<unknown>(null);
    const [linkedinData, setLinkedinData] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchData() {
            const token = getToken();
            if (!token) {
                setError("Not authenticated. Please log in first.");
                setLoading(false);
                return;
            }

            const headers = { Authorization: `Bearer ${token}` };

            try {
                const [ghRes, liRes] = await Promise.all([
                    fetch(`${API_BASE}/github/data`, { headers }),
                    fetch(`${API_BASE}/linkedin/data`, { headers }),
                ]);

                const ghData = ghRes.ok ? await ghRes.json() : { error: `${ghRes.status} ${ghRes.statusText}` };
                const liData = liRes.ok ? await liRes.json() : { error: `${liRes.status} ${liRes.statusText}` };

                setGithubData(ghData);
                setLinkedinData(liData);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to fetch data");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    if (loading) return <pre>Loading...</pre>;
    if (error) return <pre style={{ color: "red" }}>Error: {error}</pre>;

    return (
        <div style={{ padding: "20px", fontFamily: "monospace", fontSize: "13px" }}>
            <h1>Debug: Collected Data</h1>

            <h2>GitHub Data</h2>
            <pre style={{ background: "#111", color: "#0f0", padding: "16px", overflow: "auto", maxHeight: "500px" }}>
                {JSON.stringify(githubData, null, 2)}
            </pre>

            <h2>LinkedIn Data</h2>
            <pre style={{ background: "#111", color: "#0f0", padding: "16px", overflow: "auto", maxHeight: "500px" }}>
                {JSON.stringify(linkedinData, null, 2)}
            </pre>
        </div>
    );
}
