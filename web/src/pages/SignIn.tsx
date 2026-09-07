import { useState } from "react";
import { signInWithGoogle, signInOrSignUp } from "../lib/firebase";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      setError(`${err.code ?? "unknown"}: ${err.message ?? "Couldn't sign in."}`);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInOrSignUp(email.trim(), password);
    } catch (err: any) {
      console.error("Email sign-in error:", err);
      setError(`${err.code ?? "unknown"}: ${err.message ?? "Couldn't sign in."}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signin-page">
      <div className="signin-card">
        <h1 className="signin-title">Personal Gemini Journal</h1>
        <p className="signin-subtitle">A quiet space to think things through.</p>

        <button className="btn btn-google" onClick={handleGoogle}>
          Continue with Google
        </button>

        <div className="signin-divider"><span>or</span></div>

        <form onSubmit={handleEmailSubmit} className="signin-form">
          <input
            type="email"
            placeholder="email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "..." : "Continue"}
          </button>
        </form>

        {error && <p className="signin-error">{error}</p>}

        <p className="signin-hint">
          New here? Just enter an email and password — no separate signup step.
        </p>
      </div>
    </div>
  );
}