import { useState, useEffect } from 'react';
import { CREST_OPTIONS, getCrestEmoji } from '@/lib/crest-options';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import {
  useListHouses,
  useCreateHouse,
  useUpdateHouse,
  useDeleteHouse,
  useListPeople,
  useCreatePerson,
  useUpdatePerson,
  useDeletePerson,
  useResetPersonPin,
  useListEvents,
  useCreateEvent,
  useListMembers,
  useGetBalances,
  useGetSettlements,
  useGetEventSummary,
  useAddAttendee,
  useRemoveMember,
  useFreezeEvent,
  useUnfreezeEvent,
} from '@workspace/api-client-react';
import type { House, Person } from '@workspace/api-client-react';
import { useHostSession } from '@/hooks/use-host-session';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency } from '@/lib/utils';
import { ArrowRight, Users, TrendingUp, CheckCircle, KeyRound, MoreHorizontal, Loader2 } from 'lucide-react';
import { useThemeContext } from '@/themes/context';
import { THEMES, THEME_LABELS, MODE_LABELS, MODE_DESCRIPTIONS } from '@/themes/index';
import type { ThemeMode } from '@/themes/index';


// Curated avatar emoji — covers a wide range of personalities without relying on images
const AVATAR_OPTIONS = [
  '🦁', '🐺', '🦊', '🐻', '🦅', '🦋',
  '🌙', '⭐', '🔥', '💎', '🌊', '🍃',
  '⚡', '🎯', '🎭', '🏆', '👑', '🗡️',
  '🛡️', '🌺', '🍂', '❄️', '🌟', '🎪',
];

// Curated icons for the Evening Highlight feature
const HIGHLIGHT_ICON_OPTIONS = [
  '⭐', '🌟', '👑', '🏆', '🥇', '🔥',
  '💎', '⚡', '🎯', '🦁', '🌙', '✨',
];

const ACCENT_OPTIONS = [
  '#8B4513', '#2F6B3F', '#1a3a5c', '#8B6914', '#5c2a8a', '#8B1a1a', '#2a5c8B', '#3d6b4f',
];


