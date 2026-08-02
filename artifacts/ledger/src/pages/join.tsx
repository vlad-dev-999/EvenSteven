/**
 * Join page — entry point for a shared event link (/e/:token).
 *
 * If the visitor has a global person session:
 *   → call /directory/events/:token/join → store event session → dashboard
 *
 * If no global session:
 *   → redirect to /login?redirect=/e/:token
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
  const [joining, setJoining] = useState(false);
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

  // Global session + event loaded → auto-join
  useEffect(() => {
    if (!token || !event || !personSession || eventSession || joining || eventError) return;

    setJoining(true);
    fetch(`${import.meta.env.BASE_URL}api/directory/events/${token}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-person-id': String(personSession.personId),
      },
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setEventSession({
            memberId: data.memberId,
            memberName: data.memberName,
            isHost: data.isHost,
          });
          setLocation(`/e/${token}/dashboard`);
        } else if (res.status === 403 && data.error === 'not_activated') {
          setLocation(`/activate?personId=${personSession.personId}&name=${encodeURIComponent(personSession.personName)}&houseId=${personSession.houseId}&redirect=${encodeURIComponent(`/e/${token}`)}`);
        } else {
          setErrorMsg(data.error ?? 'Could not join this event.');
          setJoining(false);
        }
      })
      .catch(() => {
        setErrorMsg('Could not connect. Please try again.');
        setJoining(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, event, personSession, eventSession, eventError]);

  // No global session and event loaded → redirect to login
  useEffect(() => {
    if (!personSession && !eventSession && !eventLoading && (event || eventError)) {
      setLocation(`/login?redirect=${encodeURIComponent(`/e/${token}`)}`);
    }
  }, [personSession, eventSession, event, eventLoading, eventError, token, setLocation]);

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

  if (errorMsg) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="font-display text-3xl text-foreground">Couldn't join.</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" onClick={() => setLocation('/my-events')}>Back to events</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm animate-pulse">
        {joining ? 'Joining the event…' : 'A moment…'}
      </p>
    </div>
  );
}
