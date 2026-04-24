import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronRight, Whistle, Dumbbell, Check } from "lucide-react";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

type Role = Enums<"app_role">;

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { session, loading, profile, role: existingRole, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (profile?.onboarded && existingRole) {
      navigate({ to: "/" });
      return;
    }
    if (profile?.full_name) setFullName(profile.full_name);
    if (profile?.phone) setPhone(profile.phone);
    if (profile?.birth_date) setBirthDate(profile.birth_date);
    if (existingRole) setRole(existingRole);
  }, [loading, session, profile, existingRole, navigate]);

  const handleSelectRole = (r: Role) => {
    setRole(r);
    setStep(2);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user || !role) return;
    setSubmitting(true);

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null,
        birth_date: birthDate || null,
        onboarded: true,
      })
      .eq("id", session.user.id);

    if (profileErr) {
      setSubmitting(false);
      toast.error("Errore salvataggio profilo: " + profileErr.message);
      return;
    }

    if (!existingRole) {
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: session.user.id, role });
      if (roleErr) {
        setSubmitting(false);
        toast.error("Errore assegnazione ruolo: " + roleErr.message);
        return;
      }
    }

    await refresh();
    setSubmitting(false);
    toast.success("Profilo completato");
    navigate({ to: "/" });
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Brand />
          <span className="text-xs font-mono text-muted-foreground">
            STEP {step}/2
          </span>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-3xl px-6 py-12">
        {step === 1 ? (
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Come usi VolleyStrength?
            </h1>
            <p className="mt-2 text-muted-foreground">
              Scegli il ruolo. Potrai cambiarlo solo contattando l'amministratore.
            </p>

            <div className="mt-10 grid sm:grid-cols-2 gap-4">
              <RoleCard
                icon={<Whistle className="h-6 w-6" />}
                title="Sono un Coach"
                description="Pianifico schede, gestisco team, monitoro carichi e infortuni delle atlete."
                features={[
                  "Crea periodi e schede",
                  "Gestisci team e atleti",
                  "Analisi storico e progressi",
                ]}
                selected={role === "coach"}
                onClick={() => handleSelectRole("coach")}
              />
              <RoleCard
                icon={<Dumbbell className="h-6 w-6" />}
                title="Sono un'Atleta"
                description="Eseguo le schede assegnate, registro le sedute, vedo i miei progressi."
                features={[
                  "Visualizza schede del giorno",
                  "Registra carichi e RPE",
                  "Grafici dei tuoi PR",
                ]}
                selected={role === "atleta"}
                onClick={() => handleSelectRole("atleta")}
              />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-md">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              ← Cambia ruolo
            </button>
            <h1 className="text-3xl font-semibold tracking-tight">
              I tuoi dati
            </h1>
            <p className="mt-2 text-muted-foreground">
              Servono per identificarti nelle schede e nei team.
            </p>

            <div className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Nome e cognome *</Label>
                <Input
                  id="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Es. Giulia Bianchi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono (opzionale)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+39 333 1234567"
                />
                <p className="text-xs text-muted-foreground">
                  Usato per condividere schede via WhatsApp.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth">Data di nascita (opzionale)</Label>
                <Input
                  id="birth"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Completa setup
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  description,
  features,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-sm ${
        selected ? "border-primary ring-2 ring-primary/20" : ""
      }`}
    >
      <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-foreground">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}