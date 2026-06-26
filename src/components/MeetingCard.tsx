import type { MeetingMatch } from "../api/client";

interface Props {
  meeting: MeetingMatch;
  rank: number;
  onViewDocument: (m: MeetingMatch) => void;
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function dateParts(d: string): { day: string; mon: string; ok: boolean } {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return { day: "--", mon: "", ok: false };
  return { day: String(dt.getDate()).padStart(2, "0"), mon: MONTHS[dt.getMonth()], ok: true };
}

const fmtDate = (d: string) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const relTime = (d: string) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const days = Math.floor((Date.now() - dt.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

function scoreTone(score: number): "green" | "orange" | "slate" {
  if (score >= 0.82) return "green";
  if (score >= 0.68) return "orange";
  return "slate";
}

export function MeetingCard({ meeting, rank, onViewDocument }: Props) {
  const pct = Math.round(meeting.score * 100);
  const tone = scoreTone(meeting.score);
  const { day, mon } = dateParts(meeting.date);

  return (
    <div className="mc-card" style={{ animationDelay: `${Math.min(rank - 1, 8) * 60}ms` }}>
      <div className="mc-accent" />
      <div className="mc-main">

        {/* head */}
        <div className="mc-head">
          <div className="mc-datetok">
            <span className="mc-datetok-day">{day}</span>
            <span className="mc-datetok-mon">{mon}</span>
            <span className="mc-rank-badge">#{rank}</span>
          </div>

          <div className="mc-headtext">
            <div className="mc-title">{meeting.title}</div>
            <div className="mc-sub">{meeting.meeting_type} · Organized by {meeting.organizer}</div>
          </div>

          <div className="mc-score" data-tone={tone}>
            <span className="mc-score-num">{pct}%</span>
            <span className="mc-score-label">match</span>
          </div>
        </div>

        {/* stats */}
        <div className="mc-stats">
          <span className="mc-stat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {relTime(meeting.date)}
          </span>
          <span className="mc-stat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? "s" : ""}
          </span>
          <span className="mc-stat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            {meeting.decisions.length} decision{meeting.decisions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* topic chips */}
        {meeting.topics.length > 0 && (
          <div className="mc-chips">
            {meeting.topics.slice(0, 8).map((topic, i) => (
              <span key={topic} className={`mc-chip ${i % 2 === 0 ? "mc-chip-a" : "mc-chip-b"}`}>{topic}</span>
            ))}
            {meeting.topics.length > 8 && (
              <span className="mc-chip mc-chip-more">+{meeting.topics.length - 8}</span>
            )}
          </div>
        )}

        {/* action items preview */}
        {meeting.action_items.length > 0 && (
          <div className="mc-action">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span>
              <strong>{meeting.action_items.length} action item{meeting.action_items.length !== 1 ? "s" : ""}</strong> · {meeting.action_items[0]}
            </span>
          </div>
        )}

        {/* footer */}
        <div className="mc-foot">
          <div className="mc-foot-left">
            <span className="mc-type-badge">{meeting.meeting_type}</span>
            <span className="mc-date">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {fmtDate(meeting.date)}
            </span>
          </div>
          {meeting.blob_filename && (
            <button className="mc-view" onClick={() => onViewDocument(meeting)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              View Minutes
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
