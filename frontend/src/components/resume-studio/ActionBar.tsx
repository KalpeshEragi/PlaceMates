"use client";

import React from "react";
import { Save, Download, RotateCcw, Loader2, CheckCircle2 } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ActionBarProps {
  hasChanges: boolean;
  saveStatus: SaveStatus;
  onSave: () => void;
  onDownload: () => void;
  onReset: () => void;
}

export function ActionBar({
  hasChanges,
  saveStatus,
  onSave,
  onDownload,
  onReset,
}: ActionBarProps) {
  return (
    <div className="rs-action-bar">
      <div className="rs-action-left">
        {hasChanges && saveStatus === "idle" && (
          <>
            <span className="rs-unsaved-dot" />
            <span className="rs-unsaved-text">Unsaved changes</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <CheckCircle2 size={14} style={{ color: "hsl(160 60% 42%)" }} />
            <span style={{ fontSize: "0.7rem", color: "hsl(160 60% 42%)", fontWeight: 500 }}>
              All changes saved
            </span>
          </>
        )}
        {saveStatus === "error" && (
          <span style={{ fontSize: "0.7rem", color: "hsl(0 72% 51%)", fontWeight: 500 }}>
            Save failed — try again
          </span>
        )}
      </div>

      <div className="rs-action-right">
        {hasChanges && (
          <button type="button" className="rs-btn rs-btn-ghost" onClick={onReset}>
            <RotateCcw size={14} />
            Reset
          </button>
        )}
        <button type="button" className="rs-btn rs-btn-secondary" onClick={onDownload}>
          <Download size={14} />
          Download PDF
        </button>
        <button
          type="button"
          className={`rs-btn ${saveStatus === "saved" ? "rs-btn-success" : "rs-btn-primary"}`}
          onClick={onSave}
          disabled={saveStatus === "saving" || !hasChanges}
        >
          {saveStatus === "saving" ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving…
            </>
          ) : saveStatus === "saved" ? (
            <>
              <CheckCircle2 size={14} />
              Saved
            </>
          ) : (
            <>
              <Save size={14} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
