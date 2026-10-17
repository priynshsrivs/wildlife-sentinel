import { useState } from "react";
import { ArrowRight, ShieldCheck, LogOut, Leaf } from "lucide-react";
import forest from "../assets/dashboard-bg.webp";
import { API_BASE, apiFetch, setToken } from "../api/client";
export default function AuthGate({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setToken(credential);
    try {
      const response = await apiFetch(`${API_BASE}/auth/me`);
      if (!response.ok)
        throw new Error("Invalid access token or server unavailable");
      setCredential("");
      setAuthenticated(true);
    } catch (failure) {
      setToken("");
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  if (authenticated)
    return (
      <>
        <button
          className="signout-button"
          onClick={() => {
            setToken("");
            setAuthenticated(false);
          }}
        >
          <LogOut size={14} />
          Sign out
        </button>
        {children}
      </>
    );
  return (
    <main className="auth-page">
      <div
        className="auth-scenery"
        style={{
          backgroundImage: `linear-gradient(180deg, #08120b30, #08120be8), url(${forest})`,
        }}
      >
        <div className="auth-brand">
          <ShieldCheck size={25} />
          <span>WILDLIFE SENTINEL</span>
        </div>
        <div className="auth-story">
          <span className="eyebrow">INTELLIGENCE FOR THE WILD</span>
          <h1>
            Every signal matters.
            <br />
            Every species counts.
          </h1>
          <p>
            A connected view of your reserve, bringing vision, acoustic
            intelligence and field response together.
          </p>
          <span className="auth-story-caption">
            <Leaf size={16} /> Built for the people who protect our wild.
          </span>
        </div>
      </div>
      <div className="auth-form-wrap">
        <form onSubmit={login} className="auth-form">
          <span className="auth-shield">
            <ShieldCheck size={27} />
          </span>
          <span className="eyebrow">RESERVE COMMAND CENTER</span>
          <h2>Welcome to Sentinel</h2>
          <p>Sign in to your wildlife monitoring workspace.</p>
          <label htmlFor="access-token">Access token</label>
          <input
            id="access-token"
            type="password"
            autoComplete="off"
            placeholder="Enter your access token"
            required
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            aria-describedby={error ? "auth-error" : "token-help"}
            aria-invalid={!!error}
          />
          <button className="auth-submit" disabled={busy}>
            {busy ? "Connecting…" : "Open command center"}
            <ArrowRight size={17} />
          </button>
          {error && (
            <p id="auth-error" className="auth-error" role="alert">
              {error}
            </p>
          )}
          <small id="token-help">
            Use the role token supplied by your administrator. It stays in
            memory until sign-out or reload.
          </small>
          <div className="auth-footer">
            <ShieldCheck size={14} /> Secure access · Wildlife Sentinel
          </div>
        </form>
      </div>
    </main>
  );
}
