
import { useState, type FormEvent } from 'react';

interface GridnovaLoginProps {
  onLogin: () => void;
}

export default function GridnovaLogin({
  onLogin,
}: GridnovaLoginProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password) {
      setError('Enter your administrator password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.detail || 'Unable to sign in.'
        );
      }

      setPassword('');
      onLogin();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Login failed.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="gridnova-login-page">
      <section className="gridnova-login-card">
        <div className="gridnova-login-logo">G</div>

        <h1>GRIDNOVA AI</h1>
        <p className="gridnova-login-subtitle">
          Intelligent Energy Management Platform
        </p>

        <h2>Control Centre Login</h2>
        <p>
          Secure administrator access to live monitoring,
          load management, and analytics.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="gridnova-password">
            Administrator Password
          </label>

          <input
            id="gridnova-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Enter administrator password"
            required
          />

          {error && (
            <p className="gridnova-login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In Securely'}
          </button>
        </form>

        <footer>
          Sense. Detect. Decide. Protect.
        </footer>
      </section>
    </main>
  );
}
