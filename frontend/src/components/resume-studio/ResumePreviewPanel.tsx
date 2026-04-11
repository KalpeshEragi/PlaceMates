"use client";

import React from "react";
import { resumeComponentForId, RESUME_TEMPLATES } from "@/lib/templates/template-registry";
import type { ResumeData } from "@/components/templates/resume/Template1";
import type { ResumeTemplateId } from "@/lib/templates/template-registry";
import { FileText } from "lucide-react";

interface ResumePreviewPanelProps {
  resumeData: ResumeData;
  templateId: ResumeTemplateId;
}

export function ResumePreviewPanel({ resumeData, templateId }: ResumePreviewPanelProps) {
  const ResumeComponent = resumeComponentForId(templateId);
  const templateLabel = RESUME_TEMPLATES.find((t) => t.id === templateId)?.label ?? "Unknown";

  return (
    <div className="rs-preview-pane">
      <div className="rs-preview-badge">
        <FileText size={11} />
        {templateLabel}
      </div>
      <div className="rs-preview-paper">
        <ResumeComponent data={resumeData} />
      </div>
    </div>
  );
}
