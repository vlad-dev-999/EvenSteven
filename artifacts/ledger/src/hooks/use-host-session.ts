import { useState, useCallback } from 'react';

const HOST_TOKEN_KEY = 'evensteven_host_token';

export function useHostSession() {
  const [token, setTokenState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(HOST_TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const setToken = useCallback((newToken: string | null) => {
    setTokenState(newToken);
    try {
      if (newToken) {
        localStorage.setItem(HOST_TOKEN_KEY, newToken);
      } else {
        localStorage.removeItem(HOST_TOKEN_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback(() => setToken(null), [setToken]);

  return { token, setToken, logout, isAuthenticated: !!token };
}

export function getStoredHostToken(): string | null {
  try {
    return localStorage.getItem(HOST_TOKEN_KEY);
  } catch {
    return null;
  }
}
