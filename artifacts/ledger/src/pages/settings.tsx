import { useEffect } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import { toast } from 'sonner';
import { useGetEvent, useFreezeEvent, useUnfreezeEvent } from '@workspace/api-client-react';
import { useLocalSession } from '@/hooks/use-local-session';
import { useHostSession } from '@/hooks/use-host-session';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function SettingsPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session, setSession } = useLocalSession(token ?? '');
  const { token: hostToken } = useHostSession();
  const queryClient = useQueryClient();

  const hostHeaders = (hostToken ? { 'x-host-token': hostToken } : {}) as Record<string, string>;

  const { data: event, isLoading } = useGetEvent(token ?? '', { query: { enabled: !!token } as any });
  const freezeMutation = useFreezeEvent({ request: { headers: hostHeaders } });
  const unfreezeMutation = useUnfreezeEvent({ request: { headers: hostHeaders } });

  useEffect(() => {
    if (!session) setLocation(`/e/${token}`);
  }, [session, token, setLocation]);

  if (!session) return null;

  const handleFreeze = () => {
    if (!confirm('Close this event? No new expenses can be added.')) return;
    freezeMutation.mutate({ token: token! }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/events/${token}`] });
        toast.success('Event closed.');
      },
      onError: () => toast.error('Could not close event.'),
    });
  };

  const handleUnfreeze = () => {
    unfreezeMutation.mutate({ token: token! }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/events/${token}`] });
        toast.success('Event reopened.');
      },
      onError: () => toast.error('Could not reopen event.'),
    });
  };

  const handleLeave = () => {
    setSession(null);
    setLocation('/');
  };

  return (
    <div className="min-h-dvh bg-background transition-page">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href={`/e/${token}/dashboard`}>
            <button className="p-1 rounded-md hover:bg-muted/40 transition-colors text-muted-foreground">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{event?.name}</p>
            <h1 className="font-display text-xl text-foreground">Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Event info */}
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Event</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium text-foreground">{event?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium ${event?.frozen ? 'text-muted-foreground' : 'text-green-700'}`}>
                {event?.frozen ? 'Closed' : 'Open'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Members</span>
              <span className="font-medium text-foreground">{event?.memberCount}</span>
            </div>
          </div>
        </div>

        {/* Host actions (only shown if user has host token) */}
        {hostToken && (
          <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Host Controls</p>
            {event?.frozen ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleUnfreeze}
                disabled={unfreezeMutation.isPending}
              >
                {unfreezeMutation.isPending ? 'Reopening…' : 'Reopen Event'}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full text-muted-foreground"
                onClick={handleFreeze}
                disabled={freezeMutation.isPending}
              >
                {freezeMutation.isPending ? 'Closing…' : 'Close Event'}
              </Button>
            )}
          </div>
        )}

        {/* Current session */}
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">You</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{session.memberName}</p>
              {session.isHost && <p className="text-xs text-muted-foreground">Host</p>}
            </div>
          </div>
          {session.personalPin && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-0.5">
              <p className="text-xs text-muted-foreground">Your PIN (for other devices)</p>
              <p className="font-display text-2xl tracking-widest text-foreground">{session.personalPin}</p>
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={handleLeave}>
            Leave Event
          </Button>
        </div>
      </main>
    </div>
  );
}
