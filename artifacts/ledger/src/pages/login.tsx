/**
 * Login page — global directory auth.
 * Flow: Select House → Select Alias → Enter PIN
 * If person is not yet activated → redirect to /activate
 */
import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { toast } from 'sonner';
import { usePersonSession } from '@/hooks/use-person-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

interface HouseGroup {
  id: number;
  name: string;
  crest: string;
  accentColor: string | null;
  members: Array<{
    id: number;
    name: string;
    houseName: string;
    houseId: number;
    houseAccentColor: string | null;
    houseCrest: string;
    avatar: string | null;
    activated: boolean;
    hasPin: boolean;
  }>;
}

async function fetchDirectory(): Promise<HouseGroup[]> {
  const [housesRes, peopleRes] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}api/houses`),
    fetch(`${import.meta.env.BASE_URL}api/people`),
  ]);
  if (!housesRes.ok || !peopleRes.ok) throw new Error('Failed to load directory');
  const houses: any[] = await housesRes.json();
  const people: any[] = await peopleRes.json();

  const activePeople = people.filter((p: any) => p.active);
  return houses
    .map((h: any) => ({
      id: h.id,
      name: h.name,
      crest: h.crest,
      accentColor: h.accentColor ?? null,
      members: activePeople
        .filter((p: any) => p.houseId === h.id)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          houseName: h.name,
          houseId: h.id,
          houseAccentColor: h.accentColor ?? null,
          houseCrest: h.crest,
          avatar: p.avatar ?? null,
          activated: p.activated ?? false,
          hasPin: p.hasPin ?? false,
        })),
    }))
    .filter((h: any) => h.members.length > 0);
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const redirect = params.get('redirect') ?? '/my-events';

  const { session, setSession } = usePersonSession();

  const [houses, setHouses] = useState<HouseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [skipperNote, setSkipperNote] = useState<string | null>(null);
  const [expandedHouseId, setExpandedHouseId] = useState<number | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<HouseGroup['members'][0] | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (session) {
      setLocation(redirect);
    }
  }, [session, redirect, setLocation]);

  useEffect(() => {
    Promise.all([
      fetchDirectory(),
      fetch(`${import.meta.env.BASE_URL}api/settings/skipper_note`).then(r => r.ok ? r.json() : null),
    ])
      .then(([dirs, noteData]) => {
        setHouses(dirs);
        if (noteData?.value) setSkipperNote(noteData.value);
      })
      .catch(() => toast.error('Could not load the directory. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const handlePersonTap = (person: HouseGroup['members'][0]) => {
    if (!person.activated && !person.hasPin) {
      setLocation(`/activate?personId=${person.id}&name=${encodeURIComponent(person.name)}&houseId=${person.houseId}&redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setSelectedPerson(person);
    setPinInput('');
    setShowPinDialog(true);
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson || pinInput.length !== 4) return;
    setVerifying(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/directory/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: selectedPerson.id, pin: pinInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setSession({
          personId: data.personId,
          personName: data.personName,
          houseId: data.houseId,
          houseName: data.houseName,
          houseAccentColor: data.houseAccentColor,
          houseCrest: data.houseCrest,
        });
        setShowPinDialog(false);
        setLocation(redirect);
      } else if (res.status === 403) {
        const data = await res.json();
        if (data.error === 'not_activated') {
          setShowPinDialog(false);
          setLocation(`/activate?personId=${selectedPerson.id}&name=${encodeURIComponent(selectedPerson.name)}&houseId=${selectedPerson.houseId}&redirect=${encodeURIComponent(redirect)}`);
        } else {
          toast.error('Account not activated. Complete setup first.');
        }
      } else if (res.status === 401) {
        toast.error('Incorrect PIN. Try again.');
        setPinInput('');
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } catch {
      toast.error('Could not connect. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading || session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm animate-pulse">A moment…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-10 transition-page">
      <div className="max-w-md mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1 pt-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">EvenSteven</p>
          <h1 className="font-display text-4xl text-foreground">Welcome back.</h1>
          <p className="text-sm text-muted-foreground">
            Select your house, tap your name, and enter your PIN.
          </p>
        </div>

        {houses.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
            <p className="font-display text-2xl text-foreground">The directory is empty.</p>
            <p className="text-sm text-muted-foreground">
              The administrator hasn't added anyone yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {houses.map((house) => {
              const isExpanded = expandedHouseId === house.id;
              const accentStyle = house.accentColor ? { borderLeftColor: house.accentColor } : {};

              return (
                <div
                  key={house.id}
                  className="rounded-xl border border-border bg-card overflow-hidden transition-all"
                  style={{ borderLeftWidth: '3px', ...accentStyle }}
                >
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedHouseId(isExpanded ? null : house.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg" aria-hidden>
                        {house.crest === 'star' ? '⭐' :
                         house.crest === 'leaf' ? '🍃' :
                         house.crest === 'sun' ? '☀️' :
                         house.crest === 'moon' ? '🌙' :
                         house.crest === 'mountain' ? '⛰️' :
                         house.crest === 'wave' ? '🌊' :
                         house.crest === 'flame' ? '🔥' : '🏠'}
                      </span>
                      <span className="font-medium text-foreground">{house.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {house.members.length} {house.members.length === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      className={cn('text-muted-foreground transition-transform duration-200', isExpanded && 'rotate-180')}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border divide-y divide-border">
                      {house.members.map((person) => (
                        <button
                          key={person.id}
                          className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-muted/40 transition-colors"
                          onClick={() => handlePersonTap(person)}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 text-white"
                            style={{ backgroundColor: house.accentColor ?? 'hsl(var(--primary))' }}
                          >
                            {person.avatar ?? getInitials(person.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{person.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {person.activated
                                ? 'Tap to enter your PIN'
                                : person.hasPin
                                  ? 'Tap to enter your PIN'
                                  : 'Not yet activated — tap to set up'}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Skipper's Note — editorial card, hidden when empty */}
        {skipperNote && (
          <div className="rounded-xl border border-border bg-card/60 px-5 py-4 space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70">
              A note from the Skipper
            </p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{skipperNote}</p>
          </div>
        )}

        {/* Spacer so Skipper button doesn't overlap content */}
        <div className="h-8" />
      </div>

      {/* Skipper footer — administrator entry */}
      <div className="fixed bottom-4 right-5 select-none">
        <button
          onClick={() => setLocation('/host')}
          className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors cursor-pointer"
        >
          🐧 Skipper
        </button>
      </div>

      {/* PIN dialog */}
      <Dialog open={showPinDialog} onOpenChange={open => { if (!verifying) setShowPinDialog(open); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">
              Hello, {selectedPerson?.name}.
            </DialogTitle>
            <DialogDescription>
              {selectedPerson?.houseName && (
                <span className="text-muted-foreground">{selectedPerson.houseName} · </span>
              )}
              Enter your 4-digit PIN.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePinSubmit} className="space-y-4 pt-2">
            <Input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="· · · ·"
              value={pinInput}
              onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              autoFocus
              required
              className="text-center text-2xl tracking-[0.5em] font-mono"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPinDialog(false)}
                disabled={verifying}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pinInput.length !== 4 || verifying}
              >
                {verifying ? 'Verifying…' : 'Enter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
