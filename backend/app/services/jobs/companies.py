"""Company job boards to pull from (public, keyless APIs).

Each slug was checked on 2026-11-09 to return India or remote roles.
To add a company: find its careers page URL (boards.greenhouse.io/<slug>,
jobs.lever.co/<slug>, jobs.ashbyhq.com/<slug>) and add the slug here.
"""

BOARDS: dict[str, list[str]] = {
    "greenhouse": [
        "samsara", "gitlab", "zscaler", "coinbase", "databricks", "stripe", "twilio", "okta",
        "mongodb", "datadog", "inmobi", "rubrik", "dropbox", "airbnb", "hackerrank", "elastic",
        "druva", "groww", "figma", "slice", "cloudflare",
    ],
    "lever": ["paytm", "meesho", "zeta", "fampay", "cred"],
    "ashby": ["supabase", "sarvam", "openai", "ramp", "posthog", "smallest", "notion", "replit"],
}
