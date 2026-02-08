/**
 * Reusable Button component.
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
          "disabled:pointer-events-none disabled:opacity-50",
          // Variants
          variant === "default" &&
            "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.9)]",
          variant === "secondary" &&
            "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary)/0.8)]",
          variant === "outline" &&
            "border border-[hsl(var(--input))] bg-transparent hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
          variant === "ghost" &&
            "hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
          variant === "destructive" &&
            "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:bg-[hsl(var(--destructive)/0.9)]",
          // Sizes
          size === "sm" && "h-8 px-3 text-sm",
          size === "md" && "h-10 px-4 text-sm",
          size === "lg" && "h-12 px-6 text-base",
          size === "icon" && "h-10 w-10",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
