"use client";

import { useState } from "react";
import { type JobPreferences, ROLES } from "./job-preferences-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, User, MapPin, Briefcase, Award, BriefcaseBusiness, X, DollarSign } from "lucide-react";

interface SummaryProps {
  preferences: JobPreferences;
  onEdit: () => void;
}

export function JobPreferencesSummary({ preferences, onEdit }: SummaryProps) {
  return (
    <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl point-events-none" />
      <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl point-events-none" />
      
      <div className="rounded-2xl border border-white/10 bg-card p-6 md:p-10 shadow-lg backdrop-blur-sm relative overflow-hidden">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 border-b border-border pb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              Your Preferences
            </h2>
            <p className="text-muted-foreground mt-1">
              We&apos;ll use this to match you with top opportunities.
            </p>
          </div>
          <Button onClick={onEdit} variant="outline" className="rounded-xl font-medium shrink-0 shadow-sm border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all">
            Edit Preferences
          </Button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Role Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary font-medium border-b border-border/50 pb-2">
              <User className="w-5 h-5 text-indigo-500" />
              Role & Domain
            </div>
            
            <div className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground block mb-1">Primary Role</span>
                <span className="text-lg font-semibold gradient-text bg-gradient-to-r from-indigo-500 to-teal-500 text-transparent bg-clip-text">
                  {preferences.primaryRole}
                </span>
              </div>
              
              {preferences.secondaryRoles.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-2">Secondary Roles</span>
                  <div className="flex flex-wrap gap-2">
                    {preferences.secondaryRoles.map((role) => (
                      <Badge key={role} variant="secondary" className="bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border-0 rounded-lg px-3 py-1">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Location & Work Type Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary font-medium border-b border-border/50 pb-2">
              <MapPin className="w-5 h-5 text-teal-500" />
              Location & Work Type
            </div>
            
            <div className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground block mb-2">Work Type</span>
                <Badge className="bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 border-0 rounded-lg px-3 py-1 shadow-sm">
                  {preferences.workType}
                </Badge>
              </div>
              
              {preferences.locations.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-2">Locations</span>
                  <div className="flex flex-wrap gap-2">
                    {preferences.locations.map((loc) => (
                      <Badge key={loc} variant="outline" className="rounded-lg px-3 py-1 bg-background/50 backdrop-blur-sm">
                        {loc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Experience & Job Type */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary font-medium border-b border-border/50 pb-2">
              <Award className="w-5 h-5 text-purple-500" />
              Experience & Focus
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground block mb-1">Experience</span>
                <span className="font-medium flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  {preferences.experienceLevel}
                </span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground block mb-1">Job Type</span>
                <span className="font-medium flex items-center gap-2">
                  <BriefcaseBusiness className="w-4 h-4 text-muted-foreground" />
                  {preferences.jobType}
                </span>
              </div>
            </div>
          </div>

          {/* Salary Expectation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary font-medium border-b border-border/50 pb-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Compensation
            </div>
            
            <div>
              <span className="text-sm text-muted-foreground block mb-1">Minimum Expectation</span>
              <span className="text-xl font-medium tracking-tight">
                {preferences.currency === "INR" ? "₹" : "$"}
                {preferences.minSalary.toLocaleString()}
                {preferences.currency === "INR" ? " LPA" : "/yr"}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
