import { useParams } from "wouter";
import { useGetSettlements } from "@workspace/api-client-react";
import { TopNav, BottomNav } from "@/components/layout/nav";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function SettlementsPage() {
  const { token } = useParams<{ token: string }>();

  const { data: settlements, isLoading } = useGetSettlements(token || "", {
    query: { enabled: !!token }
  });

  return (
    <div className="min-h-[100dvh] bg-background">
      <TopNav title="Settlements" token={token!} />

      <main className="px-4 py-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">How to settle up</h2>
          <p className="text-muted-foreground text-sm">
            The fewest possible transfers to make everyone whole.
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Calculating...</div>
        ) : !settlements || settlements.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-medium">All settled up!</p>
            <p className="text-muted-foreground">Nobody owes anything.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {settlements.map((s, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-5 rounded-2xl bg-card border border-border/50"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 text-lg font-medium">
                    <span>{s.fromMemberName}</span>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <span>{s.toMemberName}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Transfer via UPI or Cash</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(s.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav token={token!} />
    </div>
  );
}
