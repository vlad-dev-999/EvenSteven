/**
 * My Events — the home screen for authenticated directory members.
 * Lists all active (non-archived) events. Members enter by clicking an event.
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { usePersonSession } from '@/hooks/use-person-session';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';

interface EventSummary {
  id: number;
  name: string;
  token: string;
  frozen: boolean;
  archived: boolean;
  memberCount: number;
  totalExpenses: number;
  venue: string | null;
  startDate: string | null;
  description: string | null;
  createdAt: string;
}

async function fetchEvents(): Promise<EventSummary[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/directory/events`);
  if (!res.ok) throw new Error('Failed to load events');
  return res.json();
}

export default function MyEventsPage() {
  const [, setLocation] = useLocation();
  const { session, logout } = usePersonSession();

  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLocation('/login');
      return;
    }
    fetchEvents()
      .then(setEvents)
      .catch(() => toast.error('Could not load events. Please refresh.'))
      .finally(() => setLoading(false));
  }, [session, setLocation]);

  if (!session) return null;

  const handleEnterEvent = (ev: EventSummary) => {
    setLocation(`/e/${ev.token}`);
  };

  return (
    <div className="min-h-dvh bg-background transition-page">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl text-foreground">EvenSteven</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{session.personName}</span>
          <Button size="sm" variant="ghost" onClick={() => { logout(); setLocation('/login'); }}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Welcome */}
        <div className="space-y-1 pt-2">
          <h1 className="font-display text-3xl text-foreground">
            Good evening, {session.personName.split(' ')[0]}.
          </h1>
          <p className="text-sm text-muted-foreground">
            Open an event below, or share your link with others.
          </p>
        </div>

        {/* Events list */}
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center animate-pulse">Loading…</p>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
            <p className="font-display text-2xl text-foreground">No events yet.</p>
            <p className="text-sm text-muted-foreground">
              The evening hasn't started. Check back shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => (
              <button
                key={ev.id}
                className={cn(
                  'w-full text-left rounded-xl border border-border bg-card px-5 py-4 hover:bg-muted/30 transition-colors space-y-1',
                  ev.frozen && 'opacity-70',
                )}
                onClick={() => handleEnterEvent(ev)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{ev.name}</p>
                    {ev.venue && (
                      <p className="text-xs text-muted-foreground">{ev.venue}</p>
                    )}
                    {ev.description && !ev.venue && (
                      <p className="text-xs text-muted-foreground truncate">{ev.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {ev.frozen ? (
                      <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">Closed</span>
                    ) : (
                      <span className="text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5">Open</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{ev.memberCount} {ev.memberCount === 1 ? 'person' : 'people'}</span>
                  {ev.totalExpenses > 0 && (
                    <>
                      <span>·</span>
                      <span>{formatCurrency(ev.totalExpenses)} recorded</span>
                    </>
                  )}
                  {ev.startDate && (
                    <>
                      <span>·</span>
                      <span>{new Date(ev.startDate).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
