import { useEffect, useState } from "react";
import type { MeetingMatch } from "../api/client";
import { getDocumentUrl } from "../api/client";

interface Props {
  meeting: MeetingMatch;
  onClose: () => void;
}

const AVATAR_BG = [
  "#4f46e5", "#7c3aed", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#db2777", "#2563eb",
];
const avatarBg = (title: string) => AVATAR_BG[title.charCodeAt(0) % AVATAR_BG.length];
const initials = (title: string) =>
  title.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function scoreScheme(score: number) {
  if (score >= 0.82) return { bg: "rgba(22,163,74,0.09)",  border: "rgba(22,163,74,0.28)",  color: "#15803d", label: "Excellent" };
  if (score >= 0.68) return { bg: "rgba(249,115,22,0.09)", border: "rgba(249,115,22,0.28)", color: "#c2410c", label: "Good" };
  return { bg: "rgba(37,99,235,0.09)", border: "rgba(37,99,235,0.28)", color: "#1d4ed8", label: "Fair" };
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function DocumentDrawer({ meeting, onClose }: Props) {
  const pct = Math.round(meeting.score * 100);
  const scheme = scoreScheme(meeting.score);

  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFetchError(null);
    setDocUrl(null);

    getDocumentUrl(meeting.id)
      .then((url) => {
        if (!cancelled) setDocUrl(url);
      })
      .catch((err: Error) => {
        if (!cancelled) setFetchError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [meeting.id]);

  return (
    <>
      {/* backdrop */}
      <div className="rd-overlay" onClick={onClose} />

      {/* drawer panel */}
      <div className="rd-panel">

        {/* ── Header ─────────────────────────────── */}
        <div className="rd-header">
          <div className="rd-header-stripe" />

          <div className="rd-header-body">
            {/* avatar + title */}
            <div className="rd-candidate-row">
              <div className="rd-avatar" style={{ background: avatarBg(meeting.title) }}>
                {initials(meeting.title)}
              </div>
              <div className="rd-candidate-info">
                <div className="rd-candidate-name">{meeting.title}</div>
                <div className="rd-candidate-title">{meeting.meeting_type} · {meeting.organizer}</div>
                <div className="rd-candidate-meta">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {meeting.date}
                  <span className="rd-meta-dot" />
                  {meeting.attendees.length} attendees
                </div>
              </div>
              <div
                className="rd-score-pill"
                style={{ background: scheme.bg, borderColor: scheme.border, color: scheme.color }}
              >
                {pct}%
                <span className="rd-score-label">{scheme.label}</span>
              </div>
            </div>

            {/* actions row */}
            <div className="rd-actions">
              <div className="rd-file-badge">
                <FileIcon />
                {meeting.blob_filename ?? `${meeting.id}.pdf`}
              </div>
              <div className="rd-btn-group">
                {docUrl ? (
                  <a
                    className="rd-btn rd-btn-download"
                    href={docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={`${meeting.title.replace(/ /g, "_")}_minutes.pdf`}
                  >
                    <DownloadIcon />
                    Open / Download PDF
                  </a>
                ) : (
                  <button className="rd-btn rd-btn-download" disabled>
                    <DownloadIcon />
                    {fetchError ? "Unavailable" : "Loading…"}
                  </button>
                )}
                <button className="rd-btn rd-btn-close" onClick={onClose}>
                  <CloseIcon />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── PDF viewer ──────────────────────────── */}
        <div className="rd-body">
          {fetchError ? (
            <div className="rd-load-error">{fetchError}</div>
          ) : docUrl ? (
            <iframe
              className="rd-iframe"
              src={docUrl}
              title={`${meeting.title} Minutes`}
            />
          ) : (
            <div className="rd-skeleton">
              <div className="rd-skel-page">
                <div className="skel" style={{ width: "55%", height: 18, marginBottom: 18 }} />
                <div className="skel" style={{ width: "35%", height: 11, marginBottom: 28 }} />
                {[90, 100, 96, 84, 100, 92, 70].map((w, i) => (
                  <div className="skel" key={i} style={{ width: `${w}%`, height: 10, marginBottom: 11 }} />
                ))}
                <div className="skel" style={{ width: "45%", height: 13, margin: "26px 0 14px" }} />
                {[100, 94, 88].map((w, i) => (
                  <div className="skel" key={`b${i}`} style={{ width: `${w}%`, height: 10, marginBottom: 11 }} />
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
