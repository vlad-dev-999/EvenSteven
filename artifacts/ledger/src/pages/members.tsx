import { useEffect } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import { useGetEvent, useListMembers } from '@workspace/api-client-react';
import { useLocalSession } from '@/hooks/use-local-session';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MembersPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session } = useLocalSession(token ?? '');

  const { data: event } = useGetEvent(token ?? '', { query: { enabled: !!token } as any });
  const { data: members = [], isLoading } = useListMembers(token ?? '', { query: { enabled: !!token } as any });

  useEffect(() => {
    if (!session) setLocation(`/e/${token}`);
  }, [session, token, setLocation]);

  if (!session) return null;

  const approved = members.filter(m => m.approved);

  // Group by house
  const houseMap = new Map<string, typeof members>();
  const noHouse: typeof members = [];
  for (const m of approved) {
    const key = m.houseName ?? '__none__';
    if (key === '__none__') { noHouse.push(m); continue; }
    if (!houseMap.has(key)) houseMap.set(key, []);
    houseMap.get(key)!.push(m);
  }

  return (
    <div className="min-h-dvh bg-background transition-page">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href={`/e/${token}/dashboard`}>
            <button className="p-1 rounded-md hover:bg-muted/40 transition-colors text-muted-foreground">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{event?.name}</p>
            <h1 className="font-display text-xl text-foreground">
              Members <span className="text-muted-foreground font-normal text-base">({approved.length})</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8 animate-pulse">Loading…</p>
        ) : (
          <>
            {Array.from(houseMap.entries()).map(([houseName, hMembers]) => {
              const firstMember = hMembers[0];
              const accentColor = firstMember?.houseAccentColor ?? undefined;
              return (
                <div key={houseName} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
                    {houseName}
                  </p>
                  {hMembers.map(m => (
                    <div
                      key={m.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5',
                        m.id === session?.memberId && 'ring-1 ring-accent'
                      )}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                        style={{ backgroundColor: accentColor ?? 'hsl(var(--primary))' }}
                      >
                        {m.name[0].toUpperCase()}
                      </div>
                      <span className="flex-1 text-sm font-medium text-foreground">{m.name}</span>
                      <div className="flex gap-1.5 items-center">
                        {m.isHost && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">host</span>
                        )}
                        {m.id === session?.memberId && (
                          <span className="text-xs text-accent font-medium">you</span>
                        )}
                        {!m.claimed && (
                          <span className="text-xs text-muted-foreground">not joined</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {noHouse.map(m => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  {m.name[0].toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium text-foreground">{m.name}</span>
                {m.isHost && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">host</span>}
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
