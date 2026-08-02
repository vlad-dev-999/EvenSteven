import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-background transition-page">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Wordmark */}
        <div className="space-y-3">
          <h1 className="font-display text-5xl text-foreground tracking-tight">
            EvenSteven
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            A shared ledger for evenings among friends.
            <br />
            Record what happened. Settle gracefully.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Actions */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Joining an event? Open the link your host shared.
          </p>
          <Button
            variant="outline"
            className="w-full text-sm"
            onClick={() => setLocation('/host')}
          >
            Host Console
          </Button>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground/60">
          EvenSteven keeps the accounts in order so everyone can leave as friends.
        </p>
      </div>
    </div>
  );
}
