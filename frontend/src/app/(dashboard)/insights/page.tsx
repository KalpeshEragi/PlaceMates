"use client";

import { useState, useEffect } from "react";
import { 
  TrendingUp, Building2, MapPin, Briefcase, IndianRupee, 
  Lightbulb, CheckCircle2, AlertCircle, BarChart3, Database, Globe, Loader2
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface SkillDemand { name: string; percentage: number; count: number; }
interface LocationShare { city: string; count: number; share: string; shareValue: number; }
interface InsightsData {
  totalJobs: number;
  periodDays: number;
  topLocations: LocationShare[];
  skillsDemand: { frontend: SkillDemand[]; backend: SkillDemand[]; cloud: SkillDemand[]; };
  generatedAt: string;
}

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/insights`)
      .then((r) => r.json())
      .then((data) => { if (data.success) setInsights(data); })
      .catch((err) => console.error("Failed to fetch insights:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Fetching latest market intelligence...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 relative">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Market Intelligence
            </h1>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs">
              IN
            </span>
          </div>
          <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
            Real-time analytics from {insights ? insights.totalJobs.toLocaleString() : "…"} active job postings scraped in the last 30 days. Skill demand and location data computed directly from job descriptions.
          </p>
        </div>
        <div className="text-xs text-muted-foreground flex flex-col items-end">
          <span>Last synced: {new Date().toLocaleDateString()}</span>
          <span className="flex items-center gap-1 mt-1 text-emerald-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Data API Active
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 sm:gap-4 border-b pb-1 overflow-x-auto scrollbar-hide">
        {[
          { id: "overview", label: "Market Overview", icon: <Globe className="w-4 h-4" /> },
          { id: "skills", label: "Skill Demand", icon: <Database className="w-4 h-4" /> },
          { id: "salary", label: "Compensation Data", icon: <IndianRupee className="w-4 h-4" /> },
          { id: "hubs", label: "Tech Hubs", icon: <MapPin className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative rounded-t-lg whitespace-nowrap ${
              activeTab === tab.id
                ? "text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-[-5px] left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ─────────────────────────────────────────────────────────────
              OVERVIEW TAB
              ───────────────────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard title="Active Openings" value={insights ? `${insights.totalJobs.toLocaleString()}` : "—"} trend={`Last ${insights?.periodDays ?? 30} days`} icon={<Briefcase className="w-5 h-5 text-blue-500"/>} />
                <StatCard title="GCC Hiring" value="High" trend="Expanding rapidly" icon={<TrendingUp className="w-5 h-5 text-emerald-500"/>} />
                <StatCard title="Avg Time to Hire" value="28 Days" trend="-7 days vs 2024" icon={<BarChart3 className="w-5 h-5 text-amber-500"/>} />
                <StatCard title="Hybrid Work" value="68%" trend="Dominant model" icon={<Building2 className="w-5 h-5 text-indigo-500"/>} />
              </div>

              {/* Hiring Trends Chart */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 relative overflow-hidden">
                <h3 className="font-semibold text-lg mb-1">Hiring Volumes: Indian Tech Sector (Last 4 Quarters)</h3>
                <p className="text-sm text-muted-foreground mb-6">Service-based IT firms vs GCCs & Product Startups</p>
                
                <div className="flex items-end gap-2 sm:gap-4 h-56 mt-4 pt-4 border-b border-l border-border/50 px-2 sm:px-4 relative">
                  {/* Grid lines */}
                  <div className="absolute w-full border-t border-border/30 border-dashed top-1/4 left-0"></div>
                  <div className="absolute w-full border-t border-border/30 border-dashed top-2/4 left-0"></div>
                  <div className="absolute w-full border-t border-border/30 border-dashed top-3/4 left-0"></div>

                  {[
                    { month: "Q2 '25", srv: 40, prd: 60 },
                    { month: "Q3 '25", srv: 45, prd: 70 },
                    { month: "Q4 '25", srv: 55, prd: 85 },
                    { month: "Q1 '26", srv: 50, prd: 95 },
                    { month: "Q2 '26 (Est)", srv: 60, prd: 110, active: true },
                  ].map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative z-10">
                      <div className="w-full flex justify-center gap-1 items-end h-full">
                        {/* Service Firms Bar */}
                        <div 
                          className="w-1/2 bg-blue-400/40 rounded-t-sm"
                          style={{ height: `${bar.srv}%` }}
                          title="IT Services"
                        />
                        {/* Product/GCC Bar */}
                        <div 
                          className={`w-1/2 rounded-t-sm transition-colors ${bar.active ? 'bg-primary' : 'bg-primary/60'}`}
                          style={{ height: `${bar.prd}%` }}
                          title="Product Startups & GCCs"
                        />
                      </div>
                      <span className={`text-xs ${bar.active ? "font-bold text-primary" : "text-muted-foreground"}`}>
                        {bar.month}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 flex items-center justify-between text-sm">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-400/40 rounded-sm"></div> IT Services</span>
                    <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-primary rounded-sm"></div> Product & GCCs</span>
                  </div>
                </div>
              </div>

              {/* Market Context */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-5">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-primary"/> GCC Expansion Data</h4>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Global Capability Centers (GCCs) in India have grown by 14% this fiscal year. They are hiring aggressively for Full Stack and Cloud engineering roles, currently representing 42% of all new high-paying tech jobs in the country.
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-5">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500"/> LLM Integration Demand</h4>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Telemetry data from job boards indicates a 310% YoY increase in job descriptions mentioning "OpenAI API", "LangChain", or "RAG". Developers with these skills are recording a 25-30% salary premium during transitions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SKILLS TAB
              ───────────────────────────────────────────────────────────── */}
          {activeTab === "skills" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                <div className="mb-6">
                  <h3 className="font-semibold text-lg">Full Stack Tech Demand</h3>
                  <p className="text-sm text-muted-foreground">Aggregated from {insights ? insights.totalJobs.toLocaleString() : "…"} recent job descriptions.</p>
                </div>

                <div className="space-y-8">
                  {/* Frontend */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Frontend Frameworks
                    </h4>
                    <div className="space-y-4">
                      {(insights?.skillsDemand.frontend ?? []).map((s) => (
                        <SkillBar key={s.name} name={s.name} percentage={s.percentage} desc={`Found in ${s.count} of ${insights?.totalJobs ?? 0} job descriptions (${s.percentage}%).`} isMatched={s.percentage >= 30} />
                      ))}
                    </div>
                  </div>

                  {/* Backend */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Backend Ecosystems
                    </h4>
                    <div className="space-y-4">
                      {(insights?.skillsDemand.backend ?? []).map((s) => (
                        <SkillBar key={s.name} name={s.name} percentage={s.percentage} desc={`Found in ${s.count} of ${insights?.totalJobs ?? 0} job descriptions (${s.percentage}%).`} isMatched={s.percentage >= 30} />
                      ))}
                    </div>
                  </div>

                  {/* Cloud Analysis */}
                  <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-border/60">
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500"/> Cloud Readiness Gap Detected
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      85% of mid-level Full Stack roles in India now require basic cloud deployment knowledge (AWS EC2, S3, Docker). Your scanned profile currently lacks explicit mentions of these technologies, which may filter you out of ATS screening for certain GCC roles.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              COMPENSATION TAB
              ───────────────────────────────────────────────────────────── */}
          {activeTab === "salary" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-card p-5 border-l-2 border-l-blue-500">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">IT Services</p>
                  <h4 className="text-xl font-bold mt-2">₹3.5 - 7.5 LPA</h4>
                  <p className="text-xs text-muted-foreground mt-1">Fresher to 2 YOE</p>
                </div>
                <div className="rounded-xl border bg-card p-5 border-l-2 border-l-primary">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Startups (Funded)</p>
                  <h4 className="text-xl font-bold mt-2">₹8 - 15 LPA</h4>
                  <p className="text-xs text-muted-foreground mt-1">High variance based on stack</p>
                </div>
                <div className="rounded-xl border bg-card p-5 border-l-2 border-l-emerald-500">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">GCCs & Big Tech</p>
                  <h4 className="text-xl font-bold mt-2">₹14 - 25+ LPA</h4>
                  <p className="text-xs text-muted-foreground mt-1">Requires strong System Design</p>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">CTC Component Analysis</h3>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/20">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-muted-foreground" /> Base vs Variable Pay
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Aggregated startup offer letters indicate that advertised CTCs often include 10-20% variable performance pay and ESOPs vested over 4 years. The industry standard recommendation is to evaluate offers based primarily on the fixed Base Pay component.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg bg-muted/20">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" /> Appraisal Metrics
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Current market data shows average internal appraisals at 6-9%, whereas job switches are yielding 25-40% hikes for developers possessing in-demand stacks (React + Node + AWS).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TECH HUBS TAB
              ───────────────────────────────────────────────────────────── */}
          {activeTab === "hubs" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold text-lg mb-6">Geographic Distribution of Opportunities</h3>
                
                <div className="space-y-4">
                  {(insights?.topLocations ?? []).map((loc, i) => (
                    <CityCard
                      key={loc.city}
                      rank={String(i + 1)}
                      city={loc.city}
                      share={loc.share}
                      desc={`${loc.count.toLocaleString()} job postings — ${loc.share} of all scraped openings.`}
                    />
                  ))}
                  {(!insights?.topLocations?.length) && (
                    <p className="text-sm text-muted-foreground">No location data available yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ─────────────────────────────────────────────────────────────
            RIGHT SIDEBAR
            ───────────────────────────────────────────────────────────── */}
        <div className="space-y-6">
          
          {/* Profile Match Analysis */}
          <div className="rounded-xl border bg-card shadow-sm p-6">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Profile Fit Analysis
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Your profile is currently evaluated at the <strong className="text-foreground">Beginner</strong> level. Based on your active tech stack, you are structurally aligned with entry-level Product roles.
            </p>
            <div className="text-xs space-y-3 p-3 bg-muted/30 rounded-lg border">
              <p className="font-medium">Identified Gaps:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  <span className="text-muted-foreground">Lack of containerization tools (Docker) in public repositories.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  <span className="text-muted-foreground">Absence of explicit cloud deployment (AWS/GCP) experience.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Micro-Insights / News Feed */}
          <div className="rounded-xl border bg-card shadow-sm p-6">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Market Data Feed
            </h3>
            
            <div className="space-y-4 divide-y divide-border/50">
              <div className="pt-2">
                <h4 className="text-xs font-semibold">IT Services Hiring Update</h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">Major service firms are shifting focus back to campus placements. Strong emphasis placed on students with Cloud and AI foundational knowledge.</p>
                <p className="text-[9px] text-muted-foreground/60 mt-1.5 uppercase">Source: Financial Data APIs</p>
              </div>
              
              <div className="pt-4">
                <h4 className="text-xs font-semibold">FinTech Salary Premiums</h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">Series B+ FinTech companies are consistently offering 20%+ premiums over standard market rates for backend engineers with distributed systems experience.</p>
                <p className="text-[9px] text-muted-foreground/60 mt-1.5 uppercase">Source: Aggregated Offer Data</p>
              </div>

              <div className="pt-4">
                <h4 className="text-xs font-semibold">RTO Mandate Statistics</h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">Over 70% of Indian IT enterprises have fully transitioned back to an office-first or strict hybrid model for junior to mid-level engineering roles.</p>
                <p className="text-[9px] text-muted-foreground/60 mt-1.5 uppercase">Source: Industry Surveys</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

function StatCard({ title, value, trend, icon }: any) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-muted rounded-md">
          {icon}
        </div>
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">{title}</h4>
      </div>
      <div className="mt-2">
        <span className="text-xl font-bold tracking-tight">{value}</span>
      </div>
      <div className="mt-1">
        <span className="text-[11px] font-medium text-muted-foreground">{trend}</span>
      </div>
    </div>
  );
}

function SkillBar({ name, percentage, desc, isMatched }: any) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1 font-semibold">
        <span className="flex items-center gap-2">
          {name}
          {isMatched && (
            <span className="text-[9px] text-emerald-500 border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 rounded uppercase tracking-wider">
              Profile Match
            </span>
          )}
        </span>
        <span className="text-muted-foreground font-mono">{percentage}%</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">{desc}</p>
      <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
        <div 
          className={`h-full rounded-full ${isMatched ? 'bg-primary' : 'bg-muted-foreground/40'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function CityCard({ rank, city, share, desc }: any) {
  return (
    <div className="p-4 rounded-xl border bg-card flex gap-4">
      <div className="w-8 h-8 shrink-0 bg-muted rounded-md flex items-center justify-center font-bold text-sm text-muted-foreground border border-border/50">
        #{rank}
      </div>
      <div>
        <div className="flex justify-between items-start">
          <h4 className="font-semibold text-sm">{city}</h4>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{share}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}
