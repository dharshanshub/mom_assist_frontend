import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type ProjectRecord, streamProjectHistory, suggestProjectIds } from "../api/client";

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function StatusDot({ status }: { status: string }) {
  const s = status.toLowerCase();
  let color = "#64748b";
  if (s.includes("complet") || s.includes("closed") || s.includes("approved")) color = "#16a34a";
  else if (s.includes("hold") || s.includes("defer") || s.includes("paused"))   color = "#f59e0b";
  else if (s.includes("risk") || s.includes("delay") || s.includes("reject"))   color = "#dc2626";
  else if (s.includes("active") || s.includes("track") || s.includes("progress")) color = "#16a34a";
  return <span className="tl-status-dot" style={{ background: color }} />;
}

function TimelineCard({ record, index, total }: { record: ProjectRecord; index: number; total: number }) {
  const [open, setOpen] = useState(index === total - 1);
  return (
    <div className="tl-item">
      <div className="tl-connector">
        <div className="tl-dot" />
        {index < total - 1 && <div className="tl-line" />}
      </div>
      <div className="tl-card" onClick={() => setOpen((o) => !o)}>
        <div className="tl-card-header">
          <div className="tl-date-block">
            <span className="tl-date">{record.meeting_date}</span>
            {record.meeting_time && (
              <span className="tl-time"><ClockIcon />{record.meeting_time}</span>
            )}
          </div>
          <span className="tl-meeting-type">{record.meeting_type || "Meeting"}</span>
          <svg className="tl-chevron"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div className="tl-status-row">
          <StatusDot status={record.status} />
          <span className="tl-status-text">{record.status || "Status not recorded"}</span>
        </div>
        {open && (
          <div className="tl-card-body">
            {record.decision && (
              <div className="tl-field">
                <span className="tl-field-label">Decision</span>
                <span className="tl-field-value tl-decision">{record.decision}</span>
              </div>
            )}
            {record.recommendation && (
              <div className="tl-field">
                <span className="tl-field-label">Recommendation</span>
                <span className="tl-field-value">{record.recommendation}</span>
              </div>
            )}
            {record.budget_allocation && (
              <div className="tl-field">
                <span className="tl-field-label">Budget</span>
                <span className="tl-field-value">{record.budget_allocation}</span>
              </div>
            )}
            {record.organizer && (
              <div className="tl-field">
                <span className="tl-field-label">Organizer</span>
                <span className="tl-field-value">{record.organizer}</span>
              </div>
            )}
            {record.action_items.length > 0 && (
              <div className="tl-field">
                <span className="tl-field-label">Action Items</span>
                <ul className="tl-actions">
                  {record.action_items.map((ai, i) => <li key={i}>{ai}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectTrackerPage() {
  const [inputId, setInputId]             = useState("");
  const [suggestions, setSuggestions]     = useState<string[]>([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [activeIdx, setActiveIdx]         = useState(-1);
  const [loading, setLoading]             = useState(false);
  const [records, setRecords]             = useState<ProjectRecord[]>([]);
  const [narrative, setNarrative]         = useState("");
  const [narrativeDone, setNarrativeDone] = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [searched, setSearched]           = useState(false);
  const [searchedId, setSearchedId]       = useState("");
  const narrativeRef  = useRef<HTMLDivElement>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef    = useRef<HTMLDivElement>(null);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = inputId.trim();
    if (!q) { setSuggestions([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      const ids = await suggestProjectIds(q);
      setSuggestions(ids);
      setShowDropdown(ids.length > 0);
      setActiveIdx(-1);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const runSearch = async (pid: string) => {
    const id = pid.trim().toUpperCase();
    if (!id) return;
    setShowDropdown(false);
    setLoading(true);
    setRecords([]);
    setNarrative("");
    setNarrativeDone(false);
    setError(null);
    setSearched(true);
    setSearchedId(id);

    await streamProjectHistory(id, {
      onRecords: (r) => { setRecords(r); setLoading(false); },
      onDelta: (text) => {
        setNarrative((prev) => prev + text);
        if (narrativeRef.current)
          narrativeRef.current.scrollTop = narrativeRef.current.scrollHeight;
      },
      onDone:  () => setNarrativeDone(true),
      onError: (msg) => { setError(msg); setLoading(false); },
    });
  };

  const handleSelect = (id: string) => {
    setInputId(id);
    setSuggestions([]);
    setShowDropdown(false);
    runSearch(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        handleSelect(suggestions[activeIdx]);
      } else {
        runSearch(inputId);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div className="tracker-page">
      {/* Header — animated hero band */}
      <div className="pd-hero">
        <div className="pd-hero-bg" />
        <div className="pd-hero-inner">
          <div className="pd-hero-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div className="pd-hero-text">
            <div className="pd-hero-eyebrow"><span className="pd-hero-dot" /> AI Chronological Analysis</div>
            <div className="pd-hero-title">Project History Tracker</div>
            <div className="pd-hero-sub">Reconstruct any project's complete arc across every meeting it appeared in</div>
          </div>
        </div>
        <div className="pd-about">
          <span className="pd-about-ic">i</span>
          <span>
            <strong>How to use this page:</strong> start typing a project ID — suggestions appear as you type, so you
            never have to guess the exact code. Pick one and the tracker pulls <strong>every meeting</strong> that project
            was discussed in, lays them out as a chronological timeline on the left, and streams an
            <strong> AI-written narrative</strong> of its decisions, budget shifts, and current standing on the right.
          </span>
        </div>
      </div>

      {/* Search bar with autocomplete */}
      <div className="tracker-search-bar" ref={wrapperRef}>
        <div className="tracker-input-wrap">
          <input
            className="tracker-input"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            placeholder="Type a project ID, e.g. PRJ-0113"
            disabled={loading}
            autoFocus
            autoComplete="off"
          />
          {showDropdown && suggestions.length > 0 && (
            <div className="tracker-dropdown">
              {suggestions.map((id, i) => {
                const q = inputId.trim().toUpperCase();
                const idx = id.indexOf(q);
                return (
                  <div
                    key={id}
                    className={`tracker-suggestion${i === activeIdx ? " active" : ""}`}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(id); }}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    {idx >= 0 ? (
                      <>
                        {id.slice(0, idx)}
                        <strong>{id.slice(idx, idx + q.length)}</strong>
                        {id.slice(idx + q.length)}
                      </>
                    ) : id}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button
          className="tracker-search-btn"
          onClick={() => runSearch(inputId)}
          disabled={loading || !inputId.trim()}
        >
          {loading ? <span className="tracker-spinner" /> : <SearchIcon />}
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div className="tracker-body">
          {error ? (
            <div className="tracker-error">{error}</div>
          ) : (
            <>
              <div className="tracker-left">
                <div className="tracker-panel-title">
                  Timeline
                  {records.length > 0 && (
                    <span className="tracker-badge">
                      {records.length} meeting{records.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {loading && records.length === 0 ? (
                  <div className="tracker-loading-hint">
                    <span className="tracker-spinner" style={{ borderColor: "rgba(249,115,22,0.2)", borderTopColor: "#f97316" }} />
                    Searching…
                  </div>
                ) : records.length === 0 ? (
                  <div className="tracker-empty">No records found for <strong>{searchedId}</strong></div>
                ) : (
                  <div className="tl-list">
                    {records.map((r, i) => (
                      <TimelineCard key={i} record={r} index={i} total={records.length} />
                    ))}
                  </div>
                )}
              </div>

              <div className="tracker-right">
                <div className="tracker-panel-title">
                  AI Analysis
                  {!narrativeDone && narrative && <span className="tracker-streaming-dot" />}
                </div>
                {narrative ? (
                  <div className="tracker-narrative" ref={narrativeRef}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrative}</ReactMarkdown>
                  </div>
                ) : records.length > 0 && !narrativeDone ? (
                  <div className="tracker-loading-hint">
                    <span className="tracker-spinner" style={{ borderColor: "rgba(249,115,22,0.2)", borderTopColor: "#f97316" }} />
                    Writing AI narrative…
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!searched && (
        <div className="tracker-empty-state">
          <div className="tracker-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div className="tracker-empty-title">Track any project's history</div>
          <div className="tracker-empty-desc">
            Start typing a project ID above — suggestions will appear automatically.<br />
            Select one to see every meeting it appeared in and an AI narrative.
          </div>
          <div className="tracker-example-ids">
            {["PRJ-0101", "PRJ-0113", "PRJ-0127", "PRJ-0145"].map((id) => (
              <button key={id} className="tracker-example-chip" onClick={() => { setInputId(id); handleSelect(id); }}>
                {id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
