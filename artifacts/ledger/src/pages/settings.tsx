import { useLocation, useParams } from "wouter";
import { useGetEvent, useFreezeEvent, useUnfreezeEvent } from "@workspace/api-client-react";
import { useLocalSession } from "@/hooks/use-local-session";
import { TopNav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Snowflake, LogOut, CheckCircle } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session, setSession } = useLocalSession(token || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: event } = useGetEvent(token || "");
  const freeze = useFreezeEvent();
  const unfreeze = useUnfreezeEvent();

  const [copied, setCopied] = useState(false);

  if (!event || !session) return null;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/e/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  const handleToggleFreeze = () => {
    if (event.frozen) {
      unfreeze.mutate({ token: token! }, {
        onSuccess: () => {
          toast({ title: "Event unfrozen" });
          queryClient.invalidateQueries({ queryKey: ['/api/events', token] });
        }
      });
    } else {
      freeze.mutate({ token: token! }, {
        onSuccess: () => {
          toast({ title: "Event frozen" });
          queryClient.invalidateQueries({ queryKey: ['/api/events', token] });
        }
      });
    }
  };

  const handleLeave = () => {
    setSession(null);
    setLocation("/");
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <TopNav title="Settings" token={token!} showBack backTo={`/e/${token}/dashboard`} />

      <main className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Share Event</h2>
          <Card className="p-4 bg-card border-border/50">
            <p className="text-sm mb-4 text-muted-foreground">Invite friends by sharing this link.</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-input rounded-xl px-3 flex items-center overflow-hidden">
                <span className="text-sm truncate w-full text-foreground/80">{window.location.origin}/e/{token}</span>
              </div>
              <Button onClick={handleCopyLink} variant="secondary" className="px-4 shrink-0">
                {copied ? <CheckCircle className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </Card>
        </section>

        {session.isHost && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Host Controls</h2>
            <Card className="bg-card border-border/50 divide-y divide-border/50">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">Freeze Event</p>
                  <p className="text-xs text-muted-foreground">Stop new expenses from being added.</p>
                </div>
                <Button 
                  variant={event.frozen ? "secondary" : "destructive"} 
                  onClick={handleToggleFreeze}
                  disabled={freeze.isPending || unfreeze.isPending}
                >
                  <Snowflake className="h-4 w-4 mr-2" />
                  {event.frozen ? "Unfreeze" : "Freeze"}
                </Button>
              </div>
            </Card>
          </section>
        )}

        <section className="pt-8">
          <Button 
            variant="ghost" 
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-14 text-lg"
            onClick={handleLeave}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Leave Event
          </Button>
        </section>
      </main>
    </div>
  );
}
