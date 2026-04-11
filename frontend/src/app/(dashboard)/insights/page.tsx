"use client";

import { useState } from "react";

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-primary bg-clip-text text-transparent">
            Industrial Insights
          </h1>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm animate-pulse">
            📈
          </span>
        </div>
        <p className="text-muted-foreground mt-2 text-lg">
          Real-time Indian market analysis tailored to your preferences: <strong className="text-foreground">Full Stack Developer</strong>.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b pb-1">
        {[
          { id: "overview", label: "Overview" },
          { id: "skills", label: "Skill Demand" },
          { id: "salary", label: "Compensation" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-all relative ${
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-[-5px] left-0 right-0 h-0.5 bg-primary rounded-full layout-auto" />
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content - 2 Columns wide */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard 
              title="Market Readiness" 
              value="84%" 
              trend="+5% this month"
              icon="🎯"
              color="text-emerald-500"
            />
            <StatCard 
              title="Active Openings" 
              value="12,450" 
              trend="High Demand"
              icon="💼"
              color="text-blue-500"
            />
            <StatCard 
              title="Median Salary" 
              value="₹14.5 LPA" 
              trend="Top 20% percentile"
              icon="💰"
              color="text-amber-500"
            />
            <StatCard 
              title="Competition" 
              value="Moderate" 
              trend="Favorable ratio"
              icon="⚖️"
              color="text-indigo-500"
            />
          </div>

          {/* Hiring Trends Chart (Mock) */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />
            <h3 className="font-semibold text-xl mb-6">Hiring Trends: Full Stack</h3>
            <div className="flex items-end gap-2 sm:gap-4 h-48 mt-4 pt-4 border-b border-l border-border/50 px-2 sm:px-4">
              {[
                { month: "Jan", val: 40 },
                { month: "Feb", val: 55 },
                { month: "Mar", val: 45 },
                { month: "Apr", val: 70 },
                { month: "May", val: 85, active: true },
                { month: "Jun", val: 95 },
              ].map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <div 
                    className={`w-full rounded-t-lg transition-all duration-500 hover:opacity-100 ${
                      bar.active 
                        ? "bg-gradient-to-t from-primary to-indigo-400 opacity-100 shadow-[0_0_15px_rgba(79,70,229,0.3)]" 
                        : "bg-muted-foreground/20 opacity-70 group-hover:bg-primary/50"
                    }`}
                    style={{ height: `${bar.val}%` }}
                  />
                  <span className={`text-xs ${bar.active ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {bar.month}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Hiring volumes are up 23% in Q2.</span>
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                 Growth Phase
              </span>
            </div>
          </div>

          {/* Top Skills Required */}
          <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Most Requested Skills</h3>
              <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-md">Last 30 Days</span>
            </div>
            <div className="space-y-4">
              <SkillBar name="React / Next.js" percentage={92} isMatched={true} />
              <SkillBar name="Node.js / Express" percentage={85} isMatched={true} />
              <SkillBar name="TypeScript" percentage={78} isMatched={true} />
              <SkillBar name="AWS / Cloud" percentage={65} isMatched={false} />
              <SkillBar name="PostgreSQL" percentage={58} isMatched={true} />
              <SkillBar name="GraphQL" percentage={45} isMatched={false} />
            </div>
          </div>
        </div>

        {/* Sidebar Insights */}
        <div className="space-y-6">
          
          {/* Recommendation Engine */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-md p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -z-10" />
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
              <span className="text-2xl">💡</span> AI Recommendation
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Based on your preferences and the current market, adding <strong>AWS</strong> or basic cloud deployment skills could increase your profile match rate by <strong>24%</strong>. 
            </p>
            <button className="mt-4 w-full rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors px-4 py-2 text-sm font-semibold">
              View Learning Path
            </button>
          </div>

          {/* Market Sentiment */}
          <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6">
            <h3 className="font-semibold text-lg mb-4">India Market Sentiment</h3>
            
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <span className="text-emerald-600 font-bold">↑</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Hybrid Work Transition</h4>
                  <p className="text-xs text-muted-foreground mt-1">45% of tech roles in India now offer flexible hybrid or remote models.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <span className="text-blue-600 font-bold">★</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Bengaluru & Pune Boom</h4>
                  <p className="text-xs text-muted-foreground mt-1">Startups in major IT hubs are hiring 3x more Full Stack devs than last year.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <span className="text-amber-600 font-bold">⚡</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium">AI Integration Focus</h4>
                  <p className="text-xs text-muted-foreground mt-1">Knowing how to integrate LLMs (OpenAI, Anthropic) is the #1 emerging skill across IT services.</p>
                </div>
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

function StatCard({ title, value, trend, icon, color }: any) {
  return (
    <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-all hover:bg-accent/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</h4>
      </div>
      <div className="mt-1">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
      </div>
      <div className="mt-1">
        <span className="text-xs text-muted-foreground">{trend}</span>
      </div>
    </div>
  );
}

function SkillBar({ name, percentage, isMatched }: any) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5 font-medium">
        <span className="flex items-center gap-2">
          {name}
          {isMatched ? (
            <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded uppercase tracking-wide">
              You have this
            </span>
          ) : (
            <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-wide">
              Missing
            </span>
          )}
        </span>
        <span className="text-muted-foreground">{percentage}% of jobs</span>
      </div>
      <div className="h-2.5 w-full bg-muted overflow-hidden rounded-full">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${isMatched ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
