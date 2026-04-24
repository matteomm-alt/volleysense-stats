import { Link } from "@tanstack/react-router";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-mono text-sm font-semibold">
        VS
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight">VolleyStrength</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Bellaria
        </span>
      </span>
    </Link>
  );
}