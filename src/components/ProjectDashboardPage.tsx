import { useEffect, useRef, useState } from "react";
import {
  type DashboardProject,
  type DashboardStats,
  type MeetingFileRecord,
  deleteMeetingFile,
  getDashboardStats,
  getDocumentUrl,
  listMeetingFiles,
} from "../api/client";

// ── Count-up animation for integer metrics ─────────────────────────────────────

function CountUp({ value }: { value: number | string }) {
  const [display, setDisplay] = useState<number | string>(
    typeof value === "number" && Number.isInteger(value) ? 0 : value,
  );
  useEffect(() => {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}</>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBudget(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 10_000_000)    return `${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)       return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function daysBetween(a: string, b: string): number {
  try {
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
  } catch { return 0; }
}

function daysAgo(d: string): number {
  return daysBetween(d, new Date().toISOString().slice(0, 10));
}

function formatAge(days: number): string {
  if (days === 0) return "—";
  if (days < 30)  return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

const statusColor = (cat: string) => {
  if (cat === "active")    return "#16a34a";
  if (cat === "on_hold")   return "#f59e0b";
  if (cat === "completed") return "#8b5cf6";
  if (cat === "at_risk")   return "#dc2626";
  return "#64748b";
};

// ── Icons ─────────────────────────────────────────────────────────────────────

const Icons = {
  folder:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  active:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  hold:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>,
  check:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  risk:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  decision: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  stale:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  churn:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  noDecision: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  age:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  density:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  budget:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  eye:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  trash:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
};

// ── Drilldown panel ───────────────────────────────────────────────────────────

type TileFilter =
  | "total" | "active" | "on_hold" | "completed" | "at_risk"
  | "meetings" | "decisions"
  | "stale" | "churn" | "no_decisions" | "density" | "budget" | "age";

interface TileMeta { label: string; accent: string }

const TILE_META: Record<TileFilter, TileMeta> = {
  total:        { label: "All Projects",              accent: "#2563eb" },
  active:       { label: "Active Projects",           accent: "#16a34a" },
  on_hold:      { label: "On Hold Projects",          accent: "#f59e0b" },
  completed:    { label: "Completed Projects",        accent: "#8b5cf6" },
  at_risk:      { label: "At Risk Projects",          accent: "#dc2626" },
  meetings:     { label: "Recent Meetings",           accent: "#0891b2" },
  decisions:    { label: "Projects with Decisions",   accent: "#f97316" },
  stale:        { label: "Stale Projects (90d)",      accent: "#64748b" },
  churn:        { label: "Status Churn Projects",     accent: "#dc2626" },
  no_decisions: { label: "Projects with No Decisions", accent: "#8b5cf6" },
  density:      { label: "Action Item Load by Project", accent: "#0891b2" },
  budget:       { label: "Budget Exposure",           accent: "#16a34a" },
  age:          { label: "Projects by Lifespan",      accent: "#f97316" },
};

function ProjectRow({ p, extra }: { p: DashboardProject; extra?: React.ReactNode }) {
  return (
    <div className="dd-row">
      <div className="dd-row-top">
        <span className="dd-proj-name" title={p.project_name}>{p.project_name}</span>
        <span className="dd-proj-id">{p.project_id}</span>
      </div>
      <div className="dd-row-meta">
        <span className="dd-status-dot" style={{ background: statusColor(p.category) }} />
        <span className="dd-status">{p.status || "Status not recorded"}</span>
        <span className="dd-appearances">{p.appearance_count} meeting{p.appearance_count !== 1 ? "s" : ""}</span>
        {p.latest_date && <span className="dd-date">· {p.latest_date}</span>}
      </div>
      {extra}
    </div>
  );
}

function DrilldownPanel({
  filter, stats, onClose,
}: {
  filter: TileFilter; stats: DashboardStats; onClose: () => void;
}) {
  const meta = TILE_META[filter];

  const filterProjects = (): DashboardProject[] => {
    const all = stats.all_projects;
    switch (filter) {
      case "total":        return all;
      case "active":       return all.filter((p) => p.category === "active");
      case "on_hold":      return all.filter((p) => p.category === "on_hold");
      case "completed":    return all.filter((p) => p.category === "completed");
      case "at_risk":      return all.filter((p) => p.category === "at_risk");
      case "decisions":    return all.filter((p) => p.has_decision);
      case "stale":        return all.filter((p) => p.is_stale);
      case "churn":        return [...all.filter((p) => p.status_change_count >= 2)]
                                    .sort((a, b) => b.status_change_count - a.status_change_count);
      case "no_decisions": return all.filter((p) => !p.has_decision && p.appearance_count >= 2);
      case "density":      return [...all.filter((p) => p.total_action_items > 0)]
                                    .sort((a, b) => b.total_action_items - a.total_action_items);
      case "budget":       return [...all.filter((p) => p.latest_budget)]
                                    .sort((a, b) => b.appearance_count - a.appearance_count);
      case "age":          return [...all.filter((p) => p.first_date && p.latest_date && p.first_date !== p.latest_date)]
                                    .sort((a, b) => daysBetween(a.first_date, a.latest_date) < daysBetween(b.first_date, b.latest_date) ? 1 : -1);
      default:             return all;
    }
  };

  if (filter === "meetings") {
    return (
      <>
        <div className="dd-backdrop" onClick={onClose} />
        <div className="dd-panel">
          <div className="dd-panel-header" style={{ borderTopColor: "#0891b2" }}>
            <div>
              <div className="dd-panel-title" style={{ color: "#0891b2" }}>Recent Meetings</div>
              <div className="dd-panel-count">{stats.total_meetings} total meetings indexed</div>
            </div>
            <CloseBtn onClose={onClose} />
          </div>
          <div className="dd-list">
            {stats.recent_meetings.map((m, i) => (
              <div key={i} className="dd-row">
                <div className="dd-row-top">
                  <span className="dd-proj-name" style={{ fontFamily: "monospace", fontSize: 12 }}>{m.document_name}</span>
                </div>
                <div className="dd-row-meta">
                  <span className="dd-date">{m.meeting_date}</span>
                  {m.meeting_time && <span className="dd-date">· {m.meeting_time}</span>}
                  <span className="dd-appearances">{m.meeting_type}</span>
                  <span className="dd-date">· {m.project_count} project{m.project_count !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
            <div className="dd-empty" style={{ fontSize: 12, paddingTop: 4 }}>Showing 5 most recent · See all in Meeting Files below</div>
          </div>
        </div>
      </>
    );
  }

  const projects = filterProjects();

  return (
    <>
      <div className="dd-backdrop" onClick={onClose} />
      <div className="dd-panel">
        <div className="dd-panel-header" style={{ borderTopColor: meta.accent }}>
          <div>
            <div className="dd-panel-title" style={{ color: meta.accent }}>{meta.label}</div>
            <div className="dd-panel-count">{projects.length} project{projects.length !== 1 ? "s" : ""}</div>
          </div>
          <CloseBtn onClose={onClose} />
        </div>
        <div className="dd-list">
          {projects.length === 0 ? (
            <div className="dd-empty">No projects in this category.</div>
          ) : projects.map((p) => {
            const extra = (() => {
              if (filter === "decisions" && p.latest_decision) {
                return (
                  <div className="dd-decision">
                    <span className="dd-decision-label">Decision:</span> {p.latest_decision}
                  </div>
                );
              }
              if (filter === "stale") {
                return (
                  <div className="dd-tag dd-tag-gray">Last seen {daysAgo(p.latest_date)} days ago</div>
                );
              }
              if (filter === "churn") {
                return (
                  <div className="dd-tag dd-tag-red">{p.status_change_count} distinct statuses recorded</div>
                );
              }
              if (filter === "no_decisions") {
                return (
                  <div className="dd-tag dd-tag-purple">Appeared in {p.appearance_count} meetings — no formal decision</div>
                );
              }
              if (filter === "density") {
                return (
                  <div className="dd-tag dd-tag-blue">{p.total_action_items} action items total</div>
                );
              }
              if (filter === "budget" && p.latest_budget) {
                return (
                  <div className="dd-tag dd-tag-green">Budget: {p.latest_budget}</div>
                );
              }
              if (filter === "age") {
                const days = daysBetween(p.first_date, p.latest_date);
                return (
                  <div className="dd-tag dd-tag-orange">
                    {formatAge(days)} lifespan · {p.first_date} → {p.latest_date}
                  </div>
                );
              }
              return null;
            })();
            return <ProjectRow key={p.project_id} p={p} extra={extra} />;
          })}
        </div>
      </div>
    </>
  );
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button className="dd-close" onClick={onClose}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, accent, icon, onClick, subLabel, index = 0,
}: {
  label: string; value: number | string; accent?: string;
  icon: React.ReactNode; onClick?: () => void; subLabel?: string; index?: number;
}) {
  return (
    <div
      className={`pd-metric${onClick ? " pd-metric-clickable" : ""}`}
      style={{ borderTopColor: accent ?? "#2563eb", animationDelay: `${index * 55}ms` }}
      onClick={onClick}
      title={onClick ? `View ${label}` : undefined}
    >
      <div className="pd-metric-icon" style={{ color: accent ?? "#2563eb" }}>{icon}</div>
      <div className="pd-metric-value"><CountUp value={value} /></div>
      <div className="pd-metric-label">{label}</div>
      {subLabel && <div className="pd-metric-sublabel">{subLabel}</div>}
      {onClick && <div className="pd-metric-arrow">→</div>}
    </div>
  );
}

// ── Meeting cadence chart ─────────────────────────────────────────────────────

function CadenceChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).slice(-12); // last 12 months
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="pd-cadence">
      {entries.map(([ym, count]) => {
        const label = ym.slice(0, 7); // YYYY-MM
        const [year, month] = ym.split("-");
        const shortLabel = `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(month)-1]} ${year.slice(2)}`;
        const pct = Math.round((count / max) * 100);
        return (
          <div key={ym} className="pd-cadence-col">
            <div className="pd-cadence-bar-wrap">
              <div className="pd-cadence-count">{count}</div>
              <div className="pd-cadence-bar" style={{ height: `${Math.max(pct, 4)}%` }} />
            </div>
            <div className="pd-cadence-label" title={label}>{shortLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Meeting file row ──────────────────────────────────────────────────────────

function MeetingRow({
  record, onDeleted,
}: {
  record: MeetingFileRecord; onDeleted: (documentName: string) => void;
}) {
  const [opening,  setOpening]  = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirm,  setConfirm]  = useState(false);

  const handleView = async () => {
    setOpening(true);
    try {
      const url = await getDocumentUrl(record.meeting_id);
      window.open(url, "_blank");
    } catch {
      alert("Could not open document. It may not be in blob storage yet.");
    } finally { setOpening(false); }
  };

  const handleRemove = async () => {
    setConfirm(false); setRemoving(true);
    try {
      await deleteMeetingFile(record.document_name);
      onDeleted(record.document_name);
    } catch (err) {
      alert(`Remove failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setRemoving(false);
    }
  };

  return (
    <div className="pd-meeting-row">
      <div className="pd-meeting-main">
        <div className="pd-meeting-file">{record.document_name}</div>
        <div className="pd-meeting-meta">
          <span>{record.meeting_date}</span>
          {record.meeting_time && <span>· {record.meeting_time}</span>}
          {record.meeting_type && <span className="pd-meeting-type-chip">{record.meeting_type}</span>}
          {record.organizer && <span>· {record.organizer}</span>}
        </div>
        {record.project_names.length > 0 && (
          <div className="pd-meeting-projects">
            {record.project_names.slice(0, 4).map((n, i) => <span key={i} className="pd-proj-chip">{n}</span>)}
            {record.project_names.length > 4 && (
              <span className="pd-proj-chip pd-proj-more">+{record.project_names.length - 4} more</span>
            )}
          </div>
        )}
      </div>
      <div className="pd-row-actions">
        <button className="pd-view-btn" onClick={handleView} disabled={opening || removing}>
          {opening ? <span className="pd-spinner" /> : Icons.eye} View MOM
        </button>
        {confirm ? (
          <div className="pd-confirm-row">
            <span className="pd-confirm-text">Remove permanently?</span>
            <button className="pd-confirm-yes" onClick={handleRemove} disabled={removing}>
              {removing ? <span className="pd-spinner" style={{ borderTopColor: "#fff" }} /> : "Yes, remove"}
            </button>
            <button className="pd-confirm-no" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        ) : (
          <button className="pd-remove-btn" onClick={() => setConfirm(true)} disabled={removing}>
            {Icons.trash} Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ProjectDashboardPage() {
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [statsErr, setStatsErr]     = useState(false);
  const [activeFilter, setActiveFilter] = useState<TileFilter | null>(null);
  const [meetings, setMeetings]     = useState<MeetingFileRecord[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => setStatsErr(true));
  }, []);

  useEffect(() => {
    setMeetingsLoading(true);
    listMeetingFiles(search, page, 5)
      .then((r) => { setMeetings(r.meetings); setTotal(r.total); setTotalPages(r.total_pages); })
      .catch(() => {})
      .finally(() => setMeetingsLoading(false));
  }, [search, page]);

  const handleSearchChange = (v: string) => {
    setSearchInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(v); setPage(1); }, 300);
  };

  const tile = (f: TileFilter) => stats ? () => setActiveFilter(f) : undefined;

  const typeEntries = stats
    ? Object.entries(stats.meeting_type_distribution).sort((a, b) => b[1] - a[1])
    : [];
  const maxType = typeEntries[0]?.[1] ?? 1;

  return (
    <div className="pd-page">
      {/* Header — animated hero band */}
      <div className="pd-hero">
        <div className="pd-hero-bg" />
        <div className="pd-hero-inner">
          <div className="pd-hero-icon">{Icons.folder}</div>
          <div className="pd-hero-text">
            <div className="pd-hero-eyebrow"><span className="pd-hero-dot" /> Live Portfolio Intelligence</div>
            <div className="pd-hero-title">Project Dashboard</div>
            <div className="pd-hero-sub">Real-time metrics aggregated from every indexed meeting minute</div>
          </div>
          <div className="pd-hero-stat">
            <div className="pd-hero-stat-num"><CountUp value={stats?.total_projects ?? 0} /></div>
            <div className="pd-hero-stat-label">Projects tracked</div>
          </div>
        </div>
        <div className="pd-about">
          <span className="pd-about-ic">i</span>
          <span>
            <strong>How to use this page:</strong> every tile below is clickable — open a side panel listing
            the exact projects behind that number. The <strong>Portfolio Health</strong> row surfaces risk signals
            (stale, churning, or undecided projects). Scroll down to search, preview, or permanently remove any indexed meeting file.
          </span>
        </div>
      </div>

      {statsErr && (
        <div className="pd-error">Could not load dashboard stats. Check backend connection.</div>
      )}

      {/* Row 1 — Portfolio status */}
      <div className="pd-section-label">Portfolio Status</div>
      <div className="pd-metrics-row">
        <MetricCard index={0} label="Total Projects"   value={stats?.total_projects      ?? "—"} icon={Icons.folder}   accent="#2563eb" onClick={tile("total")} />
        <MetricCard index={1} label="Active"           value={stats?.active_projects     ?? "—"} icon={Icons.active}   accent="#16a34a" onClick={tile("active")} />
        <MetricCard index={2} label="On Hold"          value={stats?.on_hold_projects    ?? "—"} icon={Icons.hold}     accent="#f59e0b" onClick={tile("on_hold")} />
        <MetricCard index={3} label="Completed"        value={stats?.completed_projects  ?? "—"} icon={Icons.check}    accent="#8b5cf6" onClick={tile("completed")} />
        <MetricCard index={4} label="At Risk"          value={stats?.at_risk_projects    ?? "—"} icon={Icons.risk}     accent="#dc2626" onClick={tile("at_risk")} />
        <MetricCard index={5} label="Total Meetings"   value={stats?.total_meetings      ?? "—"} icon={Icons.calendar} accent="#0891b2" onClick={tile("meetings")} />
        <MetricCard index={6} label="Decisions Logged" value={stats?.total_decisions     ?? "—"} icon={Icons.decision} accent="#f97316" onClick={tile("decisions")} />
      </div>

      {/* Row 2 — Health metrics */}
      <div className="pd-section-label" style={{ marginTop: 20 }}>Portfolio Health</div>
      <div className="pd-metrics-row">
        <MetricCard index={7}  label="Stale Projects"          value={stats?.stale_projects ?? "—"}                          icon={Icons.stale}      accent="#64748b" subLabel="no meeting in 90d"         onClick={tile("stale")} />
        <MetricCard index={8}  label="Status Churn"            value={stats?.churn_projects ?? "—"}                          icon={Icons.churn}      accent="#dc2626" subLabel="2+ status changes"         onClick={tile("churn")} />
        <MetricCard index={9}  label="No Decisions"            value={stats?.no_decision_projects ?? "—"}                    icon={Icons.noDecision} accent="#8b5cf6" subLabel="discussed, never decided"  onClick={tile("no_decisions")} />
        <MetricCard index={10} label="Avg Project Age"         value={stats ? formatAge(stats.avg_project_age_days) : "—"}   icon={Icons.age}        accent="#f97316" subLabel="first → last appearance"   onClick={tile("age")} />
        <MetricCard index={11} label="Action Items / Meeting"  value={stats?.action_item_density ?? "—"}                     icon={Icons.density}    accent="#0891b2" subLabel="avg across all meetings"   onClick={tile("density")} />
        <MetricCard index={12} label="Budget Exposure"         value={stats ? formatBudget(stats.total_budget_raw) : "—"}    icon={Icons.budget}     accent="#16a34a" subLabel="approx. total allocation"  onClick={tile("budget")} />
      </div>

      {/* Drilldown panel */}
      {activeFilter && stats && (
        <DrilldownPanel filter={activeFilter} stats={stats} onClose={() => setActiveFilter(null)} />
      )}

      {/* Charts row */}
      <div className="pd-charts-row">
        <div className="pd-panel">
          <div className="pd-panel-title">Most Discussed Projects</div>
          {stats ? (
            <div className="pd-top-projects">
              {stats.top_projects.map((p, i) => (
                <div key={p.project_id} className="pd-top-proj-row">
                  <span className="pd-top-rank">#{i + 1}</span>
                  <div className="pd-top-proj-info">
                    <span className="pd-top-proj-name" title={p.project_name}>{p.project_name}</span>
                    <span className="pd-top-proj-id">{p.project_id}</span>
                  </div>
                  <div className="pd-top-bar-wrap">
                    <div className="pd-top-bar" style={{ width: `${Math.round((p.count / (stats.top_projects[0]?.count || 1)) * 100)}%` }} />
                  </div>
                  <span className="pd-top-count">{p.count}</span>
                </div>
              ))}
            </div>
          ) : <div className="pd-loading"><span className="pd-spinner" /></div>}
        </div>

        <div className="pd-panel">
          <div className="pd-panel-title">Meeting Type Breakdown</div>
          {stats ? (
            <div className="pd-type-list">
              {typeEntries.map(([type, count]) => (
                <div key={type} className="pd-type-row">
                  <span className="pd-type-label">{type}</span>
                  <div className="pd-type-bar-wrap">
                    <div className="pd-type-bar" style={{ width: `${Math.round((count / maxType) * 100)}%` }} />
                  </div>
                  <span className="pd-type-count">{count}</span>
                </div>
              ))}
            </div>
          ) : <div className="pd-loading"><span className="pd-spinner" /></div>}
        </div>
      </div>

      {/* Meeting cadence chart */}
      <div className="pd-cadence-panel">
        <div className="pd-panel-title">Meeting Cadence — Monthly</div>
        {stats && Object.keys(stats.meetings_by_month).length > 0 ? (
          <CadenceChart data={stats.meetings_by_month} />
        ) : (
          <div className="pd-loading"><span className="pd-spinner" /> Loading…</div>
        )}
      </div>

      {/* Meeting files section */}
      <div className="pd-meetings-section">
        <div className="pd-meetings-header">
          <div className="pd-panel-title" style={{ padding: 0 }}>
            Meeting Files
            <span className="pd-meetings-count">{total} file{total !== 1 ? "s" : ""}</span>
          </div>
          <div className="pd-search-wrap">
            <span className="pd-search-icon">{Icons.search}</span>
            <input
              className="pd-search-input"
              placeholder="Search by filename or project name…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="pd-meetings-list">
          {meetingsLoading ? (
            <div className="pd-loading"><span className="pd-spinner" /> Loading…</div>
          ) : meetings.length === 0 ? (
            <div className="pd-empty">No meeting files found{search ? ` for "${search}"` : ""}.</div>
          ) : (
            meetings.map((m) => (
              <MeetingRow
                key={m.document_name}
                record={m}
                onDeleted={(docName) => {
                  setMeetings((prev) => prev.filter((r) => r.document_name !== docName));
                  setTotal((t) => t - 1);
                  setStats((s) => s ? { ...s, total_meetings: s.total_meetings - 1 } : s);
                }}
              />
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="pd-pagination">
            <button className="pd-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
            <span className="pd-page-info">Page {page} of {totalPages}</span>
            <button className="pd-page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
