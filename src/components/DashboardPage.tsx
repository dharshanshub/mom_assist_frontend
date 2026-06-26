import { useCallback, useEffect, useRef, useState } from "react";
import {
  getKnowledgeBaseStats,
  listMeetingsPage,
  deleteMeeting,
  getDocumentUrl,
  type MeetingRecord,
  type KnowledgeBaseStats,
} from "../api/client";
import { ProfileMenu } from "./ProfileMenu";
import { useToast } from "../context/ToastContext";

const TYPE_COLORS: Record<string, string> = {
  Standup:       "#2563eb",
  Planning:      "#f97316",
  Review:        "#1d4ed8",
  Retrospective: "#ea580c",
  Client:        "#0284c7",
  Board:         "#c2410c",
  "All-Hands":   "#3b82f6",
  "One-on-One":  "#fb923c",
  Other:         "#64748b",
};

const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
      {sub && <div className="dash-stat-sub">{sub}</div>}
    </div>
  );
}

/** Animates a number from 0 to its final value on mount (≈700 ms ease-out). */
function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 700;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString();
  return <>{formatted}{suffix}</>;
}

/** Ghost stat cards shown while pool stats compute. */
function StatsSkeleton() {
  return (
    <div className="dash-stats-row">
      {[0, 1, 2, 3].map((i) => (
        <div className="dash-stat-card" key={i}>
          <div className="skel" style={{ width: i < 2 ? 72 : 120, height: 28, marginBottom: 10 }} />
          <div className="skel" style={{ width: 100, height: 11, marginBottom: 8 }} />
          <div className="skel" style={{ width: "80%", height: 10 }} />
        </div>
      ))}
    </div>
  );
}

