import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

function SignOutIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/** Avatar button with a dropdown showing the signed-in user and Sign out. */
export function ProfileMenu() {
  const { username, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (username?.[0] ?? "U").toUpperCase();

  return (
    <div className="profile-wrap" ref={wrapRef}>
      <button
        className="chat-header-avatar"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
      >
        <span>{initial}</span>
        <div className="chat-header-avatar-status" />
      </button>

      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-user">
            <div className="profile-menu-avatar">{initial}</div>
            <div className="profile-menu-names">
              <div className="profile-menu-name">{username ?? "User"}</div>
              <div className="profile-menu-sub">Signed in</div>
            </div>
          </div>
          <div className="profile-menu-divider" />
          <button className="profile-menu-item" role="menuitem" onClick={logout}>
            <SignOutIcon />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
