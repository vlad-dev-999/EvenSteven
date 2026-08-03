import { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import {
  useGetEvent,
  useGetBalances,
  useListExpenses,
  useListActivity,
  useGetSettlements,
} from '@workspace/api-client-react';
import { useLocalSession } from '@/hooks/use-local-session';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Share2, Link2, MapPin, FileText, BarChart2, QrCode, ArrowLeft } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  tickets: '🎟', food: '🍽', drinks: '🥂', snacks: '🍿', fuel: '⛽', other: '📦',
};

const ACTION_HEADLINES: Record<string, (meta: any) => string> = {
  event_created: (m) => `${m.hostName ?? 'The host'} started the evening.`,
  expense_added: (m) => `${m.paidByName ?? 'Someone'} covered the ${m.category ?? 'expense'}.`,
  expense_updated: () => 'An expense was updated.',
  expense_edited: () => 'An expense was updated.',
  expense_deleted: () => 'An expense was removed.',
  member_removed: (m) => `${m.memberName ?? 'A member'} left the event.`,
  member_joined: (m) => `${m.name ?? 'Someone'} joined the party.`,
  member_approved: (m) => `${m.name ?? 'Someone'} joined the party.`,
  event_frozen: () => 'The evening is closed.',
  event_unfrozen: () => 'The evening was reopened.',
  join_request_approved: (m) => `${m.name ?? 'Someone'} joined the party.`,
};

const ACTION_CAPTIONS: Record<string, (meta: any) => string> = {
  expense_added: (m) => [
    m.category && `${m.category.charAt(0).toUpperCase() + m.category.slice(1)}`,
    m.amount && formatCurrency(m.amount),
    m.splitType && `Split ${m.splitType}`,
  ].filter(Boolean).join(' · '),
  expense_edited: (m) => `Amount: ${m.newAmount ? formatCurrency(m.newAmount) : '—'}`,
  event_created: (m) => `Event "${m.eventName}" created.`,
};

// ─── Share Sheet ───────────────────────────────────────────────────────────────
interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  event: any;
  expenses: any[];
  settlements: any[];
  balancesData: any;
  token: string;
}

