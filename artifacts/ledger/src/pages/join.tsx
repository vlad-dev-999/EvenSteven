import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { toast } from 'sonner';
import { useGetEvent, useGetIdentityOptions, useIdentifyMember } from '@workspace/api-client-react';
import type { IdentityHouse, IdentityMember } from '@workspace/api-client-react';
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
  const [showNewPinDialog, setShowNewPinDialog] = useState(false);
  const [newPersonalPin, setNewPersonalPin] = useState('');

  const { data: event, isLoading: eventLoading, error: eventError } = useGetEvent(token ?? '', {
    query: { enabled: !!token, retry: false } as any,
  });

  const { data: options, isLoading: optionsLoading, refetch: refetchOptions } = useGetIdentityOptions(token ?? '', {
    query: { enabled: !!token && !!event } as any,
  });

  const identifyMutation = useIdentifyMember();

  // Redirect if already identified
  useEffect(() => {
    if (session) {
      setLocation(`/e/${token}/dashboard`);
    }
  }, [session, token, setLocation]);

  if (eventError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="font-display text-3xl text-foreground">
            Event not found.
          </h1>
          <p className="text-sm text-muted-foreground">
            This link may have expired or the event was removed.
          </p>
          <Button variant="outline" onClick={() => setLocation('/')}>
            Go home
          </Button>
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

  const handleMemberTap = (member: IdentityMember, house: IdentityHouse) => {
    setSelectedMember(member);
    setSelectedHouseName(house.name);

    if (member.claimed) {
      // Already claimed — ask for personal PIN
      setPinInput('');
      setShowPinDialog(true);
    } else {
      // First time — claim identity
      identifyMutation.mutate(
        { token: token!, data: { memberId: member.id } },
        {
          onSuccess: (result) => {
            if (result.personalPin) {
              setNewPersonalPin(result.personalPin);
              setShowNewPinDialog(true);
              // Store session
              setSession({
                memberId: result.memberId,
                memberName: result.memberName,
                isHost: result.isHost,
                personalPin: result.personalPin,
              });
            } else {
              setSession({
                memberId: result.memberId,
                memberName: result.memberName,
                isHost: result.isHost,
              });
              setLocation(`/e/${token}/dashboard`);
            }
          },
          onError: (err: any) => {
            const status = err?.status;
            if (status === 409) {
              // Race condition — someone else just claimed it
              setPinInput('');
              setShowPinDialog(true);
              refetchOptions();
            } else {
              toast.error('Something went wrong. Please try again.');
            }
          },
        },
      );
    }
  };

  const handlePinVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    identifyMutation.mutate(
      { token: token!, data: { memberId: selectedMember.id, personalPin: pinInput } },
      {
        onSuccess: (result) => {
          setSession({
            memberId: result.memberId,
            memberName: result.memberName,
            isHost: result.isHost,
            personalPin: pinInput,
          });
          setShowPinDialog(false);
          setLocation(`/e/${token}/dashboard`);
        },
        onError: () => {
          toast.error('Incorrect PIN. Try again.');
          setPinInput('');
        },
      },
    );
  };

  const handleNewPinDismiss = () => {
    setShowNewPinDialog(false);
    setLocation(`/e/${token}/dashboard`);
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
            Who's joining tonight?
          </h1>
          <p className="text-sm text-muted-foreground">
            Select your house, then tap your name.
          </p>
        </div>

        {/* House cards */}
        {houses.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
            <p className="font-display text-2xl text-foreground">
              The evening awaits.
            </p>
            <p className="text-sm text-muted-foreground">
              No attendees have been added yet. The host will prepare the event shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {houses.map((house) => {
              const isExpanded = expandedHouseId === house.id;
              const accentStyle = house.accentColor
                ? { borderLeftColor: house.accentColor }
                : {};

              return (
                <div
                  key={house.id}
                  className="rounded-xl border border-border bg-card overflow-hidden transition-all"
                  style={{ borderLeftWidth: '3px', ...accentStyle }}
                >
                  {/* House header */}
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedHouseId(isExpanded ? null : house.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg" aria-hidden>🏠</span>
                      <span className="font-medium text-foreground">{house.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {house.members.length} {house.members.length === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        'text-muted-foreground transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Members list */}
                  {isExpanded && (
                    <div className="border-t border-border divide-y divide-border">
                      {house.members.map((member) => (
                        <button
                          key={member.id}
                          className={cn(
                            'w-full flex items-center gap-4 px-5 py-3 text-left transition-colors',
                            'hover:bg-muted/40',
                            member.claimed && 'opacity-60'
                          )}
                          onClick={() => handleMemberTap(member, house)}
                          disabled={identifyMutation.isPending && selectedMember?.id === member.id}
                        >
                          {/* Avatar */}
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-primary-foreground shrink-0"
                            style={{ backgroundColor: house.accentColor ?? 'hsl(var(--primary))' }}
                          >
                            {getInitials(member.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {member.name}
                              {member.isHost && (
                                <span className="ml-2 text-xs text-muted-foreground font-normal">
                                  host
                                </span>
                              )}
                            </p>
                            {member.claimed && (
                              <p className="text-xs text-muted-foreground">
                                Joining from another device?
                              </p>
                            )}
                          </div>
                          {identifyMutation.isPending && selectedMember?.id === member.id ? (
                            <span className="text-xs text-muted-foreground animate-pulse">…</span>
                          ) : null}
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

      {/* PIN verification dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">
              Welcome back, {selectedMember?.name}.
            </DialogTitle>
            <DialogDescription>
              This identity was claimed on another device. Enter your personal PIN to continue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePinVerify} className="space-y-4 pt-2">
            <Input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="4-digit PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              autoFocus
              required
              className="text-center text-lg tracking-widest"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPinDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pinInput.length !== 4 || identifyMutation.isPending}>
                {identifyMutation.isPending ? 'Verifying…' : 'Continue'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New PIN reveal dialog */}
      <Dialog open={showNewPinDialog} onOpenChange={setShowNewPinDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">
              Your personal PIN
            </DialogTitle>
            <DialogDescription>
              Save this four-digit PIN. If you open this event on another device,
              you'll need it to reclaim your identity.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="font-display text-6xl text-foreground tracking-[0.3em]">
              {newPersonalPin}
            </p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={handleNewPinDismiss}>
              I've noted it — continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
