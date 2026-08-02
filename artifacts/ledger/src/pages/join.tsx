import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { toast } from 'sonner';
import { useGetEvent, useGetIdentityOptions, useIdentifyMember } from '@workspace/api-client-react';
import type { IdentityMember } from '@workspace/api-client-react';
import { useLocalSession } from '@/hooks/use-local-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session, setSession } = useLocalSession(token ?? '');

  const [expandedHouseId, setExpandedHouseId] = useState<number | null>(null);
  const [selectedMember, setSelectedMember] = useState<IdentityMember | null>(null);
  const [selectedHouseName, setSelectedHouseName] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showPinDialog, setShowPinDialog] = useState(false);

  const { data: event, isLoading: eventLoading, error: eventError } = useGetEvent(token ?? '', {
    query: { enabled: !!token, retry: false } as any,
  });

  const { data: options, isLoading: optionsLoading } = useGetIdentityOptions(token ?? '', {
    query: { enabled: !!token && !!event } as any,
  });

  const identifyMutation = useIdentifyMember();

  useEffect(() => {
    if (session) setLocation(`/e/${token}/dashboard`);
  }, [session, token, setLocation]);

  if (eventError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="font-display text-3xl text-foreground">Event not found.</h1>
          <p className="text-sm text-muted-foreground">
            This link may have expired or the event was removed.
          </p>
          <Button variant="outline" onClick={() => setLocation('/')}>Go home</Button>
        </div>
      </div>
    );
  }

  if (eventLoading || optionsLoading || session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm animate-pulse">A moment…</p>
      </div>
    );
  }

  // ── Tap a person from the directory ──────────────────────────────────────────
  const handlePersonTap = (member: IdentityMember, houseName: string) => {
    if (!member.hasPin) {
      toast.error(`${member.name} doesn't have a PIN yet. Ask the host to set one.`);
      return;
    }
    setSelectedMember(member);
    setSelectedHouseName(houseName);
    setPinInput('');
    setShowPinDialog(true);
  };

  // ── Submit PIN ────────────────────────────────────────────────────────────────
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || pinInput.length !== 4) return;

    identifyMutation.mutate(
      { token: token!, data: { personId: selectedMember.id, pin: pinInput } },
      {
        onSuccess: (result) => {
          setSession({
            memberId: result.memberId,
            memberName: result.memberName,
            isHost: result.isHost,
          });
          setShowPinDialog(false);
          setLocation(`/e/${token}/dashboard`);
        },
        onError: (err: any) => {
          if (err?.status === 401 || err?.response?.status === 401) {
            toast.error('Incorrect PIN. Try again.');
            setPinInput('');
          } else if (err?.status === 403 || err?.response?.status === 403) {
            toast.error('No PIN set for this person. Ask the host.');
            setShowPinDialog(false);
          } else {
            toast.error('Something went wrong. Please try again.');
          }
        },
      },
    );
  };

  const houses = options?.houses ?? [];

  return (
    <div className="min-h-dvh bg-background px-4 py-10 transition-page">
      <div className="max-w-md mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1 pt-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            {options?.eventName ?? event?.name}
          </p>
          <h1 className="font-display text-4xl text-foreground">
            Who joins us this evening?
          </h1>
          <p className="text-sm text-muted-foreground">
            Select your house, then tap your name and enter your PIN.
          </p>
        </div>

        {houses.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
            <p className="font-display text-2xl text-foreground">The evening awaits.</p>
            <p className="text-sm text-muted-foreground">
              No directory entries yet. The host will set things up shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {houses.map((house: any) => {
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
                      {house.members.map((member: any) => (
                        <button
                          key={member.id}
                          className={cn(
                            'w-full flex items-center gap-4 px-5 py-3 text-left transition-colors',
                            member.hasPin
                              ? 'hover:bg-muted/40'
                              : 'opacity-50 cursor-not-allowed',
                          )}
                          onClick={() => handlePersonTap(member, house.name)}
                          disabled={identifyMutation.isPending && selectedMember?.id === member.id}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
                            style={{ backgroundColor: house.accentColor ?? 'hsl(var(--primary))' }}
                          >
                            {member.avatar ?? getInitials(member.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {member.name}
                              {member.isHost && (
                                <span className="ml-2 text-xs text-muted-foreground font-normal">host</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member.inEvent
                                ? 'Already joined'
                                : member.hasPin
                                  ? 'Tap to join'
                                  : 'No PIN — ask host'}
                            </p>
                          </div>
                          {identifyMutation.isPending && selectedMember?.id === member.id && (
                            <span className="text-xs text-muted-foreground animate-pulse">…</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PIN entry dialog ── */}
      <Dialog open={showPinDialog} onOpenChange={open => { if (!identifyMutation.isPending) setShowPinDialog(open); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">
              {selectedMember?.inEvent
                ? `Welcome back, ${selectedMember?.name}.`
                : `Hello, ${selectedMember?.name}.`}
            </DialogTitle>
            <DialogDescription>
              {selectedHouseName && (
                <span className="text-muted-foreground">{selectedHouseName} · </span>
              )}
              Enter your 4-digit PIN to join the event.
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
                disabled={identifyMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pinInput.length !== 4 || identifyMutation.isPending}
              >
                {identifyMutation.isPending ? 'Verifying…' : 'Enter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
