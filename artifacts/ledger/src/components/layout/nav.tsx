import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, Receipt, ArrowRightLeft, Users, Settings, Activity, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopNavProps {
  title: string;
  token: string;
  showBack?: boolean;
  backTo?: string;
  rightAction?: ReactNode;
}

export function TopNav({ title, token, showBack, backTo, rightAction }: TopNavProps) {
  const [location, setLocation] = useLocation();

  return (
    <div className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => backTo ? setLocation(backTo) : window.history.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      {rightAction && <div>{rightAction}</div>}
    </div>
  );
}

export function BottomNav({ token }: { token: string }) {
  const [location] = useLocation();

  const navItems = [
    { label: "Home", href: `/e/${token}/dashboard`, icon: Home },
    { label: "Expenses", href: `/e/${token}/expenses`, icon: Receipt },
    { label: "Settle", href: `/e/${token}/settlements`, icon: ArrowRightLeft },
    { label: "Members", href: `/e/${token}/members`, icon: Users },
  ];

  return (
    <>
      {/* spacer to prevent content from hiding behind nav */}
      <div className="h-16" />
      <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/50 bg-background/80 backdrop-blur-md pb-safe">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.label === "Expenses" && location.startsWith(`/e/${token}/expenses`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-16 h-full text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
