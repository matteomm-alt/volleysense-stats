import { Brand } from "./Brand";
import { Button } from "./ui/button";
import { LogOut, User as UserIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function AppHeader({
  name,
  role,
  onSignOut,
  maxWidth = "max-w-6xl",
}: {
  name: string;
  role: string | null;
  onSignOut: () => void;
  maxWidth?: string;
}) {
  return (
    <header className="border-b bg-card">
      <div className={`container mx-auto ${maxWidth} px-6 h-14 flex items-center justify-between`}>
        <Link to="/">
          <Brand />
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{name}</span>
              {role && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {role}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </div>
      </div>
    </header>
  );
}