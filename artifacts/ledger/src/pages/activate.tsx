/**
 * Activation page — email OTP + PIN setup for first-time users.
 * Flow: Enter email → OTP sent → Enter OTP → Choose 4-digit PIN → Done
 */
import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { toast } from 'sonner';
import { usePersonSession } from '@/hooks/use-person-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'email' | 'otp' | 'pin' | 'done';

export default function ActivatePage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const personId = parseInt(params.get('personId') ?? '', 10);
  const personName = params.get('name') ?? 'there';
  const redirect = params.get('redirect') ?? '/my-events';

  const { setSession } = usePersonSession();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  if (!personId || isNaN(personId)) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-3">
          <p className="font-display text-2xl">Something's off.</p>
          <p className="text-sm text-muted-foreground">Open the link your administrator shared to get started.</p>
          <Button variant="outline" onClick={() => setLocation('/login')}>Back to login</Button>
        </div>
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/directory/activate/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.devOtp) {
          setDevOtp(data.devOtp);
          toast.info(`Dev mode: your OTP is ${data.devOtp}`, { duration: 30000 });
        }
        setStep('otp');
      } else if (res.status === 409 && data.error === 'already_activated') {
        toast.info('Account already activated. Please log in with your PIN.');
        setLocation(`/login?redirect=${encodeURIComponent(redirect)}`);
      } else {
        toast.error(data.error ?? 'Could not send code. Please try again.');
      }
    } catch {
      toast.error('Could not connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || pin.length !== 4) return;
    if (pin !== pinConfirm) {
      toast.error("PINs don't match. Try again.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/directory/activate/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, otp, pin }),
      });
      const data = await res.json();
      if (res.ok) {
        // Store global session and redirect
        setSession({
          personId: data.personId,
          personName: data.personName,
          houseId: data.houseId,
          houseName: data.houseName,
          houseAccentColor: data.houseAccentColor,
          houseCrest: data.houseCrest,
        });
        setStep('done');
        setTimeout(() => setLocation(redirect), 1200);
      } else if (res.status === 401) {
        toast.error('Incorrect code. Please check and try again.');
        setOtp('');
      } else if (res.status === 400 && data.error?.includes('expired')) {
        toast.error('Code expired. Request a new one.');
        setStep('email');
        setOtp('');
      } else {
        toast.error(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      toast.error('Could not connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4 py-10 transition-page">
      <div className="max-w-sm w-full space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">EvenSteven</p>
          <h1 className="font-display text-4xl text-foreground">
            {step === 'done' ? `You're in, ${personName}.` : `Hello, ${personName}.`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 'email' && 'Enter your email to receive a one-time activation code.'}
            {step === 'otp' && `We sent a 6-digit code to ${email}. Enter it below and choose your PIN.`}
            {step === 'done' && 'Account activated. Taking you to your events…'}
          </p>
        </div>

        {/* Step: Email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Your email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? 'Sending…' : 'Send activation code'}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Your email is used only for activation. It is never used to log in.
            </p>
          </form>
        )}

        {/* Step: OTP + PIN */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="otp">Activation code</Label>
              <Input
                id="otp"
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="· · · · · ·"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
                className="text-center text-xl tracking-[0.4em] font-mono"
              />
              {devOtp && (
                <p className="text-xs text-amber-600 font-mono">
                  Dev mode — code: {devOtp}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin">Choose a 4-digit PIN</Label>
              <Input
                id="pin"
                type="tel"
                inputMode="numeric"
                maxLength={4}
                placeholder="· · · ·"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                className="text-center text-xl tracking-[0.5em] font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin-confirm">Confirm PIN</Label>
              <Input
                id="pin-confirm"
                type="tel"
                inputMode="numeric"
                maxLength={4}
                placeholder="· · · ·"
                value={pinConfirm}
                onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                className="text-center text-xl tracking-[0.5em] font-mono"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || otp.length !== 6 || pin.length !== 4 || pinConfirm.length !== 4}
            >
              {loading ? 'Activating…' : 'Activate account'}
            </Button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setStep('email'); setOtp(''); setDevOtp(null); }}
            >
              Didn't receive a code? Send again.
            </button>
          </form>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="py-6 flex items-center justify-center">
            <span className="text-5xl">🎉</span>
          </div>
        )}
      </div>
    </div>
  );
}
