
import { useEffect, useState } from 'react';
import App from './App';
import GridnovaLogin from './GridnovaLogin';

type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

export default function GridnovaAuthGate() {
  const [authState, setAuthState] =
    useState<AuthState>('checking');

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch('/auth/session', {
          credentials: 'same-origin',
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Session check failed');
        }

        const result = await response.json();

        if (active) {
          setAuthState(
            result.authenticated
              ? 'authenticated'
              : 'unauthenticated'
          );
        }
      } catch {
        if (active) {
          setAuthState('unauthenticated');
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  // Recheck sessions periodically while the dashboard is open.
  useEffect(() => {
    if (authState !== 'authenticated') return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch('/auth/session', {
          credentials: 'same-origin',
          cache: 'no-store',
        });

        if (!response.ok) {
          setAuthState('unauthenticated');
          return;
        }

        const result = await response.json();

        if (!result.authenticated) {
          setAuthState('unauthenticated');
        }
      } catch {
        // Temporary network failure: protected API endpoints
        // still enforce authentication on the server.
      }
    }, 30000);

    return () => window.clearInterval(interval);
  }, [authState]);

  if (authState === 'checking') {
    return (
      <div className="gridnova-auth-check">
        Checking Gridnova AI session...
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <GridnovaLogin
        onLogin={() => setAuthState('authenticated')}
      />
    );
  }

  return <App />;
}
