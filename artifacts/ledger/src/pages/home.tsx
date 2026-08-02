import { useCreateEvent, useGetEvent } from "@workspace/api-client-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Home, ArrowRight, Activity } from "lucide-react";

export default function HomePage() {
  const [, setLocation] = useLocation();
  const createEvent = useCreateEvent();

  const [eventName, setEventName] = useState("");
  const [hostName, setHostName] = useState("");
  const [joinToken, setJoinToken] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !hostName.trim()) return;

    createEvent.mutate(
      { data: { name: eventName, hostName: hostName } },
      {
        onSuccess: (data) => {
          // data is EventCreated
          // Save session
          const session = { memberId: data.hostMember.id, memberName: data.hostMember.name, isHost: true };
          localStorage.setItem(`ledger_member_${data.event.token}`, JSON.stringify(session));
          
          // Optionally, show PIN somewhere, but for now we redirect to dashboard
          // The PIN is important for hosts if they log out, but we auto-login here.
          alert(`Event created! Your host PIN is ${data.pin}. Keep this safe!`);
          
          setLocation(`/e/${data.event.token}/dashboard`);
        },
      }
    );
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    let token = joinToken.trim();
    if (!token) return;
    
    // Check if it's a full URL
    try {
      const url = new URL(token);
      const match = url.pathname.match(/\/e\/([a-zA-Z0-9_-]+)/);
      if (match) {
        token = match[1];
      }
    } catch {
      // Not a URL, use as token directly
    }

    setLocation(`/e/${token}`);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Ledger</h1>
          <p className="text-muted-foreground">Settle expenses simply, without the math.</p>
        </div>

        <div className="space-y-6">
          <Card className="p-5 space-y-4 border-white/5 bg-white/5">
            <div>
              <h2 className="text-lg font-semibold">Create an Event</h2>
              <p className="text-sm text-muted-foreground">Start a new group ledger.</p>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="eventName">Event Name</Label>
                <Input 
                  id="eventName" 
                  placeholder="Goa Trip 2024" 
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hostName">Your Name</Label>
                <Input 
                  id="hostName" 
                  placeholder="Raj" 
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  required 
                />
              </div>
              <Button type="submit" className="w-full" disabled={createEvent.isPending}>
                {createEvent.isPending ? "Creating..." : "Create Event"}
              </Button>
            </form>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Card className="p-5 space-y-4 border-white/5 bg-white/5">
            <div>
              <h2 className="text-lg font-semibold">Join an Event</h2>
              <p className="text-sm text-muted-foreground">Enter an event code or link.</p>
            </div>
            <form onSubmit={handleJoin} className="space-y-3">
              <div className="space-y-1">
                <Input 
                  id="joinToken" 
                  placeholder="Event Code or URL" 
                  value={joinToken}
                  onChange={(e) => setJoinToken(e.target.value)}
                  required 
                />
              </div>
              <Button type="submit" variant="secondary" className="w-full">
                Join <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
