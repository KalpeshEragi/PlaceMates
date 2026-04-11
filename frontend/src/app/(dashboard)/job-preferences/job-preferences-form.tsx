"use client";

import { useState } from "react";
import { type JobPreferences, ROLES, WORK_TYPES, EXPERIENCE_LEVELS, JOB_TYPES, CURRENCIES } from "./job-preferences-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, CheckCircle2, Plus, X } from "lucide-react";

interface FormProps {
  initialData?: JobPreferences;
  onSave: (data: JobPreferences) => Promise<void>;
  onCancel?: () => void;
}

export function JobPreferencesForm({ initialData, onSave, onCancel }: FormProps) {
  const [formData, setFormData] = useState<JobPreferences>({
    primaryRole: initialData?.primaryRole || "",
    secondaryRoles: initialData?.secondaryRoles || [],
    workType: initialData?.workType || "",
    locations: initialData?.locations || [],
    minSalary: initialData?.minSalary || 0,
    currency: initialData?.currency || "INR",
    experienceLevel: initialData?.experienceLevel || "",
    jobType: initialData?.jobType || "",
  });

  const [locationInput, setLocationInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = 
    formData.primaryRole && 
    formData.workType && 
    formData.minSalary > 0 && 
    formData.experienceLevel && 
    formData.jobType;

  const handleSave = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSecondaryRole = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      secondaryRoles: prev.secondaryRoles.includes(role)
        ? prev.secondaryRoles.filter((r) => r !== role)
        : [...prev.secondaryRoles, role],
    }));
  };

  const addLocation = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && locationInput.trim()) {
      e.preventDefault();
      if (!formData.locations.includes(locationInput.trim())) {
        setFormData((prev) => ({
          ...prev,
          locations: [...prev.locations, locationInput.trim()],
        }));
      }
      setLocationInput("");
    }
  };

  const removeLocation = (loc: string) => {
    setFormData((prev) => ({
      ...prev,
      locations: prev.locations.filter((l) => l !== loc),
    }));
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* SECTION 1: ROLE / DOMAIN */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-1">1. Role & Domain</h3>
          <p className="text-sm text-muted-foreground">Select your primary focus and related domains.</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label className="text-base text-card-foreground/80 mb-3 block">Primary Role <span className="text-red-500">*</span></Label>
            <div className="flex flex-wrap gap-3">
              {ROLES.map((role) => (
                <button
                  key={`primary-${role}`}
                  onClick={() => setFormData((prev) => ({ ...prev, primaryRole: role }))}
                  className={`
                    px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border
                    ${formData.primaryRole === role 
                      ? "bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/20 ring-offset-2 ring-offset-background" 
                      : "bg-card text-muted-foreground border-border hover:border-indigo-500/50 hover:bg-indigo-500/5"
                    }
                  `}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <Label className="text-base text-card-foreground/80 mb-3 block">Secondary Roles (Optional)</Label>
            <div className="flex flex-wrap gap-3">
              {ROLES.filter(r => r !== formData.primaryRole).map((role) => {
                const isSelected = formData.secondaryRoles.includes(role);
                return (
                  <button
                    key={`secondary-${role}`}
                    onClick={() => toggleSecondaryRole(role)}
                    className={`
                      px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border flex items-center gap-2
                      ${isSelected 
                        ? "bg-teal-500/10 text-teal-600 border-teal-500/30" 
                        : "bg-background text-muted-foreground border-dashed border-border hover:border-teal-500/50 hover:bg-teal-500/5"
                      }
                    `}
                  >
                    {isSelected && <Check className="w-4 h-4" />}
                    {role}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: LOCATION & WORK TYPE */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-1">2. Location & Work Type</h3>
          <p className="text-sm text-muted-foreground">Where and how do you want to work?</p>
        </div>
        
        <div className="space-y-6">
          <div>
            <Label className="text-base text-card-foreground/80 mb-3 block">Work Type <span className="text-red-500">*</span></Label>
            <div className="flex flex-wrap gap-3">
              {WORK_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setFormData((prev) => ({ ...prev, workType: type }))}
                  className={`
                    px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border
                    ${formData.workType === type 
                      ? "bg-foreground text-background shadow-md" 
                      : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                    }
                  `}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          
          <div className="max-w-md">
            <Label className="text-base text-card-foreground/80 mb-3 block">Preferred Locations</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.locations.map((loc) => (
                <Badge key={loc} variant="secondary" className="px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 bg-teal-500/10 text-teal-600 hover:bg-teal-500/20">
                  {loc}
                  <X 
                    className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500 transition-colors" 
                    onClick={() => removeLocation(loc)} 
                  />
                </Badge>
              ))}
            </div>
            <div className="relative">
              <Input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={addLocation}
                placeholder="Type a city/country and press Enter..."
                className="bg-card border-border/50 focus-visible:ring-teal-500 rounded-xl h-11"
              />
              <Plus className="absolute right-3 top-3 w-5 h-5 text-muted-foreground/50 pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: SALARY EXPECTATION */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-1">3. Salary Expectation</h3>
          <p className="text-sm text-muted-foreground">What is your minimum acceptable compensation?</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 max-w-sm">
          <div className="w-full sm:w-1/3">
            <Label className="text-sm text-muted-foreground mb-2 block">Currency</Label>
            <div className="flex rounded-xl overflow-hidden border border-border/50 p-1 bg-card">
              {CURRENCIES.map((cur) => (
                <button
                  key={cur}
                  onClick={() => setFormData((prev) => ({ ...prev, currency: cur }))}
                  className={`
                    flex-1 py-2 text-sm font-medium transition-colors rounded-lg
                    ${formData.currency === cur 
                      ? "bg-background shadow-sm text-foreground" 
                      : "text-muted-foreground hover:bg-muted/50"
                    }
                  `}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full sm:w-2/3">
            <Label className="text-sm text-muted-foreground mb-2 block">Min Salary <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min="0"
              value={formData.minSalary || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, minSalary: Number(e.target.value) }))}
              placeholder="e.g. 100000"
              className="bg-card border-border/50 focus-visible:ring-indigo-500 rounded-xl h-11"
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* SECTION 4: EXPERIENCE LEVEL */}
        <section className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-1">4. Experience</h3>
            <p className="text-sm text-muted-foreground">Your professional experience.</p>
          </div>
          
          <div className="flex flex-col gap-2">
            {EXPERIENCE_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => setFormData((prev) => ({ ...prev, experienceLevel: level }))}
                className={`
                  text-left px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 border flex justify-between items-center
                  ${formData.experienceLevel === level 
                    ? "bg-indigo-500/5 border-indigo-500/50 text-indigo-600" 
                    : "bg-card text-muted-foreground border-border/50 hover:bg-accent"
                  }
                `}
              >
                {level}
                {formData.experienceLevel === level && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 5: JOB TYPE */}
        <section className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-1">5. Job Type</h3>
            <p className="text-sm text-muted-foreground">What kind of role are you seeking?</p>
          </div>
          
          <div className="flex flex-col gap-2">
            {JOB_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setFormData((prev) => ({ ...prev, jobType: type }))}
                className={`
                  text-left px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 border flex justify-between items-center
                  ${formData.jobType === type 
                    ? "bg-teal-500/5 border-teal-500/50 text-teal-600" 
                    : "bg-card text-muted-foreground border-border/50 hover:bg-accent"
                  }
                `}
              >
                {type}
                {formData.jobType === type && <CheckCircle2 className="w-5 h-5 text-teal-500" />}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* SUBMIT */}
      <div className="pt-8 border-t border-border/50 flex flex-col-reverse sm:flex-row items-center justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="ghost" className="w-full sm:w-auto h-12 px-8 rounded-xl" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button 
          type="button" 
          onClick={handleSave} 
          disabled={!isValid || isSubmitting}
          className="w-full sm:w-auto h-12 px-8 rounded-xl bg-gradient-to-r from-indigo-500 to-teal-500 hover:from-indigo-600 hover:to-teal-600 text-white shadow-lg transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 w-5 h-5 animate-spin" />
              Saving Preferences...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
      </div>
    </div>
  );
}
