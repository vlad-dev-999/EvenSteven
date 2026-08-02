import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { 
  useGetEvent, 
  useListMembers, 
  useSetSession,
  useCreateJoinRequest
} from "@workspace/api-client-react";
import { useLocalSession } from "@/hooks/use-local-session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { session, setSession } = useLocalSession(token || "");
  const { toast } = useToast();

  const { data: event, isLoading: eventLoading, error: eventError } = useGetEvent(token || "", {
    query: {
      enabled: !!token,
      retry: false
    }
  });

  const { data: members, isLoading: membersLoading } = useListMembers(token || "", {
    query: {
      enabled: !!token && !!event
    }
  });

  const setSessionMutation = useSetSession();
  const createJoinRequest = useCreateJoinRequest();

  // Redirect if already logged in for this event
  useEffect(() => {
    if (session && event) {
      setLocation(`/e/${token}/dashboard`);
    }
  }, [session, event, token, setLocation]);

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [pin, setPin] = useState("");
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);

  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");

  if (eventError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Event Not Found</h1>
          <p className="text-muted-foreground">This link might be invalid or the event was deleted.</p>
          <Button onClick={() => setLocation("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  if (eventLoading || session) {
    return <div className="flex min-h-[100dvh] items-center justify-center">Loading...</div>;
  }

  const handleMemberClick = (member: any) => {
    if (member.isHost) {
      setSelectedMember(member);
      setIsPinDialogOpen(true);
    } else {
      // Non-host members can just set session directly, pass empty pin
      authenticateMember(member.id, "");
    }
  };

  const authenticateMember = (memberId: number, memberPin: string) => {
    setSessionMutation.mutate({
      token: token as string,
      data: { memberId, pin: memberPin }
    }, {
      onSuccess: (memberData) => {
        setSession({
          memberId: memberData.id,
          memberName: memberData.name,
          isHost: memberData.isHost
        });
        setLocation(`/e/${token}/dashboard`);
      },
      onError: () => {
        toast({
          title: "Authentication Failed",
          description: "Incorrect PIN or unable to join.",
          variant: "destructive"
        });
      }
    });
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMember) {
      authenticateMember(selectedMember.id, pin);
    }
  };

  const handleNewJoinRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    createJoinRequest.mutate({
      token: token as string,
      data: { name: newMemberName.trim() }
    }, {
      onSuccess: (res) => {
        if (res.type === 'existing_member' && res.member) {
          // If the API recognized the name, log them in (if not host, otherwise require PIN)
          if (res.member.isHost) {
             setSelectedMember(res.member);
             setIsJoinDialogOpen(false);
             setIsPinDialogOpen(true);
          } else {
             authenticateMember(res.member.id, "");
          }
        } else {
          toast({
            title: "Request Sent",
            description: "Ask the host to approve your request.",
          });
          setIsJoinDialogOpen(false);
          setNewMemberName("");
        }
      },
      onError: () => {
        toast({
          title: "Request Failed",
          description: "Could not send join request.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background p-6">
      <div className="flex-1 w-full max-w-md mx-auto space-y-8 py-12">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{event?.name}</h1>
          <p className="text-muted-foreground text-lg">Who are you?</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {members?.map(member => (
            <Card 
              key={member.id}
              className="flex flex-col items-center justify-center p-6 gap-3 cursor-pointer hover:bg-muted/50 transition-colors active:scale-95"
              onClick={() => handleMemberClick(member)}
            >
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl bg-secondary text-secondary-foreground">
                  {member.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-center line-clamp-1">{member.name}</span>
            </Card>
          ))}

          <Card 
            className="flex flex-col items-center justify-center p-6 gap-3 cursor-pointer border-dashed bg-transparent hover:bg-muted/20 transition-colors active:scale-95"
            onClick={() => setIsJoinDialogOpen(true)}
          >
            <div className="h-16 w-16 rounded-full border-2 border-dashed flex items-center justify-center text-muted-foreground">
              <Plus className="h-8 w-8" />
            </div>
            <span className="font-medium text-center text-muted-foreground">New Member</span>
          </Card>
        </div>
      </div>

      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Host Authentication</DialogTitle>
            <DialogDescription>
              Enter the host PIN for {selectedMember?.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <Input 
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              required
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsPinDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={setSessionMutation.isPending}>
                {setSessionMutation.isPending ? "Verifying..." : "Enter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Event</DialogTitle>
            <DialogDescription>
              Enter your name. The host will need to approve you.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNewJoinRequest} className="space-y-4">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input 
                placeholder="e.g. John Doe"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsJoinDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createJoinRequest.isPending}>
                {createJoinRequest.isPending ? "Sending..." : "Request to Join"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
