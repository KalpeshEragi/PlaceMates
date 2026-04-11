"use client";

import React from "react";
import { RESUME_TEMPLATES } from "@/lib/templates/template-registry";
import type { ResumeTemplateId } from "@/lib/templates/template-registry";
import { Check, Layout } from "lucide-react";

interface TemplateSwitcherProps {
  selectedId: ResumeTemplateId;
  onSelect: (id: ResumeTemplateId) => void;
}

export function TemplateSwitcher({ selectedId, onSelect }: TemplateSwitcherProps) {
  return (
    <div className="rs-template-grid">
      {RESUME_TEMPLATES.map((tmpl) => {
        const isSelected = tmpl.id === selectedId;
        return (
          <button
            key={tmpl.id}
            type="button"
            className="rs-template-card"
            data-selected={isSelected}
            onClick={() => onSelect(tmpl.id)}
          >
            {isSelected && (
              <span className="rs-template-card-check">
                <Check size={10} />
              </span>
            )}
            <Layout size={20} style={{ margin: "0 auto", opacity: 0.5 }} />
            <div className="rs-template-label">{tmpl.label}</div>
            <div className="rs-template-id">{tmpl.id.toUpperCase()}</div>
          </button>
        );
      })}
    </div>
  );
}
