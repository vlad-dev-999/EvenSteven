import { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import { toast } from 'sonner';
import { useGetEvent, useFreezeEvent, useUnfreezeEvent, useGetBalances } from '@workspace/api-client-react';
import { useLocalSession } from '@/hooks/use-local-session';
import { useHostSession } from '@/hooks/use-host-session';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function SettingsPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session, setSession } = useLocalSession(token ?? '');
  const { token: hostToken } = useHostSession();
  const queryClient = useQueryClient();
  const [leavePending, setLeavePending] = useState(false);

  const hostHeaders = (hostToken ? { 'x-host-token': hostToken } : {}) as Record<string, string>;

  const { data: event, isLoading } = useGetEvent(token ?? '', { query: { enabled: !!token } as any });
  const { data: balancesData } = useGetBalances(token ?? '', { query: { enabled: !!token && !!session } as any });
  const freezeMutation = useFreezeEvent({ request: { headers: hostHeaders } });
  const unfreezeMutation = useUnfreezeEvent({ request: { headers: hostHeaders } });

  useEffect(() => {
    if (!session) setLocation(`/e/${token}`);
  }, [session, token, setLocation]);

  if (!session) return null;

  const myBalance = balancesData?.memberBalances.find(b => b.memberId === session.memberId);
  const netBalance = myBalance?.netBalance ?? 0;
  const hasOutstandingBalance = Math.abs(netBalance) > 1;

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

  const handleLeave = async () => {
    if (hasOutstandingBalance) {
      toast.error(
        netBalance < 0
          ? `You still owe ${formatCurrency(Math.abs(netBalance))}. Settle up before leaving.`
          : `You're still owed ${formatCurrency(netBalance)}. Settle up before leaving.`
      );
      return;
    }

    if (!confirm('Leave this event? You can rejoin using your personal PIN.')) return;

    setLeavePending(true);
    try {
      const res = await fetch(`/api/events/${token}/members/${session.memberId}`, {
        method: 'DELETE',
        headers: { 'x-member-id': String(session.memberId) },
      });

      if (res.status === 400) {
        const json = await res.json();
        toast.error(json.error ?? 'Could not leave — you may have an outstanding balance.');
        return;
      }

      if (!res.ok) {
        toast.error('Could not leave the event. Please try again.');
        return;
      }

      setSession(null);
      setLocation('/');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLeavePending(false);
    }
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
            {(event as any)?.venue && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Venue</span>
                <span className="font-medium text-foreground truncate max-w-[60%] text-right">{(event as any).venue}</span>
              </div>
            )}
          </div>
        </div>

        {/* Host controls */}
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

        {/* Your info */}
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">You</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{session.memberName}</p>
              {session.isHost && <p className="text-xs text-muted-foreground">Host</p>}
            </div>
            {netBalance !== 0 && (
              <p className={`text-sm font-semibold tabular-nums ${netBalance > 0 ? 'text-green-700' : 'text-amber-700'}`}>
                {netBalance > 0 ? '+' : ''}{formatCurrency(netBalance)}
              </p>
            )}
          </div>
          {session.personalPin && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-0.5">
              <p className="text-xs text-muted-foreground">Your PIN (for other devices)</p>
              <p className="font-display text-2xl tracking-widest text-foreground">{session.personalPin}</p>
            </div>
          )}
          {hasOutstandingBalance && (
            <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              {netBalance < 0
                ? `You owe ${formatCurrency(Math.abs(netBalance))}. Settle up before you can leave.`
                : `You're owed ${formatCurrency(netBalance)}. Settle up before you can leave.`}
            </p>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLeave}
            disabled={leavePending}
          >
            {leavePending ? 'Leaving…' : 'Leave Event'}
          </Button>
        </div>
      </main>
    </div>
  );
}
