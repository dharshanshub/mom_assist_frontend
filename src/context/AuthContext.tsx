import { createContext, useCallback, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "mom_rag_token";

interface AuthContextValue {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  login: (token: string) => void;
  logout: () => void;
}

/** Decode the JWT payload client-side to read the username (sub claim).
 *  No signature verification needed — this is display-only; the backend
 *  validates the token on every API call. */
function usernameFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );

  const login = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setTokenState(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setTokenState(null);
  }, []);

  // Listen for 401 responses dispatched by the API client
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: !!token, token, username: usernameFromToken(token), login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export { TOKEN_KEY };
