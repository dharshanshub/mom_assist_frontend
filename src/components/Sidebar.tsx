import type { ChatSession } from "../hooks/useChatHistory";
import { ProfileMenu } from "./ProfileMenu";

type View = "chat" | "dashboard" | "tracker";

interface Props {
  sessions: ChatSession[];
  activeId: string | null;
  activeView: View;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onViewChange: (view: View) => void;
}

/* ── New brand mark: ascending "signal" bars with an orbiting pulse ──────────── */
function PulseMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3"  y="13" width="3.4" height="8"  rx="1.7" fill="white" fillOpacity=".7" />
      <rect x="8"  y="9"  width="3.4" height="12" rx="1.7" fill="white" fillOpacity=".85" />
      <rect x="13" y="5"  width="3.4" height="16" rx="1.7" fill="white" />
      <circle cx="19.4" cy="6.2" r="2.1" fill="white" />
      <circle cx="19.4" cy="6.2" r="3.6" stroke="white" strokeOpacity=".4" strokeWidth="1" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/>
      <rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>
    </svg>
  );
}

function TrackerIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2.5 7L14 4l2.5 8H21" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MsgIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupSessions(sessions: ChatSession[]) {
  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const older: ChatSession[] = [];
  const now = Date.now();
  for (const s of sessions) {
    const days = Math.floor((now - s.createdAt) / 86400000);
    if (days === 0) today.push(s);
    else if (days === 1) yesterday.push(s);
    else older.push(s);
  }
  return { today, yesterday, older };
}

const VIEW_META: Record<View, { title: string; sub: string }> = {
  chat:      { title: "Conversations", sub: "Ask your meetings anything" },
  dashboard: { title: "Project Dashboard", sub: "Portfolio metrics & health signals" },
  tracker:   { title: "Project Tracker", sub: "Chronological project histories" },
};

export function Sidebar({
  sessions, activeId, activeView, onNew, onSelect, onDelete, onViewChange,
}: Props) {
  const groups = groupSessions(sessions);

  const renderGroup = (label: string, items: ChatSession[]) => {
    if (items.length === 0) return null;
    return (
      <div className="sb-group" key={label}>
        <div className="sb-group-label">{label}</div>
        {items.map((s) => (
          <div
            key={s.id}
            className={`sb-item${s.id === activeId && activeView === "chat" ? " active" : ""}`}
            onClick={() => { onViewChange("chat"); onSelect(s.id); }}
          >
            <MsgIcon />
            <div className="sb-item-content">
              <div className="sb-item-title">{s.title}</div>
              <div className="sb-item-time">{relTime(s.createdAt)}</div>
            </div>
            <button
              className="sb-delete"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const meta = VIEW_META[activeView];

  return (
    <nav className="shell-nav">
      {/* ── Icon rail ─────────────────────────────────────────────── */}
      <div className="rail">
        <div className="rail-logo" title="MoM Assist"><PulseMark size={22} /></div>

        <button
          className={`rail-btn${activeView === "chat" ? " active" : ""}`}
          onClick={() => onViewChange("chat")}
          data-label="Chat"
        >
          <ChatIcon />
        </button>
        <button
          className={`rail-btn${activeView === "dashboard" ? " active" : ""}`}
          onClick={() => onViewChange("dashboard")}
          data-label="Dashboard"
        >
          <DashboardIcon />
        </button>
        <button
          className={`rail-btn${activeView === "tracker" ? " active" : ""}`}
          onClick={() => onViewChange("tracker")}
          data-label="Tracker"
        >
          <TrackerIcon />
        </button>

        <div className="rail-spacer" />

        <div className="rail-profile"><ProfileMenu /></div>
      </div>

      {/* ── Contextual panel — chat only; dashboard & tracker run full-width ── */}
      {activeView === "chat" && (
        <div className="ctx-panel">
          <div className="ctx-head">
            <div className="ctx-title">{meta.title}</div>
            <div className="ctx-sub">{meta.sub}</div>
          </div>

          <div className="ctx-action">
            <button className="ctx-new-btn" onClick={() => { onViewChange("chat"); onNew(); }}>
              <PlusIcon /> New Conversation
            </button>
          </div>
          <div className="ctx-scroll">
            {sessions.length === 0 ? (
              <div className="sb-empty">
                <div className="sb-empty-icon"><MsgIcon /></div>
                <div className="sb-empty-text">No conversations yet</div>
                <div className="sb-empty-sub">Your conversation history will appear here</div>
              </div>
            ) : (
              <>
                {renderGroup("Today", groups.today)}
                {renderGroup("Yesterday", groups.yesterday)}
                {renderGroup("Older", groups.older)}
              </>
            )}
          </div>
          <div className="ctx-foot">
            <span className="ctx-foot-num">{sessions.length}</span>
            session{sessions.length !== 1 ? "s" : ""} saved locally
          </div>
        </div>
      )}
    </nav>
  );
}
