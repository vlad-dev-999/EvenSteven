import { useState, useCallback } from 'react';

export interface SessionContext {
  memberId: number;
  memberName: string;
  isHost: boolean;
  personalPin?: string;
}

export function useLocalSession(token: string) {
  const key = `evensteven_member_${token}`;

  const [session, setSessionState] = useState<SessionContext | null>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) return JSON.parse(item);
      // Backwards compat: try old key
      const oldItem = localStorage.getItem(`ledger_member_${token}`);
      return oldItem ? JSON.parse(oldItem) : null;
    } catch {
      return null;
    }
  });

  const setSession = useCallback((newSession: SessionContext | null) => {
    setSessionState(newSession);
    try {
      if (newSession) {
        localStorage.setItem(key, JSON.stringify(newSession));
      } else {
        localStorage.removeItem(key);
        localStorage.removeItem(`ledger_member_${token}`);
      }
    } catch {
      // ignore
    }
  }, [key, token]);

  return { session, setSession };
}
