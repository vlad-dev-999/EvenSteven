import { useLocation, useParams } from "wouter";
import { useGetEvent, useGetBalances, useListExpenses, getGetBalancesQueryKey } from "@workspace/api-client-react";
import { useLocalSession } from "@/hooks/use-local-session";
import { TopNav, BottomNav } from "@/components/layout/nav";
import { formatCurrency, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export default function DashboardPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session } = useLocalSession(token || "");

  const { data: event } = useGetEvent(token || "", {
    query: { enabled: !!token }
  });

  const { data: balances } = useGetBalances(token || "", {
    query: { 
      enabled: !!token,
      refetchInterval: 5000 
    }
  });

  const { data: expenses } = useListExpenses(token || "", {
    query: { enabled: !!token }
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!session) {
      setLocation(`/e/${token}`);
    }
  }, [session, token, setLocation]);

  if (!session || !event) return null;

  const myBalance = balances?.memberBalances.find(b => b.memberId === session.memberId);
  const netBalance = myBalance?.netBalance || 0;

  const recentExpenses = expenses?.slice(0, 5) || [];

  return (
    <div className="min-h-[100dvh] bg-background">
      <TopNav 
        title={event.name} 
        token={token!}
        rightAction={
          <button 
            onClick={() => setLocation(`/e/${token}/settings`)}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-5 w-5" />
          </button>
        }
      />

      <main className="px-4 py-6 space-y-8">
        {/* Balance Card */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your Status</h2>
          <Card className="p-6 flex flex-col items-center text-center space-y-2 border-white/5 bg-white/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            
            {netBalance > 0 && (
              <>
                <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center mb-2">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
                <p className="text-muted-foreground">You are owed</p>
                <p className="text-4xl font-bold tracking-tight text-success">{formatCurrency(netBalance)}</p>
              </>
            )}
            
            {netBalance < 0 && (
              <>
                <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center mb-2">
                  <TrendingDown className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-muted-foreground">You owe</p>
                <p className="text-4xl font-bold tracking-tight text-destructive">{formatCurrency(Math.abs(netBalance))}</p>
              </>
            )}

            {netBalance === 0 && (
              <>
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <p className="text-muted-foreground">You are all settled up</p>
                <p className="text-4xl font-bold tracking-tight">{formatCurrency(0)}</p>
              </>
            )}

            <div className="w-full flex justify-between pt-6 mt-4 border-t border-border/50 text-sm">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-medium">{formatCurrency(myBalance?.totalPaid || 0)}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-muted-foreground">Event Total</span>
                <span className="font-medium">{formatCurrency(balances?.totalExpenses || 0)}</span>
              </div>
            </div>
          </Card>
        </section>

        {/* Recent Activity */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Expenses</h2>
            {recentExpenses.length > 0 && (
              <button 
                onClick={() => setLocation(`/e/${token}/expenses`)}
                className="text-xs text-primary font-medium"
              >
                See All
              </button>
            )}
          </div>

          <div className="space-y-2">
            {recentExpenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                No expenses yet. Add one!
              </div>
            ) : (
              recentExpenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-semibold">
                      {exp.category.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{exp.description || exp.category}</p>
                      <p className="text-xs text-muted-foreground">Paid by {exp.paidByName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(exp.amount)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <div className="fixed bottom-20 right-4 z-50">
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
          onClick={() => setLocation(`/e/${token}/add-expense`)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <BottomNav token={token!} />
    </div>
  );
}
