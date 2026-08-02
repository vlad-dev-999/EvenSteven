/**
 * Home page.
 *
 * - If the visitor has a global person session → redirect to /my-events.
 * - Otherwise → redirect to /login.
 * - The "Steward's Desk" entry point is hidden behind 5 taps on the 🐧 penguin.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { usePersonSession } from '@/hooks/use-person-session';

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { session } = usePersonSession();
  const [skipperTaps, setSkipperTaps] = useState(0);

  // Redirect based on auth state
  useEffect(() => {
    if (session) {
      setLocation('/my-events');
    } else {
      setLocation('/login');
    }
  }, [session, setLocation]);

  // Hidden penguin (Skipper) — 5 taps opens Steward's Desk
  const handleSkipperTap = () => {
    const next = skipperTaps + 1;
    setSkipperTaps(next);
    if (next >= 5) {
      setSkipperTaps(0);
      setLocation('/host');
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background">
      {/* Hidden Skipper — visually invisible but tappable */}
      <button
        onClick={handleSkipperTap}
        aria-label=""
        className="fixed bottom-4 right-4 opacity-0 w-10 h-10 text-2xl select-none"
        tabIndex={-1}
      >
        🐧
      </button>
      <p className="text-muted-foreground text-sm animate-pulse">A moment…</p>
    </div>
  );
}
