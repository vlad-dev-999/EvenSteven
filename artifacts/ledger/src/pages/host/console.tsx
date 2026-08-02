import { useState, useEffect } from 'react';
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
  useListEvents,
  useCreateEvent,
} from '@workspace/api-client-react';
import type { House, Person } from '@workspace/api-client-react';
import { useHostSession } from '@/hooks/use-host-session';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

// ─── Icon accent swatches ──────────────────────────────────────────────────────
const CREST_OPTIONS = [
  { value: 'home', label: '🏠' },
  { value: 'star', label: '⭐' },
  { value: 'leaf', label: '🍃' },
  { value: 'sun', label: '☀️' },
  { value: 'moon', label: '🌙' },
  { value: 'mountain', label: '⛰️' },
  { value: 'wave', label: '🌊' },
  { value: 'flame', label: '🔥' },
];

const ACCENT_OPTIONS = [
  '#8B4513', '#2F6B3F', '#1a3a5c', '#8B6914', '#5c2a8a', '#8B1a1a', '#2a5c8B', '#3d6b4f',
];

function getCrestEmoji(crest: string) {
  return CREST_OPTIONS.find(c => c.value === crest)?.label ?? '🏠';
}

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

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', crest: 'home', accentColor: ACCENT_OPTIONS[0] });
    setShowDialog(true);
  };
  const openEdit = (h: House) => {
    setEditing(h);
    setForm({ name: h.name, crest: h.crest, accentColor: h.accentColor ?? ACCENT_OPTIONS[0] });
    setShowDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name.trim(), crest: form.crest, accentColor: form.accentColor };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/houses'] });
          setShowDialog(false);
          toast.success(`${form.name} updated.`);
        },
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/houses'] });
          setShowDialog(false);
          toast.success(`${form.name} added.`);
        },
      });
    }
  };

  const handleDelete = (h: House) => {
    if (!confirm(`Delete ${h.name}? This cannot be undone.`)) return;
    deleteMutation.mutate({ id: h.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/houses'] });
        toast.success(`${h.name} removed.`);
      },
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
          <p className="font-display text-2xl text-foreground">No houses yet.</p>
          <p className="text-sm text-muted-foreground">Add the households in your group.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {houses.map(h => (
            <div key={h.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
              style={{ borderLeftWidth: '3px', borderLeftColor: h.accentColor ?? 'hsl(var(--accent))' }}
            >
              <span className="text-xl">{getCrestEmoji(h.crest)}</span>
              <span className="flex-1 font-medium text-foreground">{h.name}</span>
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
            <DialogTitle className="font-display text-2xl font-normal">
              {editing ? 'Edit House' : 'Add House'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. House Vlad"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Crest</Label>
              <div className="flex flex-wrap gap-2">
                {CREST_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, crest: c.value }))}
                    className={cn(
                      'text-xl p-2 rounded-lg border-2 transition-colors',
                      form.crest === c.value ? 'border-accent bg-accent/10' : 'border-transparent hover:border-border'
                    )}
                  >{c.label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Accent Colour</Label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, accentColor: c }))}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all',
                      form.accentColor === c ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'Save' : 'Add'}
              </Button>
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

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState({ name: '', houseId: 0, active: true });

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', houseId: houses[0]?.id ?? 0, active: true });
    setShowDialog(true);
  };
  const openEdit = (p: Person) => {
    setEditing(p);
    setForm({ name: p.name, houseId: p.houseId, active: p.active });
    setShowDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name.trim(), houseId: form.houseId, active: form.active };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/people'] });
          setShowDialog(false);
          toast.success(`${form.name} updated.`);
        },
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/people'] });
          setShowDialog(false);
          toast.success(`${form.name} added.`);
        },
      });
    }
  };

  const handleDelete = (p: Person) => {
    if (!confirm(`Remove ${p.name}?`)) return;
    deleteMutation.mutate({ id: p.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/people'] });
        toast.success(`${p.name} removed.`);
      },
    });
  };

  // Group people by house
  const grouped = houses.map(h => ({
    house: h,
    people: people.filter(p => p.houseId === h.id),
  })).filter(g => g.people.length > 0);

  const ungrouped = people.filter(p => !houses.some(h => h.id === p.houseId));

  if (peopleLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{people.length} {people.length === 1 ? 'person' : 'people'}</p>
        <Button size="sm" onClick={openAdd} disabled={houses.length === 0}>Add Person</Button>
      </div>

      {houses.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Add at least one house before adding people.
        </p>
      )}

      {people.length === 0 && houses.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
          <p className="font-display text-2xl text-foreground">No people yet.</p>
          <p className="text-sm text-muted-foreground">Add the people who regularly join your evenings.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ house, people: hPeople }) => (
            <div key={house.id} className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <span className="text-sm">{getCrestEmoji(house.crest)}</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {house.name}
                </span>
              </div>
              {hPeople.map(p => (
                <div key={p.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5',
                    !p.active && 'opacity-50'
                  )}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-primary-foreground"
                    style={{ backgroundColor: house.accentColor ?? 'hsl(var(--primary))' }}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground">{p.name}</span>
                  {!p.active && <span className="text-xs text-muted-foreground">inactive</span>}
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {ungrouped.map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
              <span className="flex-1 text-sm font-medium text-foreground">{p.name}</span>
              <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">
              {editing ? 'Edit Person' : 'Add Person'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mithun"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>House</Label>
              <select
                value={form.houseId}
                onChange={e => setForm(f => ({ ...f, houseId: parseInt(e.target.value) }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select a house…</option>
                {houses.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="active" className="cursor-pointer">Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'Save' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
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

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<{ token: string; name: string; pin: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    hostPersonId: 0,
    attendeePersonIds: [] as number[],
  });

  const activePeople = people.filter(p => p.active);

  const toggleAttendee = (id: number) => {
    setForm(f => ({
      ...f,
      attendeePersonIds: f.attendeePersonIds.includes(id)
        ? f.attendeePersonIds.filter(x => x !== id)
        : [...f.attendeePersonIds, id],
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

  const shareUrl = createdEvent
    ? `${window.location.origin}${import.meta.env.BASE_URL}e/${createdEvent.token}`
    : '';

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => toast.success('Link copied.'));
  };

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
          <p className="font-display text-2xl text-foreground">No events yet.</p>
          <p className="text-sm text-muted-foreground">Create your first event when the evening begins.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <div key={ev.id} className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{ev.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ev.memberCount} people · {formatCurrency(ev.totalExpenses)} · {ev.frozen ? 'Closed' : 'Open'}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setLocation(`/e/${ev.token}/dashboard`)}>
                Open
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create event dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">New Event</DialogTitle>
            <DialogDescription>Name the evening and select who's coming.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Event name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Movie Night"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Host (you)</Label>
              <select
                value={form.hostPersonId}
                onChange={e => setForm(f => ({ ...f, hostPersonId: parseInt(e.target.value) }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select host…</option>
                {activePeople.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.houseName})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Attendees</Label>
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border border-input p-2">
                {activePeople.map(p => (
                  <label key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={form.attendeePersonIds.includes(p.id) || form.hostPersonId === p.id}
                      disabled={form.hostPersonId === p.id}
                      onChange={() => toggleAttendee(p.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-foreground">{p.name}</span>
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
            <DialogTitle className="font-display text-2xl font-normal">
              {createdEvent?.name} is ready.
            </DialogTitle>
            <DialogDescription>
              Share this link on WhatsApp. The PIN confirms the right event.
            </DialogDescription>
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
              <p className="font-display text-5xl tracking-[0.3em] text-foreground pl-1">
                {createdEvent?.pin}
              </p>
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

// ─── Main Console ──────────────────────────────────────────────────────────────
export default function HostConsolePage() {
  const [, setLocation] = useLocation();
  const { token: hostToken, logout } = useHostSession();

  // Redirect if not authenticated
  useEffect(() => {
    if (!hostToken) {
      setLocation('/host');
    }
  }, [hostToken, setLocation]);

  if (!hostToken) return null;

  return (
    <div className="min-h-dvh bg-background transition-page">
      {/* Top bar */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation('/')} className="font-display text-xl text-foreground hover:text-accent transition-colors">
            EvenSteven
          </button>
          <span className="text-muted-foreground/40 text-sm">·</span>
          <span className="text-sm text-muted-foreground">Host Console</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { logout(); setLocation('/host'); }}>
          Sign out
        </Button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Tabs defaultValue="events">
          <TabsList className="mb-6 bg-muted/60">
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="houses">Houses</TabsTrigger>
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
        </Tabs>
      </main>
    </div>
  );
}
