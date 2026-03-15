const TOKEN_KEY = 'tj_access_token';
const REFRESH_KEY = 'tj_refresh_token';
const USER_KEY = 'tj_user';

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

type AuthChangeCallback = (event: string, session: AuthSession | null) => void;

const listeners: Set<AuthChangeCallback> = new Set();
let currentSession: AuthSession | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function notifyListeners(event: string, session: AuthSession | null) {
  for (const cb of listeners) {
    try { cb(event, session); } catch {}
  }
}

function saveSession(session: AuthSession) {
  currentSession = session;
  localStorage.setItem(TOKEN_KEY, session.access_token);
  localStorage.setItem(REFRESH_KEY, session.refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  scheduleRefresh();
}

function clearSession() {
  currentSession = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  // Refresh 5 minutes before expiry (token lasts 1 hour)
  refreshTimer = setTimeout(async () => {
    try {
      await refreshSession();
    } catch {
      clearSession();
      notifyListeners('SIGNED_OUT', null);
    }
  }, 50 * 60 * 1000); // 50 minutes
}

async function refreshSession(): Promise<AuthSession | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    clearSession();
    notifyListeners('SIGNED_OUT', null);
    return null;
  }

  const data = await res.json();
  const session: AuthSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
  };
  saveSession(session);
  notifyListeners('TOKEN_REFRESHED', session);
  return session;
}

export const authClient = {
  async getSession(): Promise<{ data: { session: AuthSession | null } }> {
    if (currentSession) {
      return { data: { session: currentSession } };
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    const userStr = localStorage.getItem(USER_KEY);

    if (token && refreshToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        currentSession = { access_token: token, refresh_token: refreshToken, user };
        scheduleRefresh();
        return { data: { session: currentSession } };
      } catch {}
    }

    if (refreshToken) {
      const session = await refreshSession();
      return { data: { session } };
    }

    return { data: { session: null } };
  },

  async signUp(email: string, password: string, metadata: {
    first_name: string;
    last_name: string;
    phone?: string;
    company?: string;
  }): Promise<{ error: Error | null }> {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, metadata }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { error: new Error(data.error || 'Signup failed') };
      }

      const session: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      };
      saveSession(session);
      notifyListeners('SIGNED_IN', session);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Signup failed') };
    }
  },

  async signIn(email: string, password: string): Promise<{ error: Error | null }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { error: new Error(data.error || 'Login failed') };
      }

      const session: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      };
      saveSession(session);
      notifyListeners('SIGNED_IN', session);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Login failed') };
    }
  },

  async signOut(): Promise<void> {
    clearSession();
    notifyListeners('SIGNED_OUT', null);
  },

  onAuthStateChange(callback: AuthChangeCallback): { data: { subscription: { unsubscribe: () => void } } } {
    listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => { listeners.delete(callback); },
        },
      },
    };
  },

  getAccessToken(): string | null {
    return currentSession?.access_token || localStorage.getItem(TOKEN_KEY);
  },

  refreshSession,
};
