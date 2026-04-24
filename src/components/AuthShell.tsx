import { ReactNode } from "react";
import { Brand } from "./Brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Brand />
        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto py-12">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} VolleyStrength · Bellaria
        </p>
      </div>

      {/* Right: editorial panel */}
      <div className="hidden lg:flex relative bg-foreground text-background overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="text-[11px] uppercase tracking-[0.2em] opacity-60">
            Strength · Performance · Recovery
          </div>
          <div className="space-y-6">
            <p className="text-3xl font-medium leading-tight max-w-md">
              Pianifica, monitora e analizza il lavoro atletico del tuo team —
              <span className="opacity-60"> in un'unica piattaforma.</span>
            </p>
            <div className="grid grid-cols-3 gap-6 max-w-md text-sm">
              <Stat value="100%" label="Schede tracciate" />
              <Stat value="RPE" label="Carico interno" />
              <Stat value="PR" label="Progressi reali" />
            </div>
          </div>
          <div className="text-xs opacity-40 font-mono">v0.1 · Step 1</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-2xl font-semibold">{value}</div>
      <div className="text-xs opacity-60 mt-1">{label}</div>
    </div>
  );
}