function ShareSheet({ open, onClose, event, expenses, settlements, balancesData, token }: ShareSheetProps) {
  const [qrOpen, setQrOpen] = useState(false);

  const eventUrl = `${window.location.origin}${import.meta.env.BASE_URL}e/${token}`;
  const eventName = event?.name ?? 'Event';

  const canNativeShare = typeof navigator.share === 'function';

  const share = async (text: string, url?: string, title?: string) => {
    if (canNativeShare) {
      try {
        await navigator.share({ title: title ?? eventName, text, url });
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }
    const content = url ? `${text}\n${url}` : text;
    await navigator.clipboard.writeText(content);
  };

  const buildAnnouncement = () => {
    const parts = [`📢 ${eventName} is happening!`];
    if (event?.venue) parts.push(`📍 ${event.venue}`);
    if (event?.address) parts.push(event.address);
    if (event?.startDate) {
      const d = new Date(event.startDate);
      parts.push(`📅 ${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`);
    }
    if (event?.description) parts.push(`\n${event.description}`);
    parts.push(`\n🔗 ${eventUrl}`);
    return parts.join('\n');
  };

  const buildExpenseDetails = () => {
    const total = expenses.reduce((s: number, e: any) => s + e.amount, 0);
    const lines = [`💸 Expense breakdown for ${eventName}`, `Total: ${formatCurrency(total)}`, ''];
    expenses.forEach((e: any) => {
      lines.push(`${CATEGORY_LABELS[e.category] ?? '📦'} ${e.description ?? e.category} — ${formatCurrency(e.amount)} (paid by ${e.paidByMemberName})`);
    });
    return lines.join('\n');
  };

  const buildSettlementSummary = () => {
    if (settlements.length === 0) return `✅ ${eventName}: Everyone is settled up!`;
    const lines = [`💰 Settlement plan for ${eventName}`, ''];
    settlements.forEach((s: any) => {
      lines.push(`${s.fromMemberName} → ${s.toMemberName}: ${formatCurrency(s.amount)}`);
    });
    return lines.join('\n');
  };

  const buildEventDetails = () => {
    const lines = [`📋 ${eventName}`];
    if (event?.description) lines.push(`\n${event.description}`);
    if (event?.venue) lines.push(`\n📍 Venue: ${event.venue}`);
    if (event?.address) lines.push(`📌 ${event.address}`);
    if (event?.startDate) {
      const d = new Date(event.startDate);
      lines.push(`📅 ${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
    }
    if (event?.endDate) {
      const d = new Date(event.endDate);
      lines.push(`🏁 Ends: ${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`);
    }
    if (event?.itinerary) lines.push(`\n📝 Itinerary:\n${event.itinerary}`);
    lines.push(`\n🔗 ${eventUrl}`);
    return lines.join('\n');
  };

  const buildEventSummary = () => {
    const totalExpenses = balancesData?.totalExpenses ?? 0;
    const memberCount = balancesData?.memberBalances?.length ?? 0;
    const perPerson = memberCount > 0 ? Math.round(totalExpenses / memberCount) : 0;
    const lines = [
      `📊 ${eventName} — Summary`,
      '',
      `Total spent: ${formatCurrency(totalExpenses)}`,
      `Members: ${memberCount}`,
      `Per person avg: ${formatCurrency(perPerson)}`,
      `Settlements needed: ${settlements.length}`,
    ];
    return lines.join('\n');
  };

  const SHARE_OPTIONS = [
    {
      icon: '📢',
      label: 'Announcement',
      description: 'Share event details publicly',
      action: () => share(buildAnnouncement()),
    },
    {
      icon: '🎟',
      label: 'Invite to Event',
      description: 'Send the event join link',
      action: () => share(`You're invited to ${eventName}!\nJoin the group tab and track expenses together.`, eventUrl, `Join ${eventName}`),
    },
    {
      icon: <Link2 size={16} />,
      label: 'Event Link',
      description: 'Copy or share the URL',
      action: () => share(eventUrl),
    },
    ...(event?.mapsLink ? [{
      icon: <MapPin size={16} />,
      label: 'Event Location',
      description: 'Share on Google Maps',
      action: () => share(`📍 ${eventName} is at ${event.venue ?? 'our venue'}`, event.mapsLink),
    }] : []),
    ...(event?.venue || event?.itinerary ? [{
      icon: <FileText size={16} />,
      label: 'Event Details & Itinerary',
      description: 'Venue, dates, and schedule',
      action: () => share(buildEventDetails()),
    }] : []),
    {
      icon: '💸',
      label: 'Expense Details',
      description: `${expenses.length} expenses · ${formatCurrency(expenses.reduce((s: number, e: any) => s + e.amount, 0))} total`,
      action: () => share(buildExpenseDetails()),
    },
    {
      icon: '💰',
      label: 'Settlement Summary',
      description: `${settlements.length} transfers to settle up`,
      action: () => share(buildSettlementSummary()),
    },
    {
      icon: <BarChart2 size={16} />,
      label: 'Event Summary',
      description: 'Totals and averages',
      action: () => share(buildEventSummary()),
    },
    {
      icon: <QrCode size={16} />,
      label: 'Event QR Code',
      description: 'Scan to join the event',
      action: () => setQrOpen(true),
    },
  ];

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&bgcolor=ffffff&data=${encodeURIComponent(eventUrl)}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">Share</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 pt-1">
            {SHARE_OPTIONS.map((opt, i) => (
              <button
                key={i}
                onClick={async () => { await opt.action(); }}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm shrink-0">
                  {typeof opt.icon === 'string' ? opt.icon : opt.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal text-center">
              {eventName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <img
              src={qrUrl}
              alt="Event QR code"
              className="w-48 h-48 rounded-lg border border-border"
            />
            <p className="text-xs text-muted-foreground text-center">
              Scan to join {eventName}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => share(eventUrl)}
              className="w-full"
            >
              Share link instead
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Banner Hero ───────────────────────────────────────────────────────────────
function EventBanner({ event }: { event: any }) {
  if (!event?.bannerImage) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ height: '200px' }}>
      <img
        src={event.bannerImage}
        alt={event.name}
        className="w-full h-full object-cover"
      />
      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)' }}
      />
      {/* Text overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        <h2 className="font-display text-2xl text-white leading-tight drop-shadow">{event.name}</h2>
        {event.hostMemberName && (
          <p className="text-sm text-white/80 drop-shadow">Hosted by {event.hostMemberName}</p>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session } = useLocalSession(token ?? '');
  const [shareOpen, setShareOpen] = useState(false);

  const { data: event, isLoading: eventLoading } = useGetEvent(token ?? '', {
    query: { enabled: !!token } as any,
  });

  const { data: balancesData } = useGetBalances(token ?? '', {
    query: { enabled: !!token && !!session } as any,
  });

  const { data: expenses = [] } = useListExpenses(token ?? '', {
    query: { enabled: !!token } as any,
  });

  const { data: activity = [] } = useListActivity(token ?? '', {
    query: { enabled: !!token } as any,
  });

  const { data: settlements = [] } = useGetSettlements(token ?? '', {
    query: { enabled: !!token } as any,
  });

  useEffect(() => {
    if (!session && !eventLoading && event) {
      setLocation(`/e/${token}`);
    }
  }, [session, event, eventLoading, token, setLocation]);

  if (!session || eventLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm animate-pulse">A moment…</p>
      </div>
    );
  }

  const ev = event as any;
  const myBalance = balancesData?.memberBalances.find(b => b.memberId === session.memberId);
  const netBalance = myBalance?.netBalance ?? 0;
  const recentExpenses = expenses.slice(-5).reverse();
  const recentActivity = activity.slice(-10).reverse();
  const hasBanner = !!ev?.bannerImage;

  return (
    <div className="min-h-dvh bg-background transition-page">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="min-w-0">
            <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground uppercase tracking-widest font-medium hover:text-foreground transition-colors">
              <ArrowLeft size={11} strokeWidth={2.5} /><span>Back to Deck</span>
            </Link>
            <h1 className="font-display text-xl text-foreground truncate">{event?.name ?? '…'}</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShareOpen(true)}
              className="p-2 rounded-md hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
              title="Share"
            >
              <Share2 size={17} />
            </button>
            <Link href={`/e/${token}/settings`}>
              <Button size="sm" variant="ghost" className="text-xs">
                {session.memberName}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Frozen banner */}
        {ev?.frozen && (
          <div className="rounded-xl border border-border bg-muted/40 px-5 py-4 text-center space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Event Closed</p>
            <p className="font-display text-lg text-foreground leading-snug">
              This evening now exists only in priceless memories and echoes of past laughter.
            </p>
          </div>
        )}

        {/* Banner hero — shown when bannerImage is set */}
        {hasBanner && <EventBanner event={ev} />}

        {/* Below-banner identity strip — always shown when banner present */}
        {hasBanner && (
          <div className="space-y-0.5">
            <h2 className="font-display text-2xl text-foreground">{ev.name}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              {ev.hostMemberName && <span>Hosted by {ev.hostMemberName}</span>}
              {ev.startDate && (
                <span>
                  {new Date(ev.startDate).toLocaleDateString('en-IN', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Event description — shown beneath title/banner if set */}
        {ev?.description && (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {ev.description}
          </p>
        )}

        {/* Balance card */}
        <div className={cn(
          'rounded-xl border bg-card p-5 space-y-1',
          netBalance > 0 ? 'border-l-4 border-l-green-600 border-border' :
          netBalance < 0 ? 'border-l-4 border-l-amber-600 border-border' :
          'border-border'
        )}>
          {netBalance === 0 ? (
            <>
              <p className="font-display text-3xl text-foreground">You're even.</p>
              <p className="text-sm text-muted-foreground">No balance to settle.</p>
            </>
          ) : netBalance > 0 ? (
            <>
              <p className="font-display text-3xl text-green-700">You're owed {formatCurrency(netBalance)}.</p>
              <p className="text-sm text-muted-foreground">Others will settle with you.</p>
            </>
          ) : (
            <>
              <p className="font-display text-3xl text-amber-700">You owe {formatCurrency(Math.abs(netBalance))}.</p>
              <p className="text-sm text-muted-foreground">
                <Link href={`/e/${token}/settlements`} className="underline underline-offset-2 hover:text-foreground transition-colors">
                  See settlement plan →
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Expenses', href: `/e/${token}/expenses`, count: expenses.length },
            { label: 'Settle', href: `/e/${token}/settlements` },
            { label: 'Members', href: `/e/${token}/members` },
          ].map(item => (
            <Link key={item.label} href={item.href}>
              <button className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors text-center">
                {item.label}
                {item.count !== undefined && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{item.count}</span>
                )}
              </button>
            </Link>
          ))}
        </div>

        {/* Event details strip — venue/date (only when no banner, to avoid redundancy) */}
        {!hasBanner && (ev?.venue || ev?.startDate) && (
          <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-1 text-sm">
            {ev?.venue && (
              <p className="text-muted-foreground flex items-center gap-2">
                <span>📍</span> {ev.venue}
                {ev?.mapsLink && (
                  <a href={ev.mapsLink} target="_blank" rel="noopener noreferrer"
                    className="text-accent underline underline-offset-2 ml-auto text-xs">Map</a>
                )}
              </p>
            )}
            {ev?.startDate && (
              <p className="text-muted-foreground flex items-center gap-2">
                <span>📅</span>
                {new Date(ev.startDate).toLocaleDateString('en-IN', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })}
              </p>
            )}
          </div>
        )}

        {/* Recent expenses */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Recent Expenses
            </h2>
            {expenses.length > 5 && (
              <Link href={`/e/${token}/expenses`}>
                <span className="text-xs text-accent hover:underline">All {expenses.length}</span>
              </Link>
            )}
          </div>
          {recentExpenses.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center space-y-1.5">
              <p className="font-display text-xl text-foreground">The evening is still financially innocent.</p>
              <p className="text-xs text-muted-foreground">No expenses have been recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentExpenses.map(expense => (
                <div key={expense.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
                  <span className="text-lg w-7 text-center">{CATEGORY_LABELS[expense.category] ?? '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {expense.description ?? expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">Paid by {expense.paidByMemberName}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Timeline */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Timeline</h2>
          {recentActivity.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center space-y-1.5">
              <p className="font-display text-xl text-foreground">Quiet so far.</p>
              <p className="text-xs text-muted-foreground">Activity will appear here as the evening unfolds.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map(entry => {
                const headline = ACTION_HEADLINES[entry.action]?.(entry.metadata ?? {}) ?? entry.action;
                const caption = ACTION_CAPTIONS[entry.action]?.(entry.metadata ?? {});
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="mt-[7px] w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    <div className="flex-1 space-y-0.5">
                      <p className="text-sm text-foreground leading-snug">{headline}</p>
                      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
                      <p className="text-xs text-muted-foreground/60">{formatDate(entry.createdAt.toString())}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* FABs */}
      <div className="fixed bottom-6 right-6 z-20 flex flex-col items-end gap-3">
        {!event?.frozen && (
          <Link href={`/e/${token}/add-expense`}>
            <button className="h-14 px-5 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-lg hover:shadow-xl hover:opacity-90 transition-all flex items-center gap-2">
              <span className="text-lg leading-none">+</span>
              Add Expense
            </button>
          </Link>
        )}
      </div>

      {/* Share sheet */}
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        event={event}
        expenses={expenses}
        settlements={settlements as any[]}
        balancesData={balancesData}
        token={token ?? ''}
      />
    </div>
  );
}
