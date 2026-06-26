import { useState } from "react";
import { loginUser } from "../api/client";
import { useAuth } from "../context/AuthContext";

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z" />
    </svg>
  );
}

function SearchHeroIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

const FEATURES = [
  "Semantic Search", "AI Summaries", "Decision Tracking", "Action Items",
  "Project History", "Budget Signals",
];
const FEATURES2 = [
  "Meeting Q&A", "Instant Recall", "Live Dashboard", "Chronological Timelines",
  "GPT-4o Powered", "Auto Extraction",
];

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const token = await loginUser(username.trim(), password);
      login(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      {/* animated aurora field */}
      <div className="auth-field">
        <div className="auth-conic" />
        <span className="auth-orb auth-orb-1" />
        <span className="auth-orb auth-orb-2" />
        <span className="auth-orb auth-orb-3" />
        <div className="auth-grid" />

        {/* large faint brand statement */}
        <div className="auth-bigword auth-bigword-1">MEETING</div>
        <div className="auth-bigword auth-bigword-2">INTELLIGENCE</div>

        {/* running feature marquees (about the app) */}
        <div className="auth-marquee auth-marquee-top">
          <div className="auth-track">
            {FEATURES.concat(FEATURES).map((f, i) => (
              <span key={i} className="auth-mq-item">{f}<span className="auth-mq-sep">◆</span></span>
            ))}
          </div>
        </div>
        <div className="auth-marquee auth-marquee-bottom">
          <div className="auth-track auth-track-rev">
            {FEATURES2.concat(FEATURES2).map((f, i) => (
              <span key={i} className="auth-mq-item">{f}<span className="auth-mq-sep">◆</span></span>
            ))}
          </div>
        </div>

        {/* drifting particles */}
        <div className="auth-particles">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="auth-particle" style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 6) * 0.9}s`,
              animationDuration: `${7 + (i % 5) * 2}s`,
            }} />
          ))}
        </div>

        <div className="auth-vignette" />

        {/* continuously running equalizer wave (brand signal motif) */}
        <div className="auth-wave">
          {Array.from({ length: 56 }).map((_, i) => (
            <span key={i} className="auth-wave-bar" style={{ animationDelay: `${(i % 14) * 0.12}s` }} />
          ))}
        </div>
      </div>

      {/* centered stack — animated brand tower + glass card */}
      <div className="auth-stack">

        {/* animated logo climbing like a tower */}
        <div className="auth-topbrand">
          <div className="auth-tower">
            <span className="auth-tower-glow" />
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="auth-tower-bar" style={{ animationDelay: `${i * 0.16}s` }} />
            ))}
            <span className="auth-tower-orbit" />
          </div>
          <div className="auth-topname">MoM&nbsp;Assist</div>
          <div className="auth-topphrase">Every decision, action item &amp; project — one question away.</div>
        </div>

        <div className="auth-card">
          <div className="auth-card-glow" />

          <div className="auth-eyebrow">
            <span className="auth-eyebrow-dot" /> Secure workspace access
          </div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-lead">
            Sign in to ask your meeting minutes anything — decisions, action items,
            and project history, instantly.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field-group">
              <label className="auth-label">Username</label>
              <input
                className="auth-input"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="your.username"
              />
            </div>

            <div className="auth-field-group">
              <label className="auth-label">Password</label>
              <div className="auth-pw-wrap">
                <input
                  className="auth-input auth-input-pw"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="auth-pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button
              className="auth-btn"
              type="submit"
              disabled={loading || !username.trim() || !password}
            >
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? "Signing in…" : "Sign in to workspace"}
            </button>
          </form>
        </div>{/* end auth-card */}

        {/* feature highlights + trust — on the dark background, not in the card */}
        <div className="auth-belowcard">
          <div className="auth-belowfeatures">
            <span className="auth-bf"><SearchHeroIcon /> Semantic search</span>
            <span className="auth-bf"><BrainIcon /> AI summaries</span>
            <span className="auth-bf"><DocIcon /> Auto extraction</span>
          </div>
          <div className="auth-belowfoot">
            <span className="auth-bf-pill"><LockIcon /> Encrypted</span>
            <span className="auth-bf-pill"><BoltIcon /> GPT-4o</span>
            <span className="auth-bf-copy">© 2026 MoM Assist</span>
          </div>
        </div>
      </div>{/* end auth-stack */}
    </div>
  );
}
