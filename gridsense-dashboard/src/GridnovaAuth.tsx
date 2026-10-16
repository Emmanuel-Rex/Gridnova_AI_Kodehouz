
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

type AuthState = 'checking' | 'logged-out' | 'logged-in';

export default function GridnovaAuth({
  children,
}: {
  children: ReactNode;
}) {
  const [auth, setAuth] = useState<AuthState>('checking');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetch('/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Session check failed');
        return res.json();
      })
      .then((data) => {
        if (active) {
          setAuth(data.authenticated ? 'logged-in' : 'logged-out');
        }
      })
      .catch(() => {
        if (active) {
          setError('Unable to verify session. Please refresh.');
          setAuth('logged-out');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? 'Too many login attempts. Try again later.'
            : 'Invalid password or login unavailable.'
        );
      }

      setPassword('');
      setAuth('logged-in');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  if (auth === 'checking') {
    return (
      <div style={pageStyle}>
        <p>Checking Gridnova AI session...</p>
      </div>
    );
  }

  if (auth === 'logged-in') {
    return <>{children}</>;
  }

  return (
    <main style={pageStyle}>
      <form onSubmit={login} style={cardStyle}>
        <div style={{ color: '#38dec5', fontWeight: 800 }}>
          GRIDNOVA AI
        </div>

        <h1>Control Centre Login</h1>

        <p style={{ color: '#9db5d1' }}>
          Sign in to access energy monitoring and load management.
        </p>

        <label htmlFor="gridnova-password">Password</label>

        <input
          id="gridnova-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          style={inputStyle}
        />

        {error && (
          <p role="alert" style={{ color: '#ff9e9e' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          style={buttonStyle}
        >
          {busy ? 'Signing in...' : 'Sign In'}
        </button>

        <p style={{ color: '#8da8c8', fontSize: 12 }}>
          Sense. Detect. Decide. Protect.
        </p>
      </form>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: '#07111f',
  color: '#f0f7ff',
  padding: 24,
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  display: 'grid',
  gap: 16,
  padding: 32,
  background: '#112033',
  border: '1px solid #29445d',
  borderRadius: 16,
};

const inputStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 8,
  border: '1px solid #41617e',
  background: '#091627',
  color: 'white',
};

const buttonStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 8,
  border: 0,
  background: '#38d6b8',
  color: '#07111f',
  fontWeight: 700,
  cursor: 'pointer',
};
