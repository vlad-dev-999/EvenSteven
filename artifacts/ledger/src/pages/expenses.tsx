import { useLocation, useParams } from "wouter";
import { useGetEvent, useListExpenses } from "@workspace/api-client-react";
import { TopNav, BottomNav } from "@/components/layout/nav";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Ticket, Pizza, Coffee, Utensils, Fuel, MoreHorizontal, ArrowRight } from "lucide-react";

export default function ExpensesPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();

  useGetEvent(token || "", { query: { enabled: !!token } });
  const { data: expenses } = useListExpenses(token || "", { query: { enabled: !!token } });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'food': return Utensils;
      case 'drinks': return Coffee;
      case 'snacks': return Pizza;
      case 'tickets': return Ticket;
      case 'fuel': return Fuel;
      default: return MoreHorizontal;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <TopNav title="Expenses" token={token!} />

      <main className="px-4 py-6 space-y-4">
        {expenses?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No expenses recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses?.map(exp => {
              const Icon = getCategoryIcon(exp.category);
              return (
                <div 
                  key={exp.id} 
                  className="flex flex-col p-4 rounded-2xl bg-card border border-border/50 hover:border-border transition-colors cursor-pointer"
                  onClick={() => {/* could navigate to expense details */}}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{exp.description || exp.category.charAt(0).toUpperCase() + exp.category.slice(1)}</p>
                        <p className="text-sm text-muted-foreground">Paid by {exp.paidByName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-foreground">{formatCurrency(exp.amount)}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(exp.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      {exp.splitType === 'everyone' ? 'Split equally' : `Split with ${exp.participants.length} people`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav token={token!} />
    </div>
  );
}
