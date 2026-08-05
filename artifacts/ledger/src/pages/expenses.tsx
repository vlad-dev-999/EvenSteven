import { useEffect } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import { toast } from 'sonner';
import { useGetEvent, useListExpenses, useDeleteExpense } from '@workspace/api-client-react';
import { useLocalSession } from '@/hooks/use-local-session';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Trash2 } from 'lucide-react';

const CATEGORY_EMOJI: Record<string, string> = {
  tickets: '🎟', food: '🍽', drinks: '🥂', snacks: '🍿', fuel: '⛽', other: '📦',
};

export default function ExpensesPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session } = useLocalSession(token ?? '');
  const queryClient = useQueryClient();

  const { data: event } = useGetEvent(token ?? '', { query: { enabled: !!token } as any });
  const { data: expenses = [], isLoading } = useListExpenses(token ?? '', { query: { enabled: !!token } as any });
  const deleteMutation = useDeleteExpense();

  useEffect(() => {
    if (!session) setLocation(`/e/${token}`);
  }, [session, token, setLocation]);

  if (!session) return null;

  const handleDelete = (expenseId: number, description: string) => {
    if (!confirm(`Remove "${description}"?`)) return;
    deleteMutation.mutate({ token: token!, expenseId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/events/${token}/expenses`] });
        queryClient.invalidateQueries({ queryKey: [`/api/events/${token}/balances`] });
        queryClient.invalidateQueries({ queryKey: [`/api/events/${token}/activity`] });
        queryClient.invalidateQueries({ queryKey: [`/api/events/${token}/settlements`] });
        toast.success('Expense removed.');
      },
      onError: () => toast.error('Could not remove expense.'),
    });
  };

  const sortedExpenses = [...expenses].reverse();
  const total = expenses.reduce((s, e) => s + e.amount, 0);

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
            <h1 className="font-display text-xl text-foreground">Expenses</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Total */}
        {total > 0 && (
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-1">Total spent</p>
            <p className="font-display text-3xl sm:text-4xl text-foreground">{formatCurrency(total)}</p>
          </div>
        )}

        {/* Expense list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8 animate-pulse">Loading…</p>
        ) : expenses.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
            <p className="font-display text-2xl text-foreground">The evening is still financially innocent.</p>
            <p className="text-sm text-muted-foreground">No expenses have been recorded yet.</p>
            {!event?.frozen && (
              <Link href={`/e/${token}/add-expense`}>
                <Button variant="outline" size="sm" className="mt-3">Add first expense</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedExpenses.map(expense => {
              const label = expense.description || (expense.category.charAt(0).toUpperCase() + expense.category.slice(1));
              return (
                <div key={expense.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <span className="text-xl w-8 text-center">{CATEGORY_EMOJI[expense.category] ?? '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {expense.paidByMemberName} · {formatDate(expense.createdAt.toString())}
                    </p>
                    {expense.splitType === 'everyone' && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Everyone · {expense.participants.length} attendees
                      </p>
                    )}
                    {expense.splitType === 'families' && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        By House
                      </p>
                    )}
                    {expense.splitType === 'members' && expense.participants.length > 0 && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Selected Members · {expense.participants.length} attendees
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(expense.amount)}
                  </span>
                  {!event?.frozen && (
                    <button
                      onClick={() => handleDelete(expense.id, label)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FAB */}
      {!event?.frozen && (
        <div className="fixed bottom-6 right-6 z-20">
          <Link href={`/e/${token}/add-expense`}>
            <button className="h-14 px-5 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-lg hover:shadow-xl hover:opacity-90 transition-all flex items-center gap-2">
              <span className="text-lg leading-none">+</span>
              Add Expense
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
