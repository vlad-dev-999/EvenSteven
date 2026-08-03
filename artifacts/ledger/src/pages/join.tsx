/**
 * Join page — entry point for a shared event link (/e/:token).
 *
 * Two-phase flow for authenticated directory members:
 *   Phase 1 (check): POST /directory/events/:token/join (no confirm)
 *     - wasAlreadyAttendee: true  → store session → dashboard
 *     - wasAlreadyAttendee: false → show "Join Event" button
 *   Phase 2 (confirm): POST /directory/events/:token/join { confirm: true }
 *     → store session → dashboard
 *
 * If no global session → redirect to /login?redirect=/e/:token
 */
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useGetEvent } from '@workspace/api-client-react';
import { useLocalSession } from '@/hooks/use-local-session';
import { usePersonSession } from '@/hooks/use-person-session';
import { Button } from '@/components/ui/button';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session: eventSession, setSession: setEventSession } = useLocalSession(token ?? '');
  const { session: personSession } = usePersonSession();

  // 'checking' → calling the endpoint on load
  // 'not-attendee' → confirmed not an attendee, show button
  // 'joining' → user tapped Join Event, request in flight
  type Phase = 'checking' | 'not-attendee' | 'joining';
  const [phase, setPhase] = useState<Phase>('checking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: event, isLoading: eventLoading, error: eventError } = useGetEvent(token ?? '', {
    query: { enabled: !!token, retry: false } as any,
  });

  // Already in this event → go straight to dashboard
  useEffect(() => {
    if (eventSession) {
      setLocation(`/e/${token}/dashboard`);
    }
  }, [eventSession, token, setLocation]);

  // Global session + event loaded → check attendance status
  useEffect(() => {
    if (!token || !event || !personSession || eventSession || phase !== 'checking' || eventError) return;

    fetch(`${import.meta.env.BASE_URL}api/directory/events/${token}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-person-id': String(personSession.personId),
      },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 403 && data.error === 'not_activated') {
          setLocation(`/activate?personId=${personSession.personId}&name=${encodeURIComponent(personSession.personName)}&houseId=${personSession.houseId}&redirect=${encodeURIComponent(`/e/${token}`)}`);
          return;
        }
        if (!res.ok) {
          setErrorMsg(data.error ?? 'Could not open this event.');
          setPhase('not-attendee');
          return;
        }
        if (data.wasAlreadyAttendee) {
          // Already an Attendee — session established, go to dashboard
          setEventSession({
            memberId: data.memberId,
            memberName: data.memberName,
            isHost: data.isHost,
          });
          setLocation(`/e/${token}/dashboard`);
        } else {
          // Not yet an Attendee — show the Join button
          setPhase('not-attendee');
        }
      })
      .catch(() => {
        setErrorMsg('Could not connect. Please try again.');
        setPhase('not-attendee');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, event, personSession, eventSession, eventError]);

  // No global session and event loaded → redirect to login
  useEffect(() => {
    if (!personSession && !eventSession && !eventLoading && (event || eventError)) {
      setLocation(`/login?redirect=${encodeURIComponent(`/e/${token}`)}`);
    }
  }, [personSession, eventSession, event, eventLoading, eventError, token, setLocation]);

  function handleJoin() {
    if (!token || !personSession) return;
    setPhase('joining');
    setErrorMsg(null);

    fetch(`${import.meta.env.BASE_URL}api/directory/events/${token}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-person-id': String(personSession.personId),
      },
      body: JSON.stringify({ confirm: true }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.memberId) {
          setEventSession({
            memberId: data.memberId,
            memberName: data.memberName,
            isHost: data.isHost,
          });
          setLocation(`/e/${token}/dashboard`);
        } else {
          setErrorMsg(data.error ?? 'Could not join this event.');
          setPhase('not-attendee');
        }
      })
      .catch(() => {
        setErrorMsg('Could not connect. Please try again.');
        setPhase('not-attendee');
      });
  }

  if (eventError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="font-display text-3xl text-foreground">Event not found.</h1>
          <p className="text-sm text-muted-foreground">
            This link may have expired or the event was removed.
          </p>
          <Button variant="outline" onClick={() => setLocation('/my-events')}>Back to events</Button>
        </div>
      </div>
    );
  }

  if (phase === 'not-attendee') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="font-display text-3xl text-foreground">{event?.name ?? 'Event'}</h1>
          {errorMsg ? (
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You're not on the guest list yet. Join to view expenses and settlements.
            </p>
          )}
          {!errorMsg && (
            <Button onClick={handleJoin} disabled={phase === 'joining'}>
              Join Event
            </Button>
          )}
          <div>
            <Button variant="outline" onClick={() => setLocation('/my-events')}>Back to events</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm animate-pulse">
        {phase === 'joining' ? 'Joining the event…' : 'A moment…'}
      </p>
    </div>
  );
}
