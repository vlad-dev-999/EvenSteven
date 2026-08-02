import { useState, useCallback } from 'react';

export interface PersonSession {
  personId: number;
  personName: string;
  houseId: number;
  houseName: string | null;
  houseAccentColor: string | null;
  houseCrest: string | null;
}

const PERSON_SESSION_KEY = 'evensteven_person';

export function usePersonSession() {
  const [session, setSessionState] = useState<PersonSession | null>(() => {
    try {
      const item = localStorage.getItem(PERSON_SESSION_KEY);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  });

  const setSession = useCallback((newSession: PersonSession | null) => {
    setSessionState(newSession);
    try {
      if (newSession) {
        localStorage.setItem(PERSON_SESSION_KEY, JSON.stringify(newSession));
      } else {
        localStorage.removeItem(PERSON_SESSION_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback(() => setSession(null), [setSession]);

  return { session, setSession, logout, isAuthenticated: !!session };
}

export function getStoredPersonSession(): PersonSession | null {
  try {
    const item = localStorage.getItem(PERSON_SESSION_KEY);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}
