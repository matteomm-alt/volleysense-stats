import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  ChevronLeft,
  Users,
  Copy,
  Check,
  Trash2,
  UserPlus,
  Calendar,
  CalendarRange,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Team = Tables<"teams">;
type Member = Tables<"team_members"> & {
  profile?: { full_name: string | null; avatar_url: string | null };
};

export const Route = createFileRoute("/coach/team/$teamId")({
  component: TeamDetailPage,
});

function TeamDetailPage() {
  const { teamId } = Route.useParams();
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role === "atleta") navigate({ to: "/atleta" });
  }, [loading, session, profile, role, navigate]);

  const fetchData = async () => {
    setLoadingData(true);
    const [{ data: t, error: tErr }, { data: m, error: mErr }] = await Promise.all([
      supabase.from("teams").select("*").eq("id", teamId).maybeSingle(),
      supabase
        .from("team_members")
        .select("*")
        .eq("team_id", teamId)
        .order("joined_at", { ascending: true }),
    ]);
    if (tErr || mErr) {
      toast.error((tErr || mErr)!.message);
      setLoadingData(false);
      return;
    }
    setTeam(t);

    // Fetch profiles separately (no FK in types between team_members and profiles)
    const ids = (m ?? []).map((mm) => mm.athlete_id);
    let profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      (profs ?? []).forEach((p) =>
        profilesMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url }),
      );
    }

    setMembers(
      (m ?? []).map((mm) => ({
        ...mm,
        profile: profilesMap.get(mm.athlete_id),
      })),
    );
    setLoadingData(false);
  };

  useEffect(() => {
    if (session?.user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, teamId]);

  const removeMember = async (athleteId: string) => {
    if (!confirm("Rimuovere l'atleta dalla squadra?")) return;
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("athlete_id", athleteId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Atleta rimosso");
    fetchData();
  };

  if (loading || loadingData || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader name={profile.full_name ?? "Coach"} role={role} onSignOut={signOut} />
        <main className="flex-1 grid place-items-center px-6">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold">Squadra non trovata</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              La squadra non esiste o non hai i permessi per visualizzarla.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/coach">
                <ChevronLeft className="h-4 w-4" /> Torna alle squadre
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader name={profile.full_name ?? "Coach"} role={role} onSignOut={signOut} />
      <main className="flex-1 container mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/coach"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Squadre
        </Link>

        <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{team.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
              {team.category && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {team.category}
                </span>
              )}
              {team.season && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {team.season}
                </span>
              )}
            </div>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Invita atleti
          </Button>
        </div>

        {team.description && (
          <p className="mt-4 text-sm text-muted-foreground max-w-2xl">{team.description}</p>
        )}

        {/* Strumenti squadra */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Gestione
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <a href={`/coach/team/${teamId}/periodi`}>
              <div className="rounded-lg border bg-card p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <CalendarRange className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Periodi & Schede</div>
                    <div className="text-xs text-muted-foreground">Mesocicli e schede settimanali</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </a>
            <div className="rounded-lg border bg-card p-4 flex items-center justify-between opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Presenze</div>
                  <div className="text-xs text-muted-foreground">Registro sessioni e appello</div>
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border rounded px-1.5 py-0.5">
                Presto
              </span>
            </div>
          </div>
        </section>

        {/* Roster */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Roster · <span className="font-mono">{members.length}</span>
            </h2>
          </div>

          {members.length === 0 ? (
            <EmptyRoster code={team.invite_code} onInvite={() => setInviteOpen(true)} />
          ) : (
            <div className="mt-4 rounded-lg border bg-card divide-y">
              {members.map((m) => (
                <MemberRow key={m.id} member={m} onRemove={() => removeMember(m.athlete_id)} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <InviteDialog code={team.invite_code} teamName={team.name} />
      </Dialog>
    </div>
  );
}

function MemberRow({
  member,
  onRemove,
}: {
  member: Member;
  onRemove: () => void;
}) {
  const name = member.profile?.full_name || "Atleta senza nome";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-medium">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate">{name}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {member.position && <span>{member.position}</span>}
            {member.jersey_number != null && (
              <Badge variant="outline" className="font-mono text-[10px]">
                #{member.jersey_number}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EmptyRoster({ code, onInvite }: { code: string; onInvite: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-12 text-center">
      <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
        <UserPlus className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-semibold">Nessun atleta</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
        Condividi il codice <span className="font-mono font-semibold">{code}</span> con i tuoi
        atleti per farli entrare nella squadra.
      </p>
      <Button className="mt-5" onClick={onInvite}>
        <UserPlus className="h-4 w-4" /> Mostra codice invito
      </Button>
    </div>
  );
}

function InviteDialog({ code, teamName }: { code: string; teamName: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Codice copiato");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Invita atleti in “{teamName}”</DialogTitle>
        <DialogDescription>
          Condividi questo codice con gli atleti. Dopo aver creato l'account, potranno
          inserirlo nella loro home per unirsi alla squadra.
        </DialogDescription>
      </DialogHeader>
      <div className="rounded-lg border bg-muted/30 p-6 text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Codice invito
        </div>
        <div className="mt-2 font-mono text-3xl font-semibold tracking-widest">{code}</div>
        <Button variant="outline" className="mt-4" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiato" : "Copia codice"}
        </Button>
      </div>
    </DialogContent>
  );
}
