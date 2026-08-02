import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetEvent, useListMembers, useCreateExpense, ExpenseInputCategory, ExpenseInputSplitType } from "@workspace/api-client-react";
import { useLocalSession } from "@/hooks/use-local-session";
import { TopNav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Ticket, Pizza, Coffee, Utensils, Fuel, MoreHorizontal, ArrowRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Step = "category" | "amount" | "paidBy" | "split";

const CATEGORIES = [
  { id: ExpenseInputCategory.food, label: "Food", icon: Utensils },
  { id: ExpenseInputCategory.drinks, label: "Drinks", icon: Coffee },
  { id: ExpenseInputCategory.snacks, label: "Snacks", icon: Pizza },
  { id: ExpenseInputCategory.tickets, label: "Tickets", icon: Ticket },
  { id: ExpenseInputCategory.fuel, label: "Fuel", icon: Fuel },
  { id: ExpenseInputCategory.other, label: "Other", icon: MoreHorizontal },
];

export default function AddExpensePage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session } = useLocalSession(token || "");
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("category");
  
  // Form State
  const [category, setCategory] = useState<ExpenseInputCategory | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState<number | null>(session?.memberId || null);
  const [splitType, setSplitType] = useState<ExpenseInputSplitType>(ExpenseInputSplitType.everyone);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]); // for 'members' split

  const { data: members } = useListMembers(token || "", { query: { enabled: !!token } });
  const createExpense = useCreateExpense();

  const handleNext = () => {
    if (step === "category") setStep("amount");
    else if (step === "amount") setStep("paidBy");
    else if (step === "paidBy") setStep("split");
  };

  const handleSubmit = () => {
    if (!category || !amountStr || !paidByMemberId) return;
    
    const amountCents = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;

    createExpense.mutate({
      token: token!,
      data: {
        category,
        amount: amountCents,
        description: description.trim() || undefined,
        paidByMemberId,
        splitType,
        participantIds: splitType === 'members' ? selectedParticipants : undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Expense Added" });
        setLocation(`/e/${token}/dashboard`);
      },
      onError: () => {
        toast({ title: "Failed to add expense", variant: "destructive" });
      }
    });
  };

  const renderStep = () => {
    switch (step) {
      case "category":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold">What was this for?</h2>
            <div className="grid grid-cols-2 gap-4">
              {CATEGORIES.map(cat => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id);
                      setTimeout(() => setStep("amount"), 200);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center p-6 gap-3 rounded-2xl border-2 transition-all active:scale-95",
                      isSelected 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border/50 bg-card text-muted-foreground hover:border-border hover:bg-muted/50"
                    )}
                  >
                    <cat.icon className="h-8 w-8" />
                    <span className="font-medium">{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        );

      case "amount":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-bold">How much?</h2>
            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground font-medium">₹</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  placeholder="0.00"
                  className="text-4xl h-20 pl-10 pr-4 font-bold tracking-tight rounded-2xl border-border/50 bg-card"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground ml-1">What was it exactly? (Optional)</Label>
                <Input
                  placeholder="e.g. Dinner at Joe's"
                  className="h-14 rounded-xl border-border/50 bg-card"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button 
                className="w-full h-14 text-lg rounded-xl mt-4" 
                onClick={handleNext}
                disabled={!amountStr || parseFloat(amountStr) <= 0}
              >
                Next <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        );

      case "paidBy":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-bold">Who paid?</h2>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pb-4">
              {members?.map(m => {
                const isSelected = paidByMemberId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setPaidByMemberId(m.id);
                      setTimeout(() => setStep("split"), 200);
                    }}
                    className={cn(
                      "flex items-center w-full p-4 gap-4 rounded-xl border-2 transition-all text-left",
                      isSelected 
                        ? "border-primary bg-primary/5 text-foreground" 
                        : "border-border/50 bg-card text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-semibold text-secondary-foreground">
                      {m.name.substring(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 font-medium text-lg">{m.name}</div>
                    {isSelected && <Check className="h-6 w-6 text-primary" />}
                  </button>
                )
              })}
            </div>
          </div>
        );

      case "split":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 flex flex-col h-full">
            <h2 className="text-2xl font-bold">How to split?</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSplitType('everyone')}
                className={cn(
                  "p-4 rounded-xl border-2 font-medium transition-colors",
                  splitType === 'everyone' ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-card text-muted-foreground"
                )}
              >
                Everyone equally
              </button>
              <button
                onClick={() => setSplitType('members')}
                className={cn(
                  "p-4 rounded-xl border-2 font-medium transition-colors",
                  splitType === 'members' ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-card text-muted-foreground"
                )}
              >
                Specific people
              </button>
            </div>

            {splitType === 'members' && (
              <div className="space-y-2 mt-4 flex-1 overflow-y-auto">
                <Label className="text-muted-foreground ml-1">Select participants</Label>
                <div className="space-y-2">
                  {members?.map(m => {
                    const isSelected = selectedParticipants.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedParticipants(prev => 
                            isSelected ? prev.filter(id => id !== m.id) : [...prev, m.id]
                          );
                        }}
                        className={cn(
                          "flex items-center w-full p-3 gap-3 rounded-lg border transition-all text-left",
                          isSelected 
                            ? "border-primary bg-primary/5 text-foreground" 
                            : "border-transparent bg-card text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "h-5 w-5 rounded-sm border flex items-center justify-center transition-colors",
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                        )}>
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground stroke-[3px]" />}
                        </div>
                        <div className="font-medium">{m.name}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="pt-4 mt-auto">
              <Button 
                className="w-full h-14 text-lg rounded-xl" 
                onClick={handleSubmit}
                disabled={createExpense.isPending || (splitType === 'members' && selectedParticipants.length === 0)}
              >
                {createExpense.isPending ? "Saving..." : "Save Expense"}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav 
        title="Add Expense" 
        token={token!}
        showBack
        backTo={step !== "category" ? undefined : `/e/${token}/dashboard`}
      />
      {step !== "category" && (
        <button 
          className="absolute top-3 left-4 z-[60] h-8 w-8 flex items-center justify-center text-muted-foreground"
          onClick={() => {
            if (step === "split") setStep("paidBy");
            else if (step === "paidBy") setStep("amount");
            else if (step === "amount") setStep("category");
          }}
        >
          {/* using absolute back button overrides TopNav's back to do wizard back */}
        </button>
      )}
      
      <main className="flex-1 p-6 flex flex-col max-w-lg mx-auto w-full">
        {renderStep()}
      </main>
    </div>
  );
}
