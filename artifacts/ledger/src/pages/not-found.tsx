import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-4xl text-foreground">
            Nothing here.
          </h1>
          <p className="text-muted-foreground text-sm">
            This page doesn't exist. Perhaps the link has expired,
            or you've taken a wrong turn.
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocation('/')}>
          Back to start
        </Button>
      </div>
    </div>
  );
}
