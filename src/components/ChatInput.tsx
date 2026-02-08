/**
 * Chat input component.
 */
import { useState, useRef, useEffect, useImperativeHandle, forwardRef, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}

export interface ChatInputHandle {
  /** Programmatically set the input text and focus. */
  setInput: (text: string) => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    {
      onSend,
      disabled,
      loading,
      placeholder = "Ask about TRON blockchain...",
    },
    ref,
  ) {
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on mount
    useEffect(() => {
      inputRef.current?.focus();
    }, []);

    // Expose imperative methods to parent
    useImperativeHandle(ref, () => ({
      setInput: (text: string) => {
        setInput(text);
        // Focus after a tick so the cursor goes to the end
        setTimeout(() => inputRef.current?.focus(), 0);
      },
    }));

    const handleSend = () => {
      const trimmed = input.trim();
      if (!trimmed || disabled || loading) return;

      onSend(trimmed);
      setInput("");
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    return (
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || loading}
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || disabled || loading}
          size="icon"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  },
);