/** Ghost table rows shown while the meeting page loads. */
function TableSkeleton() {
  return (
    <div className="dash-table-wrap">
      <div className="dash-skel-table">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="dash-skel-row" key={i} style={{ animationDelay: `${i * 70}ms` }}>
            <div className="skel skel-circle" style={{ width: 30, height: 30, flexShrink: 0 }} />
            <div style={{ flex: 1.4, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="skel" style={{ width: "65%", height: 12 }} />
              <div className="skel" style={{ width: "40%", height: 9 }} />
            </div>
            <div className="skel" style={{ flex: 1, height: 12 }} />
            <div className="skel skel-pill" style={{ width: 70, height: 20, flexShrink: 0 }} />
            <div className="skel" style={{ flex: 1.2, height: 12 }} />
            <div className="skel" style={{ width: 90, height: 26, borderRadius: 7, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  name, onConfirm, onCancel, loading,
}: { name: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Remove meeting</div>
        <div className="modal-body">
          Remove <strong>{name}</strong> from the knowledge base? This deletes all indexed
          data and the source PDF from storage. This cannot be undone.
        </div>
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="modal-btn-delete" onClick={onConfirm} disabled={loading}>
            {loading ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { toast } = useToast();

  // ── Stats (separate, cached server-side) ─────────────────────────────────
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Paginated meetings ─────────────────────────────────────────────────────
  const [records, setRecords] = useState<MeetingRecord[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cursor stack: index 0 = first page (cursor=null), pushed on "next", popped on "prev"
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // Server-reported total (-1 = not yet known)
  const [serverTotal, setServerTotal] = useState(-1);

  // ── Table controls ────────────────────────────────────────────────────────
  const [filterText, setFilterText] = useState("");
  const [filterType, setFilterType] = useState("All");
  // True when records[] holds server-side search results (not a pagination page)
  const [searchMode, setSearchMode] = useState(false);
  const searchModeRef = useRef(false);

  // ── Delete + document ─────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<MeetingRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [docLoading, setDocLoading] = useState<Record<string, boolean>>({});

  // Guard against setting state after unmount
  const mounted = useRef(true);
  useEffect(() => {
    searchModeRef.current = searchMode;
  }, [searchMode]);
  useEffect(() => { return () => { mounted.current = false; }; }, []);

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await getKnowledgeBaseStats();
      if (!mounted.current) return;
      setStats(s);
      setServerTotal(s.total_meetings);
    } catch (err) {
      if (!mounted.current) return;
      // Stats failure is non-fatal — meetings can still load
      logger.warn?.("stats_load_failed", err);
    } finally {
      if (mounted.current) setStatsLoading(false);
    }
  }, []);

  const loadPage = useCallback(async (cursor: string | null) => {
    setPageLoading(true);
    setError(null);
    try {
      const page = await listMeetingsPage(cursor, PAGE_SIZE);
      if (!mounted.current) return;
      setRecords(page.meetings);
      setNextCursor(page.next_cursor);
      // Update total from page response if stats haven't loaded yet
      if (page.total >= 0) setServerTotal((prev) => (prev < 0 ? page.total : prev));
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load meetings");
    } finally {
      if (mounted.current) setPageLoading(false);
    }
  }, []);

  // Current meeting type in a ref so the debounce closure always reads the latest value
  // without needing filterType in its dependency array (which would cause double-fires).
  const filterTypeRef = useRef("All");

  const loadFiltered = useCallback(async (term: string, type: string) => {
    setPageLoading(true);
    setError(null);
    setSearchMode(true);
    try {
      const page = await listMeetingsPage(null, 20, term || undefined, type !== "All" ? type : undefined);
      if (!mounted.current) return;
      setRecords(page.meetings);
      setNextCursor(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      if (mounted.current) setPageLoading(false);
    }
  }, []);

  // Meeting-type dropdown: fire immediately (no debounce), update ref before the call.
  const handleTypeChange = useCallback((newType: string) => {
    setFilterType(newType);
    filterTypeRef.current = newType;
    const term = filterText.trim();
    if (!term && newType === "All") {
      if (searchModeRef.current) {
        setSearchMode(false);
        setCursorStack([null]);
        loadPage(null);
      }
      return;
    }
    loadFiltered(term, newType);
  }, [filterText, loadPage, loadFiltered]);

  // Text input: debounce 350 ms, read current type from ref to avoid double-fires.
  useEffect(() => {
    const term = filterText.trim();
    if (!term) {
      if (filterTypeRef.current === "All" && searchModeRef.current) {
        setSearchMode(false);
        setCursorStack([null]);
        loadPage(null);
      }
      // If a type filter is still active, stay in filter mode — handleTypeChange already loaded the view.
      return;
    }
    const timer = setTimeout(() => loadFiltered(term, filterTypeRef.current), 350);
    return () => clearTimeout(timer);
  }, [filterText, loadPage, loadFiltered]);

  // Load stats + first page in parallel on mount
  useEffect(() => {
    Promise.all([loadStats(), loadPage(null)]);
  }, []);

  // ── Pagination ────────────────────────────────────────────────────────────

  const currentPage = cursorStack.length; // 1-indexed

  const handleNext = useCallback(() => {
    if (!nextCursor) return;
    const newStack = [...cursorStack, nextCursor];
    setCursorStack(newStack);
    loadPage(nextCursor);
  }, [cursorStack, nextCursor, loadPage]);

  const handlePrev = useCallback(() => {
    if (cursorStack.length <= 1) return;
    const newStack = cursorStack.slice(0, -1);
    setCursorStack(newStack);
    loadPage(newStack[newStack.length - 1]);
  }, [cursorStack, loadPage]);

  const handleFirst = useCallback(() => {
    setCursorStack([null]);
    loadPage(null);
  }, [loadPage]);

  const handleRefresh = useCallback(() => {
    setCursorStack([null]);
    Promise.all([loadStats(), loadPage(null)]);
  }, [loadStats, loadPage]);

  // Both text and type are now filtered server-side; records is already the result.
  const filtered = records;

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMeeting(deleteTarget.meeting_id);
      setRecords((prev) => prev.filter((r) => r.meeting_id !== deleteTarget.meeting_id));
      // Decrement local total — server cache was invalidated by the delete endpoint
      setServerTotal((prev) => Math.max(0, prev - 1));
      setStats((prev) => prev ? { ...prev, total_meetings: Math.max(0, prev.total_meetings - 1) } : prev);
      toast(`Removed ${deleteTarget.title} from the knowledge base`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      toast("Failed to remove meeting", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ── Document ──────────────────────────────────────────────────────────────

  const handleViewDocument = useCallback(async (meetingId: string) => {
    setDocLoading((prev) => ({ ...prev, [meetingId]: true }));
    try {
      const url = await getDocumentUrl(meetingId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load document");
    } finally {
      setDocLoading((prev) => ({ ...prev, [meetingId]: false }));
    }
  }, []);

  // ── Pagination display helpers ─────────────────────────────────────────────
  const totalKnown = serverTotal >= 0;
  const pageStart = searchMode ? 1 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = pageStart + filtered.length - 1;
  const totalPages = totalKnown ? Math.ceil(serverTotal / PAGE_SIZE) : null;
  const typeOptions = [
    "All", "Standup", "Planning", "Review", "Retrospective",
    "Client", "Board", "All-Hands", "One-on-One", "Other",
  ];

  return (
    <div className="dash-pane">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="dash-header">
        <div className="dash-header-left">
          <div className="dash-header-title">Knowledge Base</div>
          <div className="dash-header-sub">
            {searchMode
              ? `Search results across all ${totalKnown ? serverTotal.toLocaleString() : ""} meetings`
              : totalKnown
              ? `${serverTotal.toLocaleString()} meetings · paginated ${PAGE_SIZE}/page`
              : "Manage your indexed meeting minutes"}
          </div>
        </div>
        <div className="dash-header-right">
          <button className="dash-refresh-btn" onClick={handleRefresh} disabled={pageLoading || statsLoading} title="Refresh">
            <RefreshIcon spinning={pageLoading || statsLoading} />
            Refresh
          </button>
          <ProfileMenu />
        </div>
      </div>

      {error && <div className="dash-error">{error}</div>}

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      {statsLoading && !stats ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="dash-stats-row">
          <StatCard
            label="Meetings in pool"
            value={<CountUp value={stats.total_meetings} />}
            sub={stats.last_added_at ? `Last added ${formatDate(stats.last_added_at)}` : undefined}
          />
          <StatCard
            label="Avg. attendees"
            value={<CountUp value={stats.avg_attendees} decimals={1} />}
            sub={stats.is_sampled ? "based on sample" : "across all meetings"}
          />
          <div className="dash-stat-card dash-seniority-card">
            <div className="dash-stat-label">Meeting type mix</div>
            <div className="dash-seniority-bars">
              {Object.entries(stats.type_distribution).map(([t, count]) => (
                <div key={t} className="dash-seniority-row">
                  <span className="dash-seniority-label">{t}</span>
                  <div className="dash-seniority-bar-wrap">
                    <div
                      className="dash-seniority-bar-fill"
                      style={{
                        width: `${Math.round((count / Math.max(1, stats.total_meetings)) * 100)}%`,
                        background: TYPE_COLORS[t] ?? "#2563eb",
                      }}
                    />
                  </div>
                  <span className="dash-seniority-count">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top topics */}
          <div className="dash-stat-card">
            <div className="dash-stat-label">Top topics in pool</div>
            <div className="dash-top-skills">
              {stats.top_topics.slice(0, 8).map((topic) => (
                <span key={topic} className="dash-skill-chip">{topic}</span>
              ))}
            </div>
          </div>

          {/* Top organizers */}
          <div className="dash-stat-card">
            <div className="dash-stat-label">Top organizers</div>
            <div className="dash-top-skills">
              {stats.top_organizers.slice(0, 8).map((o) => (
                <span key={o} className="dash-skill-chip">{o}</span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="dash-controls">
        <input
          className="dash-search-input"
          placeholder="Search all meetings by title or organizer…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <select
          className="dash-seniority-select"
          value={filterType}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          {typeOptions.map((o) => (
            <option key={o} value={o}>{o === "All" ? "All meeting types" : o}</option>
          ))}
        </select>
        <span className="dash-result-count">
          {searchMode
            ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} across all meetings`
            : totalKnown
            ? `${serverTotal.toLocaleString()} total meetings`
            : `${records.length} loaded`}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {pageLoading && records.length === 0 ? (
        <TableSkeleton />
      ) : records.length === 0 && !pageLoading ? (
        <div className="dash-empty">
          <div className="dash-empty-icon"><DatabaseIcon /></div>
          <div className="dash-empty-title">No meetings indexed yet</div>
          <div className="dash-empty-sub">Upload and index meeting minutes using the Upload Minutes button.</div>
        </div>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th className="dash-th dash-th-num">#</th>
                <th className="dash-th">Title</th>
                <th className="dash-th">Organizer</th>
                <th className="dash-th">Date</th>
                <th className="dash-th">Type</th>
                <th className="dash-th">Attendees</th>
                <th className="dash-th">Top Topics</th>
                <th className="dash-th">Indexed</th>
                <th className="dash-th dash-th-action">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.meeting_id} className="dash-tr">
                  <td className="dash-td dash-td-num">{pageStart + i}</td>
                  <td className="dash-td dash-td-name">
                    <div className="dash-name">{r.title}</div>
                    {r.decisions.length > 0 && (
                      <div className="dash-industry">{r.decisions.length} decision{r.decisions.length !== 1 ? "s" : ""}</div>
                    )}
                  </td>
                  <td className="dash-td">{r.organizer}</td>
                  <td className="dash-td dash-td-loc">{r.date}</td>
                  <td className="dash-td">
                    <span
                      className="dash-seniority-badge"
                      style={{
                        borderColor: TYPE_COLORS[r.meeting_type] ?? "#2563eb",
                        color: TYPE_COLORS[r.meeting_type] ?? "#2563eb",
                      }}
                    >
                      {r.meeting_type}
                    </span>
                  </td>
                  <td className="dash-td dash-td-exp">{r.attendees.length}</td>
                  <td className="dash-td">
                    <div className="dash-skills-cell">
                      {r.topics.slice(0, 4).map((t) => (
                        <span key={t} className="dash-skill-chip-sm">{t}</span>
                      ))}
                      {r.topics.length > 4 && (
                        <span className="dash-skill-more">+{r.topics.length - 4}</span>
                      )}
                    </div>
                  </td>
                  <td className="dash-td dash-td-date">{formatDate(r.indexed_at)}</td>
                  <td className="dash-td dash-td-action">
                    <button
                      className="dash-view-btn"
                      title={r.blob_filename ? "Open meeting minutes PDF in new tab" : "No PDF uploaded for this meeting"}
                      disabled={!r.blob_filename || !!docLoading[r.meeting_id]}
                      onClick={() => handleViewDocument(r.meeting_id)}
                    >
                      {docLoading[r.meeting_id] ? <SpinnerIcon /> : <EyeIcon />}
                      {docLoading[r.meeting_id] ? "Loading…" : "View Minutes"}
                    </button>
                    <button
                      className="dash-delete-btn"
                      title="Remove from knowledge base"
                      onClick={() => setDeleteTarget(r)}
                    >
                      <TrashIcon />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Pagination controls — hidden in search mode ─────────────────── */}
          {searchMode ? (
            <div className="dash-pagination">
              <span className="dash-page-info">
                {pageLoading
                  ? "Searching…"
                  : `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${filterText.trim()}"  ·  clear search to browse all`}
              </span>
            </div>
          ) : (
            <div className="dash-pagination">
              <button
                className="dash-page-btn"
                onClick={handleFirst}
                disabled={currentPage === 1 || pageLoading}
                title="First page"
              >«</button>
              <button
                className="dash-page-btn"
                onClick={handlePrev}
                disabled={currentPage === 1 || pageLoading}
                title="Previous page"
              >‹</button>

              <span className="dash-page-info">
                {pageLoading ? (
                  "Loading…"
                ) : (
                  <>
                    Page {currentPage}{totalPages ? ` of ${totalPages}` : ""}
                    <span className="dash-page-range">
                      &nbsp;· showing {pageStart}–{pageEnd} of {totalKnown ? serverTotal.toLocaleString() : "?"}
                    </span>
                  </>
                )}
              </span>

              <button
                className="dash-page-btn"
                onClick={handleNext}
                disabled={!nextCursor || pageLoading}
                title="Next page"
              >›</button>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: "spin 0.8s linear infinite" }}>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      style={{ animation: spinning ? "spin 1s linear infinite" : "none" }}>
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}

// Minimal console shim so logger.warn doesn't throw in browser
const logger = { warn: (..._args: unknown[]) => {} };
