import { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useGetEvent, useGetBalances } from '@workspace/api-client-react';
import { useLocalSession } from '@/hooks/use-local-session';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type SettlementMode = 'individual' | 'house';

interface Transfer {
  fromMemberId: number;
  fromMemberName: string;
  toMemberId: number;
  toMemberName: string;
  amount: number;
  mode?: string;
}

export default function SettlementsPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session } = useLocalSession(token ?? '');
  const [mode, setMode] = useState<SettlementMode>('individual');

  const { data: event } = useGetEvent(token ?? '', {
    query: { enabled: !!token } as any,
  });

  // Use event's configured settlementMode as default
  useEffect(() => {
    if (event && (event as any).settlementMode) {
      setMode((event as any).settlementMode as SettlementMode);
    }
  }, [event]);

  const { data: settlements = [], isLoading } = useQuery<Transfer[]>({
    queryKey: [`/api/events/${token}/settlements`, mode],
    queryFn: async () => {
      const res = await fetch(`/api/events/${token}/settlements?mode=${mode}`);
      if (!res.ok) throw new Error('Failed to fetch settlements');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: balancesData } = useGetBalances(token ?? '', {
    query: { enabled: !!token } as any,
  });

  useEffect(() => {
    if (!session) setLocation(`/e/${token}`);
  }, [session, token, setLocation]);

  if (!session) return null;

  const totalExpenses = balancesData?.totalExpenses ?? 0;
  const isEven = settlements.length === 0;

  return (
    <div className="min-h-dvh bg-background transition-page">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href={`/e/${token}/dashboard`}>
            <button className="p-1 rounded-md hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{event?.name}</p>
            <h1 className="font-display text-xl text-foreground">Settle Up</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8 pb-16">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
          <button
            onClick={() => setMode('individual')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              mode === 'individual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Individual
          </button>
          <button
            onClick={() => setMode('house')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              mode === 'house'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            By House
          </button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm text-center animate-pulse py-8">Calculating…</p>
        ) : isEven ? (
          <div className="text-center space-y-4 py-12">
            <p className="font-display text-5xl text-foreground leading-tight">Everything is even.</p>
            <p className="text-muted-foreground text-base">
              All balances have been settled.
              {totalExpenses > 0 && ` The group spent ${formatCurrency(totalExpenses)} tonight.`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                {settlements.length} {settlements.length === 1 ? 'transfer' : 'transfers'} required
                {mode === 'house' && <span className="ml-2 text-accent">· by house</span>}
              </p>
              <h2 className="font-display text-4xl text-foreground leading-tight">
                Here's how to settle.
              </h2>
              {totalExpenses > 0 && (
                <p className="text-muted-foreground text-sm">
                  {formatCurrency(totalExpenses)} total · minimum transfers to clear all debts
                </p>
              )}
            </div>

            {/* Transfer cards */}
            <div className="space-y-4">
              {settlements.map((s, i) => {
                const isMyTransfer = mode === 'individual' && s.fromMemberId === session.memberId;
                const isIncoming = mode === 'individual' && s.toMemberId === session.memberId;

                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded-xl border bg-card px-6 py-5 space-y-3',
                      isMyTransfer ? 'border-l-4 border-l-amber-500 border-border' :
                      isIncoming ? 'border-l-4 border-l-green-600 border-border' :
                      'border-border'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-right flex-1">
                        <p className="font-medium text-base text-foreground">
                          {s.fromMemberName}
                          {isMyTransfer && <span className="ml-1.5 text-xs text-muted-foreground font-normal">(you)</span>}
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-base text-foreground">
                          {s.toMemberName}
                          {isIncoming && <span className="ml-1.5 text-xs text-muted-foreground font-normal">(you)</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-center border-t border-border pt-3">
                      <p className="font-display text-4xl text-foreground">{formatCurrency(s.amount)}</p>
                      {isMyTransfer && <p className="text-xs text-amber-700 mt-1 font-medium">You owe this amount.</p>}
                      {isIncoming && <p className="text-xs text-green-700 mt-1 font-medium">Coming to you.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Balances detail */}
        {(balancesData?.memberBalances.length ?? 0) > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {mode === 'house' ? 'Individual Balances' : 'All Balances'}
            </h3>
            <div className="space-y-2">
              {balancesData!.memberBalances
                .sort((a, b) => b.netBalance - a.netBalance)
                .map(mb => (
                  <div key={mb.memberId} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {mb.memberName}
                        {mb.memberId === session.memberId && (
                          <span className="ml-1.5 text-xs text-muted-foreground font-normal">you</span>
                        )}
                      </p>
                      {(mb as any).houseName && (
                        <p className="text-xs text-muted-foreground">{(mb as any).houseName}</p>
                      )}
                    </div>
                    <p className={cn(
                      'text-sm font-semibold tabular-nums',
                      mb.netBalance > 0 ? 'text-green-700' :
                      mb.netBalance < 0 ? 'text-amber-700' :
                      'text-muted-foreground'
                    )}>
                      {mb.netBalance > 0 ? '+' : ''}{formatCurrency(mb.netBalance)}
                    </p>
                  </div>
                ))
              }
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
