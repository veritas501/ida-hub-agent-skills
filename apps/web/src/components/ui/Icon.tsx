import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bot, Check, ChevronDown, ChevronUp, CircleAlert, CircleCheck, Copy,
  FileCode2, Key, LayoutDashboard, Lightbulb, LoaderCircle, Lock,
  LogIn, LogOut, Play, Puzzle, RefreshCw, Terminal, TriangleAlert, User, UserPlus,
} from "lucide-react";

const iconMap = {
  terminal: Terminal, dashboard: LayoutDashboard, extension: Puzzle, smart_toy: Bot,
  refresh: RefreshCw, person: User, logout: LogOut, expand_less: ChevronUp,
  expand_more: ChevronDown, play_arrow: Play, hourglass_top: LoaderCircle,
  progress_activity: LoaderCircle, content_copy: Copy, copy_all: Copy, check: Check,
  check_circle: CircleCheck, error: CircleAlert, vpn_key: Key,
  integration_instructions: FileCode2, lightbulb: Lightbulb, warning: TriangleAlert,
  lock: Lock, login: LogIn, how_to_reg: UserPlus,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;
interface IconProps extends Omit<ComponentProps<"svg">, "name"> {
  name: IconName; size?: number; className?: string; spin?: boolean;
  decorative?: boolean; label?: string; strokeWidth?: number;
}
function joinClasses(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}
export function Icon({ name, size = 18, className, spin = false, decorative = true, label, strokeWidth = 2, ...props }: IconProps) {
  const LucideComponent = iconMap[name];
  return (
    <LucideComponent size={size} strokeWidth={strokeWidth} absoluteStrokeWidth
      className={joinClasses("shrink-0", spin && "spin", className)}
      aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"} focusable={false} {...props} />
  );
}
