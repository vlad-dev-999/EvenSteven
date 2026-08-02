/**
 * My Events — the home screen for authenticated directory members.
 * Lists all active (non-archived) events. Members enter by clicking an event.
 * Members may also create a new event; they automatically become the Host.
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { usePersonSession } from '@/hooks/use-person-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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

  // Create event dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [eventName, setEventName] = useState('');
  const [creating, setCreating] = useState(false);

  // Share dialog after creation
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<{ token: string; name: string; pin: string } | null>(null);

  const loadEvents = () => {
    if (!session) return;
    fetchEvents()
      .then(setEvents)
      .catch(() => toast.error('Could not load events. Please refresh.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!session) {
      setLocation('/login');
      return;
    }
    loadEvents();
  }, [session, setLocation]);

  if (!session) return null;

  const handleEnterEvent = (ev: EventSummary) => {
    setLocation(`/e/${ev.token}`);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-person-id': String(session.personId),
        },
        body: JSON.stringify({ name: eventName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to create event');
      }
      const result = await res.json();
      setShowCreateDialog(false);
      setEventName('');
      setCreatedEvent({ token: result.event.token, name: result.event.name, pin: result.pin });
      setShowShareDialog(true);
      // Refresh event list in the background
      fetchEvents().then(setEvents).catch(() => {});
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not create event. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const shareUrl = createdEvent
    ? `${window.location.origin}${import.meta.env.BASE_URL}e/${createdEvent.token}`
    : '';
  const copyLink = () =>
    navigator.clipboard.writeText(shareUrl).then(() => toast.success('Link copied.'));

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
            Open an event below, or start a new one.
          </p>
        </div>

        {/* Events list */}
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center animate-pulse">Loading…</p>
        ) : (
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
                <p className="font-display text-2xl text-foreground">No events yet.</p>
                <p className="text-sm text-muted-foreground">
                  Start the evening by creating a new event.
                </p>
              </div>
            ) : (
              events.map((ev) => (
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
              ))
            )}

            {/* Create event button */}
            <Button
              className="w-full"
              variant="outline"
              onClick={() => { setEventName(''); setShowCreateDialog(true); }}
            >
              + New Event
            </Button>
          </div>
        )}
      </main>

      {/* Create event dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">New Event</DialogTitle>
            <DialogDescription>
              Name the evening. You'll be the Host.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Event name</Label>
              <Input
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder="e.g. Movie Night"
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!eventName.trim() || creating}>
                {creating ? 'Creating…' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">
              {createdEvent?.name} is ready.
            </DialogTitle>
            <DialogDescription>
              Share this link via WhatsApp. The PIN confirms the right event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Event link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="text-xs font-mono" />
                <Button size="sm" variant="outline" onClick={copyLink}>Copy</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">PIN</Label>
              <p className="font-display text-5xl tracking-[0.3em] pl-1">{createdEvent?.pin}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowShareDialog(false);
                setLocation(`/e/${createdEvent?.token}/dashboard`);
              }}
            >
              Open Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
