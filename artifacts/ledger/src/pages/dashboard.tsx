import { useEffect } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import {
  useGetEvent,
  useGetBalances,
  useListExpenses,
  useListActivity,
} from '@workspace/api-client-react';
import { useLocalSession } from '@/hooks/use-local-session';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  tickets: '🎟', food: '🍽', drinks: '🥂', snacks: '🍿', fuel: '⛽', other: '📦',
};

const ACTION_HEADLINES: Record<string, (meta: any) => string> = {
  event_created: (m) => `${m.hostName ?? 'The host'} started the evening.`,
  expense_added: (m) => `${m.paidByName ?? 'Someone'} covered the ${m.category ?? 'expense'}.`,
  expense_updated: (m) => `The ${m.category ?? 'expense'} was updated.`,
  expense_deleted: (m) => `An expense was removed.`,
  member_removed: (m) => `${m.memberName ?? 'A member'} left the event.`,
  event_frozen: () => 'The evening is closed.',
  event_unfrozen: () => 'The evening was reopened.',
  join_request_approved: (m) => `${m.name ?? 'Someone'} joined the party.`,
};

const ACTION_CAPTIONS: Record<string, (meta: any) => string> = {
  expense_added: (m) => [
    m.category && `${m.category.charAt(0).toUpperCase() + m.category.slice(1)}`,
    m.amount && formatCurrency(m.amount),
    m.splitType && `Split ${m.splitType}`,
  ].filter(Boolean).join(' · '),
  expense_updated: (m) => `Amount: ${m.amount ? formatCurrency(m.amount) : '—'}`,
  event_created: (m) => `Event "${m.eventName}" created.`,
};

export default function DashboardPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session, setSession } = useLocalSession(token ?? '');

  const { data: event, isLoading: eventLoading } = useGetEvent(token ?? '', {
    query: { enabled: !!token } as any,
  });

  const { data: balancesData } = useGetBalances(token ?? '', {
    query: { enabled: !!token && !!session } as any,
  });

  const { data: expenses = [] } = useListExpenses(token ?? '', {
    query: { enabled: !!token } as any,
  });

  const { data: activity = [] } = useListActivity(token ?? '', {
    query: { enabled: !!token } as any,
  });

  useEffect(() => {
    if (!session && !eventLoading && event) {
      setLocation(`/e/${token}`);
    }
  }, [session, event, eventLoading, token, setLocation]);

  if (!session || eventLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm animate-pulse">A moment…</p>
      </div>
    );
  }

  const myBalance = balancesData?.memberBalances.find(b => b.memberId === session.memberId);
  const netBalance = myBalance?.netBalance ?? 0;
  const recentExpenses = expenses.slice(-5).reverse();
  const recentActivity = activity.slice(-10).reverse();

  return (
    <div className="min-h-dvh bg-background transition-page">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">EvenSteven</p>
            <h1 className="font-display text-xl text-foreground truncate">{event?.name ?? '…'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/e/${token}/settings`}>
              <Button size="sm" variant="ghost" className="text-xs">
                {session.memberName}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Balance card */}
        <div className={cn(
          'rounded-xl border bg-card p-5 space-y-1',
          netBalance > 0 ? 'border-l-4 border-l-green-600 border-border' :
          netBalance < 0 ? 'border-l-4 border-l-amber-600 border-border' :
          'border-border'
        )}>
          {netBalance === 0 ? (
            <>
              <p className="font-display text-3xl text-foreground">You're even.</p>
              <p className="text-sm text-muted-foreground">No balance to settle.</p>
            </>
          ) : netBalance > 0 ? (
            <>
              <p className="font-display text-3xl text-green-700">You're owed {formatCurrency(netBalance)}.</p>
              <p className="text-sm text-muted-foreground">Others will settle with you.</p>
            </>
          ) : (
            <>
              <p className="font-display text-3xl text-amber-700">You owe {formatCurrency(Math.abs(netBalance))}.</p>
              <p className="text-sm text-muted-foreground">
                <Link href={`/e/${token}/settlements`} className="underline underline-offset-2 hover:text-foreground transition-colors">
                  See settlement plan →
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Expenses', href: `/e/${token}/expenses`, count: expenses.length },
            { label: 'Settle', href: `/e/${token}/settlements` },
            { label: 'Members', href: `/e/${token}/members` },
          ].map(item => (
            <Link key={item.label} href={item.href}>
              <button className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors text-center">
                {item.label}
                {item.count !== undefined && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{item.count}</span>
                )}
              </button>
            </Link>
          ))}
        </div>

        {/* Recent expenses */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Recent Expenses
            </h2>
            {expenses.length > 5 && (
              <Link href={`/e/${token}/expenses`}>
                <span className="text-xs text-accent hover:underline">All {expenses.length}</span>
              </Link>
            )}
          </div>

          {recentExpenses.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center space-y-1.5">
              <p className="font-display text-xl text-foreground">The evening is still financially innocent.</p>
              <p className="text-xs text-muted-foreground">No expenses have been recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentExpenses.map(expense => (
                <div key={expense.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
                  <span className="text-lg w-7 text-center">{CATEGORY_LABELS[expense.category] ?? '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {expense.description ?? expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">Paid by {expense.paidByMemberName}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Timeline */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Timeline
          </h2>

          {recentActivity.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center space-y-1.5">
              <p className="font-display text-xl text-foreground">Quiet so far.</p>
              <p className="text-xs text-muted-foreground">Activity will appear here as the evening unfolds.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map(entry => {
                const headline = ACTION_HEADLINES[entry.action]?.(entry.metadata ?? {}) ?? entry.action;
                const caption = ACTION_CAPTIONS[entry.action]?.(entry.metadata ?? {});
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-[7px]" />
                    <div className="flex-1 space-y-0.5">
                      <p className="text-sm text-foreground leading-snug">{headline}</p>
                      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
                      <p className="text-xs text-muted-foreground/60">{formatDate(entry.createdAt.toString())}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* FAB */}
      {!event?.frozen && (
        <div className="fixed bottom-6 right-6 z-20">
          <Link href={`/e/${token}/add-expense`}>
            <button
              className="h-14 px-5 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-lg hover:shadow-xl hover:opacity-90 transition-all flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span>
              Add Expense
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
