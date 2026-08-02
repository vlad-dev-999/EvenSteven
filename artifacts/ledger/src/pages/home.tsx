/**
 * Home page.
 *
 * - If the visitor has a global person session → redirect to /my-events.
 * - Otherwise → redirect to /login.
 */
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { usePersonSession } from '@/hooks/use-person-session';

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { session } = usePersonSession();

  useEffect(() => {
    if (session) {
      setLocation('/my-events');
    } else {
      setLocation('/login');
    }
  }, [session, setLocation]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm animate-pulse">A moment…</p>
    </div>
  );
}
