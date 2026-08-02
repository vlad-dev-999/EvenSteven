import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { useHostAuth } from '@workspace/api-client-react';
import { useHostSession } from '@/hooks/use-host-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function StewardsLoginPage() {
  const [, setLocation] = useLocation();
  const { token, setToken } = useHostSession();
  const [password, setPassword] = useState('');

  const authMutation = useHostAuth();

  // If already authenticated, go to the desk
  useEffect(() => {
    if (token) {
      setLocation('/host/console');
    }
  }, [token, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    authMutation.mutate({ data: { password } }, {
      onSuccess: (result) => {
        setToken(result.token);
        setLocation('/host/console');
      },
      onError: () => {
        toast.error('Incorrect password.');
        setPassword('');
      },
    });
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-background transition-page">
      <div className="max-w-sm w-full space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            EvenSteven
          </p>
          <h1 className="font-display text-4xl text-foreground">
            The Steward's Desk
          </h1>
          <p className="text-sm text-muted-foreground">
            Directory, houses, and events — for the administrator.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter administrator password"
              autoFocus
              required
              className="bg-card border-border"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={authMutation.isPending || !password}
          >
            {authMutation.isPending ? 'Verifying…' : 'Enter'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground/50 text-center">
          Members log in through the regular flow.
        </p>
      </div>
    </div>
  );
}
