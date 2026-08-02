import { useState, useCallback } from 'react';

export interface SessionContext {
  memberId: number;
  memberName: string;
  isHost: boolean;
}

export function useLocalSession(token: string) {
  const key = `ledger_member_${token}`;
  
  const [session, setSessionState] = useState<SessionContext | null>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
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
      }
    } catch (err) {
      console.error('Failed to save session to localStorage', err);
    }
  }, [key]);

  return { session, setSession };
}