// ─── Houses Tab ────────────────────────────────────────────────────────────────
function HousesTab({ hostToken }: { hostToken: string }) {
  const hostHeaders = { 'x-host-token': hostToken };
  const queryClient = useQueryClient();

  const { data: houses = [], isLoading } = useListHouses();
  const createMutation = useCreateHouse({ request: { headers: hostHeaders } });
  const updateMutation = useUpdateHouse({ request: { headers: hostHeaders } });
  const deleteMutation = useDeleteHouse({ request: { headers: hostHeaders } });

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<House | null>(null);
  const [form, setForm] = useState({ name: '', crest: 'home', accentColor: ACCENT_OPTIONS[0] });

  const openAdd = () => { setEditing(null); setForm({ name: '', crest: 'home', accentColor: ACCENT_OPTIONS[0] }); setShowDialog(true); };
  const openEdit = (h: House) => { setEditing(h); setForm({ name: h.name, crest: h.crest, accentColor: h.accentColor ?? ACCENT_OPTIONS[0] }); setShowDialog(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name.trim(), crest: form.crest, accentColor: form.accentColor };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/houses'] }); setShowDialog(false); toast.success(`${form.name} updated.`); } });
    } else {
      createMutation.mutate({ data }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/houses'] }); setShowDialog(false); toast.success(`${form.name} added.`); } });
    }
  };

  const handleDelete = (h: House) => {
    if (!confirm(`Delete ${h.name}? This cannot be undone.`)) return;
    deleteMutation.mutate({ id: h.id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/houses'] }); toast.success(`${h.name} removed.`); },
      onError: () => toast.error('Could not delete — people may still belong to this house.'),
    });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{houses.length} {houses.length === 1 ? 'house' : 'houses'}</p>
        <Button size="sm" onClick={openAdd}>Add House</Button>
      </div>
      {houses.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
          <p className="font-display text-2xl">No houses yet.</p>
          <p className="text-sm text-muted-foreground">Add the households in your group.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {houses.map(h => (
            <div key={h.id} className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
              style={{ borderLeftWidth: '3px', borderLeftColor: h.accentColor ?? 'hsl(var(--accent))' }}>
              <span className="text-xl">{getCrestEmoji(h.crest)}</span>
              <span className="flex-1 font-medium">{h.name}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(h)}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(h)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">{editing ? 'Edit House' : 'Add House'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. House Vlad" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Crest</Label>
              <div className="flex flex-wrap gap-2">
                {CREST_OPTIONS.map(c => (
                  <button key={c.value} type="button" onClick={() => setForm(f => ({ ...f, crest: c.value }))}
                    className={cn('text-xl p-2 rounded-lg border-2 transition-colors', form.crest === c.value ? 'border-accent bg-accent/10' : 'border-transparent hover:border-border')}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Accent Colour</Label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_OPTIONS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, accentColor: c }))}
                    className={cn('w-7 h-7 rounded-full border-2 transition-all', form.accentColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editing ? 'Save' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── People Tab ────────────────────────────────────────────────────────────────
function PeopleTab({ hostToken }: { hostToken: string }) {
  const hostHeaders = { 'x-host-token': hostToken };
  const queryClient = useQueryClient();

  const { data: people = [], isLoading: peopleLoading } = useListPeople();
  const { data: houses = [] } = useListHouses();
  const createMutation = useCreatePerson({ request: { headers: hostHeaders } });
  const updateMutation = useUpdatePerson({ request: { headers: hostHeaders } });
  const deleteMutation = useDeletePerson({ request: { headers: hostHeaders } });
  const pinMutation = useResetPersonPin({ request: { headers: hostHeaders } });

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState({ name: '', houseId: 0, avatar: '', active: true });

  const openAdd = () => { setEditing(null); setForm({ name: '', houseId: houses[0]?.id ?? 0, avatar: '', active: true }); setShowDialog(true); };
  const openEdit = (p: Person) => { setEditing(p); setForm({ name: p.name, houseId: p.houseId, avatar: p.avatar ?? '', active: p.active }); setShowDialog(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name.trim(), houseId: form.houseId, avatar: form.avatar.trim() || undefined, active: form.active };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/people'] }); setShowDialog(false); toast.success(`${form.name} updated.`); } });
    } else {
      createMutation.mutate({ data }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/people'] }); setShowDialog(false); toast.success(`${form.name} added to the directory.`); } });
    }
  };

  const handleDelete = (p: Person) => {
    if (!confirm(`Remove ${p.name} from the directory?`)) return;
    deleteMutation.mutate({ id: p.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/people'] }); toast.success(`${p.name} removed.`); } });
  };

  const handleResetAccess = (p: Person) => {
    if (!confirm(`Reset access for ${p.name}?\n\nThis will clear their PIN and activation. They will need to re-activate using their email address before they can log in again.`)) return;
    pinMutation.mutate({ id: p.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/people'] });
        toast.success(`${p.name}'s access has been reset. They can re-activate using their email.`);
      },
      onError: () => toast.error('Could not reset access. Please try again.'),
    });
  };

  const grouped = houses.map(h => ({ house: h, people: people.filter(p => p.houseId === h.id) })).filter(g => g.people.length > 0);

  if (peopleLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{people.length} {people.length === 1 ? 'person' : 'people'}</p>
        <Button size="sm" onClick={openAdd} disabled={houses.length === 0}>Add Person</Button>
      </div>
      {houses.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Add at least one house before adding people.</p>}
      {people.length === 0 && houses.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
          <p className="font-display text-2xl">No people yet.</p>
          <p className="text-sm text-muted-foreground">Add the people who regularly join your evenings.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ house, people: hPeople }) => (
            <div key={house.id} className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <span className="text-sm">{getCrestEmoji(house.crest)}</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{house.name}</span>
              </div>
              {hPeople.map(p => (
                <div key={p.id} className={cn('flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5', !p.active && 'opacity-50')}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white shrink-0"
                    style={{ backgroundColor: house.accentColor ?? 'hsl(var(--primary))' }}>
                    {p.avatar ? p.avatar : p.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    {p.email && (
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {!p.active && <span className="text-xs text-muted-foreground">inactive</span>}
                      {p.activated
                        ? <span className="text-xs text-green-700 flex items-center gap-0.5"><KeyRound size={10} />Activated</span>
                        : p.hasPin
                          ? <span className="text-xs text-amber-700 flex items-center gap-0.5"><KeyRound size={10} />Admin PIN (not self-activated)</span>
                          : <span className="text-xs text-muted-foreground flex items-center gap-0.5"><KeyRound size={10} />Not activated</span>
                      }
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => handleResetAccess(p)}
                      disabled={pinMutation.isPending}
                    >
                      Reset Access
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit person dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">{editing ? 'Edit Person' : 'Add Person'}</DialogTitle>
            <DialogDescription>{editing ? "Update this person's details." : 'Add someone to the permanent directory.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Count Vlad" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>House</Label>
              <select value={form.houseId} onChange={e => setForm(f => ({ ...f, houseId: parseInt(e.target.value) }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                <option value="">Select a house…</option>
                {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Avatar <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {AVATAR_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, avatar: f.avatar === emoji ? '' : emoji }))}
                    className={cn(
                      'text-xl p-1.5 rounded-lg border-2 transition-colors leading-none',
                      form.avatar === emoji
                        ? 'border-accent bg-accent/10'
                        : 'border-transparent hover:border-border',
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Tap to select · tap again to clear. Shown on member cards.</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
              <Label htmlFor="active" className="cursor-pointer">Active <span className="text-xs text-muted-foreground font-normal">(inactive people are hidden from the login page)</span></Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editing ? 'Save' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ─── Event Overview Panel ──────────────────────────────────────────────────────
function EventOverview({ eventToken, hostToken }: { eventToken: string; hostToken: string }) {
  const hostHeaders = { 'x-host-token': hostToken };
  const queryClient = useQueryClient();

  const { data: members = [] } = useListMembers(eventToken, { query: { enabled: !!eventToken } as any });
  const { data: balancesData } = useGetBalances(eventToken, { query: { enabled: !!eventToken } as any });
  const { data: settlements = [] } = useGetSettlements(eventToken, { query: { enabled: !!eventToken } as any });
  const { data: summary } = useGetEventSummary(eventToken, { query: { enabled: !!eventToken } as any });
  const { data: allPeople = [] } = useListPeople();

  const addAttendeeMutation = useAddAttendee({ request: { headers: hostHeaders } });
  const removeMemberMutation = useRemoveMember({ request: { headers: hostHeaders } });

  const [showAddDialog, setShowAddDialog] = useState(false);

  const approved = members.filter(m => m.approved);
  const claimed = members.filter(m => m.claimed);

  // People in the directory who are not yet attendees of this event
  const memberPersonIds = new Set(members.map(m => (m as any).personId).filter(Boolean));
  const availablePeople = allPeople.filter(p => p.active && !memberPersonIds.has(p.id));

  const houseMap = new Map<string, typeof members>();
  const noHouse: typeof members = [];
  for (const m of approved) {
    const key = m.houseName ?? '__none__';
    if (key === '__none__') { noHouse.push(m); continue; }
    if (!houseMap.has(key)) houseMap.set(key, []);
    houseMap.get(key)!.push(m);
  }

  const invalidateMembers = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/events/${eventToken}/members`] });
    queryClient.invalidateQueries({ queryKey: [`/api/events/${eventToken}/balances`] });
    queryClient.invalidateQueries({ queryKey: [`/api/events/${eventToken}/settlements`] });
    queryClient.invalidateQueries({ queryKey: ['/api/events'] });
  };

  const handleAddAttendee = (personId: number, personName: string) => {
    addAttendeeMutation.mutate(
      { token: eventToken, data: { personId } },
      {
        onSuccess: () => {
          invalidateMembers();
          toast.success(`${personName} added to the event.`);
        },
        onError: () => toast.error('Could not add attendee. Please try again.'),
      },
    );
  };

  const handleRemoveMember = (memberId: number, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this event?`)) return;
    removeMemberMutation.mutate(
      { token: eventToken, memberId },
      {
        onSuccess: () => {
          invalidateMembers();
          toast.success(`${memberName} removed from the event.`);
        },
        onError: () => toast.error('Could not remove attendee. Please try again.'),
      },
    );
  };

  const renderMemberRow = (m: (typeof members)[0]) => {
    const accentColor = m.houseAccentColor ?? undefined;
    const balance = balancesData?.memberBalances.find(b => b.memberId === m.id);
    const net = balance?.netBalance ?? 0;
    return (
      <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
          style={{ backgroundColor: accentColor ?? 'hsl(var(--primary))' }}>
          {m.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
          <div className="flex items-center gap-2">
            {m.isHost && <span className="text-xs text-muted-foreground">host</span>}
            {m.claimed
              ? <span className="text-xs text-green-700">seen</span>
              : <span className="text-xs text-muted-foreground">not seen</span>}
          </div>
        </div>
        {net !== 0 && (
          <p className={cn('text-xs font-semibold tabular-nums', net > 0 ? 'text-green-700' : 'text-amber-700')}>
            {net > 0 ? '+' : ''}{formatCurrency(net)}
          </p>
        )}
        {!m.isHost && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive shrink-0 h-7 px-2 text-xs"
            onClick={() => handleRemoveMember(m.id, m.name)}
            disabled={removeMemberMutation.isPending}
          >
            Remove
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: <Users size={14} />, label: 'Members', value: `${claimed.length}/${approved.length}` },
          { icon: <TrendingUp size={14} />, label: 'Total Spent', value: formatCurrency(summary?.totalExpenses ?? 0) },
          { icon: <CheckCircle size={14} />, label: 'Settlements', value: String((settlements as any[]).length) },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-2 sm:px-4 py-3 space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-muted-foreground">{stat.icon}<span className="text-xs truncate">{stat.label}</span></div>
            <p className="font-display text-lg sm:text-2xl text-foreground truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Attendees</h3>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs"
            onClick={() => setShowAddDialog(true)}
            disabled={availablePeople.length === 0}
          >
            + Add
          </Button>
        </div>
        {Array.from(houseMap.entries()).map(([houseName, hMembers]) => (
          <div key={houseName} className="space-y-1">
            <p className="text-xs text-muted-foreground px-1 font-medium">{houseName}</p>
            {hMembers.map(renderMemberRow)}
          </div>
        ))}
        {noHouse.map(renderMemberRow)}
      </div>

      {(settlements as any[]).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Settlements</h3>
          <div className="space-y-2">
            {(settlements as any[]).slice(0, 5).map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
                <span className="text-sm font-medium text-foreground flex-1 truncate">{s.fromMemberName}</span>
                <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1 truncate">{s.toMemberName}</span>
                <span className="text-sm font-semibold tabular-nums text-amber-700">{formatCurrency(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && summary.categoryBreakdown.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">By Category</h3>
          <div className="space-y-1.5">
            {summary.categoryBreakdown.sort((a, b) => b.total - a.total).map(cat => (
              <div key={cat.category} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2">
                <span className="text-sm text-foreground capitalize">{cat.category} <span className="text-xs text-muted-foreground">×{cat.count}</span></span>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(cat.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add attendee dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">Add Attendee</DialogTitle>
            <DialogDescription>Select a person from the directory to add to this event.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-1">
            {availablePeople.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Everyone in the directory is already attending.</p>
            ) : (
              availablePeople.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                  onClick={() => { handleAddAttendee(p.id, p.name); setShowAddDialog(false); }}
                  disabled={addAttendeeMutation.isPending}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                    style={{ backgroundColor: p.houseAccentColor ?? 'hsl(var(--primary))' }}>
                    {p.avatar ? p.avatar : p.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.houseName}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Event Details Editor ──────────────────────────────────────────────────────
function EventDetailsDialog({ eventToken, hostToken, onClose }: { eventToken: string; hostToken: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: '', venue: '', address: '', mapsLink: '',
    startDate: '', endDate: '', itinerary: '', bannerImage: '',
    settlementMode: 'individual' as 'individual' | 'house',
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!eventToken || loaded) return;
    fetch(`${import.meta.env.BASE_URL}api/events/${eventToken}`)
      .then(r => r.json())
      .then(data => {
        setForm({
          description: data.description ?? '',
          venue: data.venue ?? '',
          address: data.address ?? '',
          mapsLink: data.mapsLink ?? '',
          startDate: data.startDate ? new Date(data.startDate).toISOString().slice(0, 16) : '',
          endDate: data.endDate ? new Date(data.endDate).toISOString().slice(0, 16) : '',
          itinerary: data.itinerary ?? '',
          bannerImage: data.bannerImage ?? '',
          settlementMode: data.settlementMode ?? 'individual',
        });
        setLoaded(true);
      })
      .catch(() => {});
  }, [eventToken, loaded]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/events/${eventToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-host-token': hostToken },
        body: JSON.stringify({
          description: form.description || null,
          venue: form.venue || null,
          address: form.address || null,
          mapsLink: form.mapsLink || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          itinerary: form.itinerary || null,
          bannerImage: form.bannerImage || null,
          settlementMode: form.settlementMode,
        }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventToken}`] });
      toast.success('Event details saved.');
      onClose();
    } catch {
      toast.error('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 pt-1 max-h-[65dvh] overflow-y-auto">
      <div className="space-y-1.5">
        <Label>Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="What's the occasion? A sentence or two is plenty."
          maxLength={500}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
        />
        <p className="text-xs text-muted-foreground text-right">{form.description.length}/500</p>
      </div>
      <div className="space-y-1.5">
        <Label>Banner image URL <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
        <Input value={form.bannerImage} onChange={e => setForm(f => ({ ...f, bannerImage: e.target.value }))} placeholder="https://…" type="url" />
        <p className="text-xs text-muted-foreground">Shown as a hero image at the top of the event page.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Venue</Label>
        <Input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="Venue name" />
      </div>
      <div className="space-y-1.5">
        <Label>Address</Label>
        <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
      </div>
      <div className="space-y-1.5">
        <Label>Google Maps link</Label>
        <Input value={form.mapsLink} onChange={e => setForm(f => ({ ...f, mapsLink: e.target.value }))} placeholder="https://maps.google.com/…" type="url" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Start</Label>
          <Input type="datetime-local" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>End</Label>
          <Input type="datetime-local" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Itinerary</Label>
        <textarea
          value={form.itinerary}
          onChange={e => setForm(f => ({ ...f, itinerary: e.target.value }))}
          placeholder="7:00 PM – Arrive&#10;8:00 PM – Dinner&#10;…"
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Settlement mode</Label>
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
          {(['individual', 'house'] as const).map(m => (
            <button key={m} type="button" onClick={() => setForm(f => ({ ...f, settlementMode: m }))}
              className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize',
                form.settlementMode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {m === 'house' ? 'By House' : 'Individual'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {form.settlementMode === 'house' ? 'Settlements are grouped by house.' : 'Each person settles individually.'}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Details'}</Button>
      </DialogFooter>
    </form>
  );
}

// ─── Events Tab ────────────────────────────────────────────────────────────────
function EventsTab({ hostToken }: { hostToken: string }) {
  const hostHeaders = { 'x-host-token': hostToken };
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: events = [], isLoading } = useListEvents({ request: { headers: hostHeaders } });
  const { data: people = [] } = useListPeople();
  const createMutation = useCreateEvent({ request: { headers: hostHeaders } });
  const freezeMutation = useFreezeEvent({ request: { headers: hostHeaders } });
  const unfreezeMutation = useUnfreezeEvent({ request: { headers: hostHeaders } });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState<string | null>(null);
  const [showOverviewToken, setShowOverviewToken] = useState<string | null>(null);
  const [createdEvent, setCreatedEvent] = useState<{ token: string; name: string; pin: string } | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', hostPersonId: 0, attendeePersonIds: [] as number[] });
  const activePeople = people.filter(p => p.active);

  const toggleAttendee = (id: number) => {
    setForm(f => ({
      ...f,
      attendeePersonIds: f.attendeePersonIds.includes(id) ? f.attendeePersonIds.filter(x => x !== id) : [...f.attendeePersonIds, id],
    }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: {
        name: form.name.trim(),
        hostPersonId: form.hostPersonId,
        attendeePersonIds: Array.from(new Set([form.hostPersonId, ...form.attendeePersonIds])),
      },
    }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: ['/api/events'] });
        setShowCreateDialog(false);
        setCreatedEvent({ token: result.event.token, name: result.event.name, pin: result.pin });
        setShowShareDialog(true);
      },
      onError: () => toast.error('Could not create event. Please try again.'),
    });
  };

  const handleToggleFreeze = (ev: any) => {
    if (ev.frozen) {
      if (!confirm(`Reopen "${ev.name}"? Expenses and attendee changes will be allowed again.`)) return;
      setToggling(ev.token);
      unfreezeMutation.mutate({ token: ev.token }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/events'] });
          toast.success(`"${ev.name}" reopened.`);
        },
        onError: () => toast.error('Could not reopen event.'),
        onSettled: () => setToggling(null),
      });
    } else {
      if (!confirm(`Close "${ev.name}"? No new expenses or attendee changes will be allowed.`)) return;
      setToggling(ev.token);
      freezeMutation.mutate({ token: ev.token }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/events'] });
          toast.success(`"${ev.name}" closed.`);
        },
        onError: () => toast.error('Could not close event.'),
        onSettled: () => setToggling(null),
      });
    }
  };

  const handleArchive = async (ev: any) => {
    if (!confirm(`Archive "${ev.name}"? It will be hidden from the events list and closed.`)) return;
    setArchiving(ev.token);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/events/${ev.token}`, {
        method: 'DELETE',
        headers: { 'x-host-token': hostToken },
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast.success(`"${ev.name}" archived.`);
    } catch {
      toast.error('Could not archive. Please try again.');
    } finally {
      setArchiving(null);
    }
  };

  const handleDelete = async (ev: any) => {
    if (!confirm(`Permanently delete "${ev.name}" and all its data? This cannot be undone.`)) return;
    setDeleting(ev.token);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/events/${ev.token}?mode=hard`, {
        method: 'DELETE',
        headers: { 'x-host-token': hostToken },
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast.success(`"${ev.name}" deleted.`);
    } catch {
      toast.error('Could not delete. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const shareUrl = createdEvent ? `${window.location.origin}${import.meta.env.BASE_URL}e/${createdEvent.token}` : '';
  const copyLink = () => navigator.clipboard.writeText(shareUrl).then(() => toast.success('Link copied.'));

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{events.length} {events.length === 1 ? 'event' : 'events'}</p>
        <Button size="sm" onClick={() => { setForm({ name: '', hostPersonId: activePeople[0]?.id ?? 0, attendeePersonIds: [] }); setShowCreateDialog(true); }}>
          New Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
          <p className="font-display text-2xl">No events yet.</p>
          <p className="text-sm text-muted-foreground">Create the first event when the evening begins.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(events as any[]).map(ev => (
            <div key={ev.id} className={cn('rounded-lg border border-border bg-card px-4 py-3 space-y-2', ev.archived && 'opacity-60')}>
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{ev.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ev.memberCount} people · {formatCurrency(ev.totalExpenses)} ·{' '}
                    {ev.archived ? 'Archived' : ev.frozen ? 'Closed' : 'Open'}
                  </p>
                </div>
                {/* Mobile: primary action + overflow menu */}
                <div className="flex sm:hidden items-center gap-1.5 shrink-0">
                  {!ev.archived && (
                    <Button size="sm" variant="outline" onClick={() => setLocation(`/e/${ev.token}/dashboard`)}>Open</Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="px-2">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-36">
                      {!ev.archived && (
                        <>
                          <DropdownMenuItem onClick={() => setShowDetailsDialog(showDetailsDialog === ev.token ? null : ev.token)}>
                            Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowOverviewToken(showOverviewToken === ev.token ? null : ev.token)}>
                            {showOverviewToken === ev.token ? 'Close Overview' : 'Overview'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleFreeze(ev)}
                            disabled={toggling === ev.token}
                            className={ev.frozen ? 'text-green-700 focus:text-green-700' : ''}
                          >
                            {toggling === ev.token ? '…' : ev.frozen ? 'Unfreeze' : 'Freeze'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleArchive(ev)}
                            disabled={archiving === ev.token}
                          >
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleDelete(ev)}
                        disabled={deleting === ev.token}
                        className="text-destructive focus:text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Desktop: full button row */}
                <div className="hidden sm:flex gap-1.5 shrink-0 flex-wrap justify-end">
                  {!ev.archived && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setShowDetailsDialog(showDetailsDialog === ev.token ? null : ev.token)}>
                        Details
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowOverviewToken(showOverviewToken === ev.token ? null : ev.token)}>
                        {showOverviewToken === ev.token ? 'Close' : 'Overview'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setLocation(`/e/${ev.token}/dashboard`)}>Open</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={ev.frozen ? 'text-green-700 hover:text-green-700' : 'text-muted-foreground'}
                        onClick={() => handleToggleFreeze(ev)}
                        disabled={toggling === ev.token}
                      >
                        {toggling === ev.token ? '…' : ev.frozen ? 'Unfreeze' : 'Freeze'}
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => handleArchive(ev)}
                        disabled={archiving === ev.token}
                      >
                        Archive
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm" variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(ev)}
                    disabled={deleting === ev.token}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {showOverviewToken === ev.token && (
                <div className="border-t border-border pt-4 mt-2">
                  <EventOverview eventToken={ev.token} hostToken={hostToken} />
                </div>
              )}
              {showDetailsDialog === ev.token && (
                <div className="border-t border-border pt-4 mt-2">
                  <EventDetailsDialog eventToken={ev.token} hostToken={hostToken} onClose={() => setShowDetailsDialog(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create event dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">New Event</DialogTitle>
            <DialogDescription>Name the evening and optionally seed a few known attendees.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Event name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Movie Night" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Host (you)</Label>
              <select value={form.hostPersonId} onChange={e => setForm(f => ({ ...f, hostPersonId: parseInt(e.target.value) }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                <option value="">Select host…</option>
                {activePeople.map(p => <option key={p.id} value={p.id}>{p.name} ({p.houseName})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Seed attendees <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border border-input p-2">
                {activePeople.map(p => (
                  <label key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/40">
                    <input type="checkbox"
                      checked={form.attendeePersonIds.includes(p.id) || form.hostPersonId === p.id}
                      disabled={form.hostPersonId === p.id}
                      onChange={() => toggleAttendee(p.id)}
                      className="rounded" />
                    <span className="text-sm">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{p.houseName}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={!form.name || !form.hostPersonId || createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">{createdEvent?.name} is ready.</DialogTitle>
            <DialogDescription>Share this link via WhatsApp. The PIN confirms the right event.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Event link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="text-xs font-mono" />
                <Button size="sm" variant="outline" onClick={copyLink}>Copy</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">PIN</Label>
              <p className="font-display text-5xl tracking-[0.3em] pl-1">{createdEvent?.pin}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowShareDialog(false); setLocation(`/e/${createdEvent?.token}/dashboard`); }}>
              Open Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Appearance Section ────────────────────────────────────────────────────────
function AppearanceSection() {
  const { settings, resolvedTheme, weatherLoading, updateSettings } = useThemeContext();

  const modes: ThemeMode[] = ['classic', 'seasonal', 'weather', 'manual'];

  return (
    <div className="space-y-4">

      {/* Mode selection */}
      <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Theme Mode</p>
          <p className="text-xs text-muted-foreground mt-0.5">Controls how the application chooses its look.</p>
        </div>
        <div className="space-y-2">
          {modes.map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => updateSettings({ ...settings, mode })}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors',
                settings.mode === mode
                  ? 'border-primary bg-primary/6'
                  : 'border-border bg-background hover:bg-muted/40',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{MODE_LABELS[mode]}</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{MODE_DESCRIPTIONS[mode]}</p>
              </div>
              {settings.mode === mode && (
                weatherLoading && mode === 'weather'
                  ? <Loader2 size={15} className="text-primary shrink-0 animate-spin" />
                  : <CheckCircle size={15} className="text-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Manual theme picker — only shown when mode is 'manual' */}
      {settings.mode === 'manual' && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Theme</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {THEMES.map(theme => (
              <button
                key={theme}
                type="button"
                onClick={() => updateSettings({ ...settings, manualTheme: theme })}
                className={cn(
                  'px-3 py-2.5 rounded-lg border text-sm font-medium text-center transition-colors',
                  settings.manualTheme === theme
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted/40',
                )}
              >
                {THEME_LABELS[theme]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subtle Motion toggle */}
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Subtle Motion</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              Gentle hover lifts and card responses. Never sounds.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.subtleMotion}
            onClick={() => updateSettings({ ...settings, subtleMotion: !settings.subtleMotion })}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
              settings.subtleMotion ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                settings.subtleMotion ? 'translate-x-5' : 'translate-x-0',
              )}
            />
          </button>
        </div>
      </div>

      {/* Evening Highlight icon picker */}
      <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Evening Highlight</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Icon shown beside the top contributor on the balances screen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {HIGHLIGHT_ICON_OPTIONS.map(icon => (
            <button
              key={icon}
              type="button"
              onClick={() => updateSettings({ ...settings, highlightIcon: icon })}
              className={cn(
                'text-xl p-2 rounded-lg border-2 transition-colors leading-none',
                settings.highlightIcon === icon
                  ? 'border-accent bg-accent/10'
                  : 'border-transparent hover:border-border',
              )}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Active theme indicator */}
      <p className="text-xs text-muted-foreground text-center">
        {weatherLoading
          ? 'Fetching local weather…'
          : <>Active theme: <span className="font-medium text-foreground">{THEME_LABELS[resolvedTheme]}</span></>}
      </p>
    </div>
  );
}

// ─── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab({ hostToken }: { hostToken: string }) {
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded) return;
    fetch(`${import.meta.env.BASE_URL}api/settings/skipper_note`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.value) setNote(data.value);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [loaded]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/settings/skipper_note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-host-token': hostToken },
        body: JSON.stringify({ value: note }),
      });
      if (!res.ok) throw new Error();
      toast.success('Skipper\'s Note saved.');
    } catch {
      toast.error('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* ── Appearance ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Appearance</p>
        <AppearanceSection />
      </div>

      {/* ── Skipper's Note ── */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Skipper's Note</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Shown on the login page as an editorial card. Leave blank to hide it.
            </p>
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Roads are clear — see you all tonight! Dress warm, it's a cold one."
            maxLength={500}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{note.length}/500</p>
            <div className="flex gap-2">
              {note && (
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground"
                  onClick={() => setNote('')}>
                  Clear
                </Button>
              )}
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save Note'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Main Console ──────────────────────────────────────────────────────────────
export default function StewardsDeskPage() {
  const [, setLocation] = useLocation();
  const { token: hostToken, logout } = useHostSession();

  useEffect(() => {
    if (!hostToken) setLocation('/host');
  }, [hostToken, setLocation]);

  if (!hostToken) return null;

  return (
    <div className="min-h-dvh bg-background transition-page">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation('/')} className="font-display text-xl text-foreground hover:text-accent transition-colors">
            EvenSteven
          </button>
          <span className="text-muted-foreground/40 text-sm">·</span>
          <span className="text-sm text-muted-foreground">Steward's Desk</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { logout(); setLocation('/host'); }}>
          Sign out
        </Button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Tabs defaultValue="events">
          <TabsList className="mb-6 bg-muted/60">
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="people">Directory</TabsTrigger>
            <TabsTrigger value="houses">Houses</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="events">
            <EventsTab hostToken={hostToken} />
          </TabsContent>
          <TabsContent value="people">
            <PeopleTab hostToken={hostToken} />
          </TabsContent>
          <TabsContent value="houses">
            <HousesTab hostToken={hostToken} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab hostToken={hostToken} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
