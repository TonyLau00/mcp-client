/**
 * Badge component for labels and tags.
 */
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === "default" &&
          "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
        variant === "secondary" &&
          "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
        variant === "success" &&
          "bg-green-500/20 text-green-500",
        variant === "warning" &&
          "bg-yellow-500/20 text-yellow-500",
        variant === "destructive" &&
          "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
        variant === "outline" &&
          "border border-current bg-transparent",
        className
      )}
      {...props}
    />
  );
}
