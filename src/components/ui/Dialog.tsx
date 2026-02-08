/**
 * Dialog/Modal component.
 */
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./Button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Dialog */}
      <div
        className={cn(
          "relative z-50 max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg",
          "bg-[hsl(var(--card))] p-6 shadow-lg",
          "animate-in fade-in-0 zoom-in-95",
          className
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        {children}
      </div>
    </div>
  );
}

interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn("mb-4 space-y-2", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className }: DialogHeaderProps) {
  return (
    <h2 className={cn("text-lg font-semibold", className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children, className }: DialogHeaderProps) {
  return (
    <p className={cn("text-sm text-[hsl(var(--muted-foreground))]", className)}>
      {children}
    </p>
  );
}

export function DialogFooter({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn("mt-6 flex justify-end gap-2", className)}>
      {children}
    </div>
  );
}
