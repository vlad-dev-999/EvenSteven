import { useState } from "react";
import { useParams } from "wouter";
import { 
  useListMembers, 
  useListFamilies, 
  useListJoinRequests, 
  useUpdateJoinRequest,
  useRemoveMember
} from "@workspace/api-client-react";
import { useLocalSession } from "@/hooks/use-local-session";
import { TopNav, BottomNav } from "@/components/layout/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserMinus, Check, X, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function MembersPage() {
  const { token } = useParams<{ token: string }>();
  const { session } = useLocalSession(token || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members } = useListMembers(token || "", { query: { enabled: !!token } });
  const { data: families } = useListFamilies(token || "", { query: { enabled: !!token } });
  const { data: joinRequests } = useListJoinRequests(token || "", { 
    query: { enabled: !!token && !!session?.isHost } 
  });

  const updateJoinReq = useUpdateJoinRequest();
  const removeMember = useRemoveMember();

  const handleApprove = (reqId: number) => {
    updateJoinReq.mutate({
      token: token!,
      requestId: reqId,
      data: { status: 'approved' }
    }, {
      onSuccess: () => {
        toast({ title: "Member approved" });
        queryClient.invalidateQueries({ queryKey: ['/api/events', token, 'members'] });
        queryClient.invalidateQueries({ queryKey: ['/api/events', token, 'join-requests'] });
      }
    });
  };

  const handleReject = (reqId: number) => {
    updateJoinReq.mutate({
      token: token!,
      requestId: reqId,
      data: { status: 'rejected' }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/events', token, 'join-requests'] });
      }
    });
  };

  const handleRemoveMember = (memberId: number) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    removeMember.mutate({ token: token!, memberId }, {
      onSuccess: () => {
        toast({ title: "Member removed" });
        queryClient.invalidateQueries({ queryKey: ['/api/events', token, 'members'] });
      }
    });
  };

  const pendingRequests = joinRequests?.filter(r => r.status === 'pending') || [];

  return (
    <div className="min-h-[100dvh] bg-background">
      <TopNav title="Members" token={token!} />

      <main className="px-4 py-6 space-y-8">
        
        {session?.isHost && pendingRequests.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Pending Requests
            </h2>
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <Card key={req.id} className="p-4 flex items-center justify-between border-primary/20 bg-primary/5">
                  <span className="font-medium">{req.name}</span>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => handleReject(req.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="icon" onClick={() => handleApprove(req.id)} className="h-8 w-8 bg-success hover:bg-success/90">
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">All Members</h2>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {members?.map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-medium">
                    {m.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {m.name}
                      {m.isHost && <span className="text-[10px] uppercase bg-primary/20 text-primary px-2 py-0.5 rounded-full">Host</span>}
                    </p>
                    {m.familyName && <p className="text-xs text-muted-foreground">{m.familyName}</p>}
                  </div>
                </div>
                {session?.isHost && !m.isHost && (
                  <button 
                    onClick={() => handleRemoveMember(m.id)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

      </main>

      <BottomNav token={token!} />
    </div>
  );
}
