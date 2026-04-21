"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Settings2, 
  Briefcase, 
  FileText, 
  Globe, 
  User, 
  BarChart3, 
  Settings,
  Sparkles,
  FlaskConical,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Job Preferences", href: "/job-preferences", icon: Settings2 },
  { 
    name: "Job Matches", 
    href: "/job-matches", 
    icon: Briefcase,
    highlight: true,
  },
  { name: "Resume Studio", href: "/resume", icon: FileText },
  { name: "Portfolio Studio", href: "/portfolio", icon: Globe },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Insights", href: "/insights", icon: BarChart3 },
  { name: "Evaluation", href: "/evaluation", icon: FlaskConical },
  { name: "Admin", href: "/admin", icon: Shield },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex w-64 flex-col border-r bg-background/50 backdrop-blur-sm h-screen sticky top-0">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight hover:opacity-80 transition-opacity">
          <Sparkles className="h-5 w-5 text-primary" />
          <span>PlaceMates</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-none">
        <nav className="flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all group",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span className="flex-1">{item.name}</span>
                {item.highlight && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] text-primary">
                    ⭐
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
{/* Optional user info bottom area can be added later if needed */}
    </div>
  );
}
