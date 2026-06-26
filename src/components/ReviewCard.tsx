import { useEffect, useState } from "react";
import type { ExtractedMeeting, ExtractedProject } from "../api/client";

interface Props {
  filename: string;
  extracted: ExtractedMeeting;
  onApprove: (meeting: ExtractedMeeting) => void;
  onDiscard: () => void;
  indexing: boolean;
  done: boolean;
}

const SAVE_STEPS = [
  "Uploading minutes to secure storage",
  "Generating semantic embeddings",
  "Saving to your knowledge base",
  "Building the search index",
  "Linking projects for tracking",
];

/** Futuristic overlay shown while saving to the knowledge base, then a success state. */
function SavingOverlay({ done, projectCount }: { done: boolean; projectCount: number }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setStep((s) => (s + 1) % SAVE_STEPS.length), 850);
    return () => clearInterval(id);
  }, [done]);

  return (
    <div className={`rv-overlay${done ? " rv-overlay-done" : ""}`}>
      <div className="rv-overlay-inner">
        {done ? (
          <>
            <div className="rv-success">
              <svg viewBox="0 0 52 52" className="rv-success-svg">
                <circle className="rv-success-circle" cx="26" cy="26" r="23" fill="none" />
                <path className="rv-success-check" fill="none" d="M15 27 l8 8 l15 -16" />
              </svg>
            </div>
            <div className="rv-overlay-title">Saved to knowledge base</div>
            <div className="rv-overlay-sub">
              {projectCount} project{projectCount !== 1 ? "s" : ""} ready to track &amp; search
            </div>
            <div className="rv-ready-pill">● Ready to track</div>
          </>
        ) : (
          <>
            <div className="rv-loader">
              <span className="rv-loader-ring" />
              <span className="rv-loader-ring rv-loader-ring-2" />
              <span className="rv-loader-ring rv-loader-ring-3" />
              <div className="rv-loader-core">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3"  y="13" width="3.4" height="8"  rx="1.7" fill="#fff" fillOpacity=".7" className="rv-core-bar"/>
                  <rect x="8"  y="9"  width="3.4" height="12" rx="1.7" fill="#fff" fillOpacity=".85" className="rv-core-bar"/>
                  <rect x="13" y="5"  width="3.4" height="16" rx="1.7" fill="#fff" className="rv-core-bar"/>
                  <circle cx="19.4" cy="6.2" r="2" fill="#fff"/>
                </svg>
              </div>
            </div>
            <div className="rv-overlay-title">Saving to knowledge base</div>
            <div className="rv-overlay-steps">
              {SAVE_STEPS.map((s, i) => (
                <div key={s} className={`rv-step-line${i === step ? " active" : ""}${i < step ? " done" : ""}`}>
                  <span className="rv-step-ic">
                    {i < step ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <span className="rv-step-dot" />
                    )}
                  </span>
                  {s}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const MEETING_TYPES = [
  "Portfolio Review", "Board Meeting", "Planning Session",
  "Programme Retrospective", "Client Steering Committee",
  "All-Hands Update", "Cross-Functional Sync", "Other",
];

function Field({ label, value, onChange, multiline }: {
  label: string; value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="rv-field">
      <label className="rv-label">{label}</label>
      {multiline ? (
        <textarea
          className="rv-input rv-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
        />
      ) : (
        <input
          className="rv-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ProjectRow({ project, index, onChange, onDelete }: {
  project: ExtractedProject;
  index: number;
  onChange: (updated: ExtractedProject) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);
  const set = (key: keyof ExtractedProject, value: string | string[]) =>
    onChange({ ...project, [key]: value });

  return (
    <div className="rv-project">
      <div className="rv-project-header">
        <button className="rv-collapse-btn" onClick={() => setOpen((o) => !o)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <span className="rv-project-num">#{index + 1}</span>
        <span className="rv-project-name">
          {project.project_name || <em style={{ opacity: 0.4 }}>Unnamed project</em>}
        </span>
        {project.project_id && (
          <span className="rv-project-id">{project.project_id}</span>
        )}
        <button className="rv-delete-btn" title="Remove this project" onClick={onDelete}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="rv-project-body">
          <div className="rv-row-2">
            <Field label="Project Name" value={project.project_name} onChange={(v) => set("project_name", v)} />
            <Field label="Project ID" value={project.project_id} onChange={(v) => set("project_id", v)} />
          </div>
          <div className="rv-row-2">
            <Field label="Status" value={project.status} onChange={(v) => set("status", v)} />
            <Field label="Budget Allocation" value={project.budget_allocation} onChange={(v) => set("budget_allocation", v)} />
          </div>
          <Field label="Recommendation" value={project.recommendation} onChange={(v) => set("recommendation", v)} multiline />
          <Field label="Decision" value={project.decision} onChange={(v) => set("decision", v)} multiline />

          <div className="rv-field">
            <label className="rv-label">Action Items</label>
            {project.action_items.map((item, ai) => (
              <div key={ai} className="rv-action-row">
                <input
                  className="rv-input"
                  value={item}
                  onChange={(e) => {
                    const updated = [...project.action_items];
                    updated[ai] = e.target.value;
                    set("action_items", updated);
                  }}
                />
                <button
                  className="rv-action-del"
                  onClick={() => set("action_items", project.action_items.filter((_, i) => i !== ai))}
                  title="Remove action item"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              className="rv-add-action"
              onClick={() => set("action_items", [...project.action_items, ""])}
            >
              + Add action item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReviewCard({ filename, extracted, onApprove, onDiscard, indexing, done }: Props) {
  const [meeting, setMeeting] = useState<ExtractedMeeting>({ ...extracted });
  const busy = indexing || done;

  const setTop = (key: keyof ExtractedMeeting, value: string) =>
    setMeeting((m) => ({ ...m, [key]: value }));

  const updateProject = (i: number, updated: ExtractedProject) =>
    setMeeting((m) => ({ ...m, projects: m.projects.map((p, idx) => idx === i ? updated : p) }));

  const deleteProject = (i: number) =>
    setMeeting((m) => ({ ...m, projects: m.projects.filter((_, idx) => idx !== i) }));

  const addProject = () =>
    setMeeting((m) => ({
      ...m,
      projects: [...m.projects, {
        project_name: "", project_id: "", status: "",
        recommendation: "", decision: "", budget_allocation: "", action_items: [],
      }],
    }));

  return (
    <div className="rv-card">
      {busy && <SavingOverlay done={done} projectCount={meeting.projects.length} />}
      {/* header */}
      <div className="rv-card-header">
        <div className="rv-card-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div className="rv-card-title-group">
          <div className="rv-card-title">Review extracted data</div>
          <div className="rv-card-sub">{filename} · {meeting.projects.length} project{meeting.projects.length !== 1 ? "s" : ""} detected</div>
        </div>
        <div className="rv-card-badge">Pending approval</div>
      </div>

      {/* scrollable body */}
      <div className="rv-card-body">

      {/* meeting meta */}
      <div className="rv-section-label">Meeting Details</div>
      <div className="rv-row-2">
        <div className="rv-field">
          <label className="rv-label">Meeting Type</label>
          <select className="rv-input rv-select" value={meeting.meeting_type}
            onChange={(e) => setTop("meeting_type", e.target.value)}>
            {MEETING_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="rv-row-2" style={{ gap: 8 }}>
          <Field label="Date" value={meeting.date} onChange={(v) => setTop("date", v)} />
          <Field label="Time" value={meeting.time} onChange={(v) => setTop("time", v)} />
        </div>
      </div>
      <div className="rv-row-2">
        <Field label="Organizer" value={meeting.organizer} onChange={(v) => setTop("organizer", v)} />
        <Field label="Location" value={meeting.location} onChange={(v) => setTop("location", v)} />
      </div>

      {/* projects */}
      <div className="rv-section-label" style={{ marginTop: 16 }}>
        Projects Discussed
        <span className="rv-section-hint">Edit, delete, or add projects before approving</span>
      </div>

      {meeting.projects.length === 0 && (
        <div className="rv-no-projects">No projects detected — add one below if needed.</div>
      )}

      {meeting.projects.map((p, i) => (
        <ProjectRow
          key={i}
          project={p}
          index={i}
          onChange={(updated) => updateProject(i, updated)}
          onDelete={() => deleteProject(i)}
        />
      ))}

      <button className="rv-add-project" onClick={addProject}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add project
      </button>

      </div>{/* end rv-card-body */}

      {/* actions */}
      <div className="rv-actions">
        <button className="rv-btn rv-btn-discard" onClick={onDiscard} disabled={busy}>
          Discard
        </button>
        <button
          className="rv-btn rv-btn-approve"
          onClick={() => onApprove(meeting)}
          disabled={busy || meeting.projects.length === 0}
        >
          {indexing ? (
            <>
              <span className="rv-spinner" />
              Indexing…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Approve & Index
            </>
          )}
        </button>
      </div>
    </div>
  );
}
