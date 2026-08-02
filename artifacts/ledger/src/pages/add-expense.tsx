import { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import { toast } from 'sonner';
import { useGetEvent, useListMembers, useCreateExpense } from '@workspace/api-client-react';
import { useLocalSession } from '@/hooks/use-local-session';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatCurrency } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

const CATEGORIES = [
  { id: 'tickets', label: 'Tickets', emoji: '🎟' },
  { id: 'food', label: 'Food', emoji: '🍽' },
  { id: 'drinks', label: 'Drinks', emoji: '🥂' },
  { id: 'snacks', label: 'Snacks', emoji: '🍿' },
  { id: 'fuel', label: 'Fuel', emoji: '⛽' },
  { id: 'other', label: 'Other', emoji: '📦' },
];

type Step = 'category' | 'amount' | 'paidBy' | 'split';

export default function AddExpensePage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session } = useLocalSession(token ?? '');
  const queryClient = useQueryClient();

  const { data: event } = useGetEvent(token ?? '', { query: { enabled: !!token } as any });
  const { data: members = [] } = useListMembers(token ?? '', { query: { enabled: !!token } as any });
  const createMutation = useCreateExpense();

  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState<number>(0);
  const [splitType, setSplitType] = useState<'everyone' | 'families' | 'members'>('everyone');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [selectedHouseIds, setSelectedHouseIds] = useState<number[]>([]);

  const approvedMembers = members.filter(m => m.approved);

  // Derive distinct houses from directory-level houseId on approved members
  const houses = Array.from(
    approvedMembers
      .filter(m => m.houseId != null && m.houseName != null)
      .reduce((map, m) => {
        if (!map.has(m.houseId!)) map.set(m.houseId!, { id: m.houseId!, name: m.houseName! });
        return map;
      }, new Map<number, { id: number; name: string }>())
      .values()
  );

  useEffect(() => {
    if (!session) setLocation(`/e/${token}`);
    if (session && !paidByMemberId) setPaidByMemberId(session.memberId);
  }, [session, paidByMemberId, token, setLocation]);

  useEffect(() => {
    if (event?.frozen) setLocation(`/e/${token}/dashboard`);
  }, [event, token, setLocation]);

  if (!session) return null;

  const handleSubmit = () => {
    const amountPaise = Math.round(parseFloat(amountRupees) * 100);
    if (!category || isNaN(amountPaise) || amountPaise <= 0 || !paidByMemberId) return;

    createMutation.mutate({
      token: token!,
      data: {
        category: category as any,
        description: description.trim() || undefined,
        amount: amountPaise,
        paidByMemberId,
        splitType,
        participantIds: splitType === 'members' ? selectedMemberIds : undefined,
        houseIds: splitType === 'families' ? selectedHouseIds : undefined,
        createdByMemberId: session.memberId,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/events/${token}/expenses`] });
        queryClient.invalidateQueries({ queryKey: [`/api/events/${token}/balances`] });
        queryClient.invalidateQueries({ queryKey: [`/api/events/${token}/activity`] });
        queryClient.invalidateQueries({ queryKey: [`/api/events/${token}/settlements`] });
        toast.success('Expense added.');
        setLocation(`/e/${token}/dashboard`);
      },
      onError: () => toast.error('Could not add expense. Try again.'),
    });
  };

  const stepIndex = ['category', 'amount', 'paidBy', 'split'].indexOf(step);
  const paidByMember = approvedMembers.find(m => m.id === paidByMemberId);

  return (
    <div className="min-h-dvh bg-background transition-page">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => step === 'category' ? setLocation(`/e/${token}/dashboard`) : setStep(
            step === 'amount' ? 'category' : step === 'paidBy' ? 'amount' : 'paidBy'
          )} className="p-1 rounded-md hover:bg-muted/40 transition-colors text-muted-foreground">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{event?.name}</p>
            <h1 className="font-display text-xl text-foreground">Add Expense</h1>
          </div>
        </div>
        {/* Step indicator */}
        <div className="max-w-lg mx-auto mt-3 flex gap-1">
          {['category', 'amount', 'paidBy', 'split'].map((s, i) => (
            <div key={s} className={cn('h-0.5 flex-1 rounded-full transition-colors', i <= stepIndex ? 'bg-accent' : 'bg-border')} />
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Step 1: Category */}
        {step === 'category' && (
          <div className="space-y-5">
            <h2 className="font-display text-3xl text-foreground">What was it for?</h2>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setCategory(cat.id); setStep('amount'); }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-4 text-left transition-all',
                    category === cat.id
                      ? 'border-accent bg-accent/10 text-foreground'
                      : 'border-border bg-card text-foreground hover:border-accent/50'
                  )}
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="font-medium">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Amount */}
        {step === 'amount' && (
          <div className="space-y-5">
            <h2 className="font-display text-3xl text-foreground">How much?</h2>
            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={amountRupees}
                  onChange={e => setAmountRupees(e.target.value)}
                  placeholder="0.00"
                  className="pl-8 text-xl font-semibold h-14 bg-card"
                  autoFocus
                />
              </div>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="bg-card"
              />
            </div>
            <Button
              className="w-full"
              disabled={!amountRupees || parseFloat(amountRupees) <= 0}
              onClick={() => setStep('paidBy')}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 3: Paid by */}
        {step === 'paidBy' && (
          <div className="space-y-5">
            <h2 className="font-display text-3xl text-foreground">Who paid?</h2>
            <div className="space-y-2">
              {approvedMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => setPaidByMemberId(m.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                    paidByMemberId === m.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-card hover:border-accent/50'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {m.name[0].toUpperCase()}
                  </div>
                  <span className="font-medium text-foreground">{m.name}</span>
                  {m.id === session.memberId && (
                    <span className="ml-auto text-xs text-muted-foreground">you</span>
                  )}
                </button>
              ))}
            </div>
            <Button className="w-full" disabled={!paidByMemberId} onClick={() => setStep('split')}>
              Continue
            </Button>
          </div>
        )}

        {/* Step 4: Split */}
        {step === 'split' && (
          <div className="space-y-5">
            <h2 className="font-display text-3xl text-foreground">How to split?</h2>

            <div className="space-y-2">
              {[
                { id: 'everyone', label: 'Everyone', desc: 'Split equally among all attendees' },
                ...(houses.length > 0 ? [{ id: 'families', label: 'By House', desc: 'One share per household' }] : []),
                { id: 'members', label: 'Specific people', desc: 'Choose who shares this expense' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSplitType(opt.id as any)}
                  className={cn(
                    'w-full flex gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                    splitType === opt.id ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-accent/50'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 shrink-0 mt-0.5',
                    splitType === opt.id ? 'border-accent bg-accent' : 'border-muted-foreground'
                  )} />
                  <div>
                    <p className="font-medium text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Member selector */}
            {splitType === 'members' && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Select members</Label>
                {approvedMembers.map(m => (
                  <label key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 cursor-pointer hover:bg-muted/30">
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(m.id)}
                      onChange={e => setSelectedMemberIds(prev =>
                        e.target.checked ? [...prev, m.id] : prev.filter(id => id !== m.id)
                      )}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-foreground">{m.name}</span>
                  </label>
                ))}
              </div>
            )}

            {/* House selector */}
            {splitType === 'families' && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Select houses</Label>
                {houses.map(h => (
                  <label key={h.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 cursor-pointer hover:bg-muted/30">
                    <input
                      type="checkbox"
                      checked={selectedHouseIds.includes(h.id)}
                      onChange={e => setSelectedHouseIds(prev =>
                        e.target.checked ? [...prev, h.id] : prev.filter(id => id !== h.id)
                      )}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-foreground">{h.name}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Summary */}
            <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">{formatCurrency(Math.round(parseFloat(amountRupees || '0') * 100))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid by</span>
                <span className="font-medium">{paidByMember?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Split</span>
                <span className="font-medium capitalize">{splitType}</span>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={
                createMutation.isPending ||
                (splitType === 'members' && selectedMemberIds.length === 0) ||
                (splitType === 'families' && selectedHouseIds.length === 0)
              }
              onClick={handleSubmit}
            >
              {createMutation.isPending ? 'Adding…' : 'Add Expense'}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
