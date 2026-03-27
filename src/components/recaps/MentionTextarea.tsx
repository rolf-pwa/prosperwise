import { useState, useEffect, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Heading2, List, ListOrdered, AtSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MentionOption {
  id: string;
  label: string;
  type: "contact" | "staff";
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function MentionTextarea({ value, onChange, placeholder, rows = 12, className }: MentionTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MentionOption[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch contacts + profiles for mention suggestions
  const fetchOptions = useCallback(async (q: string) => {
    const searchTerm = `%${q}%`;
    const [{ data: contacts }, { data: profiles }] = await Promise.all([
      supabase.from("contacts").select("id, full_name").ilike("full_name", searchTerm).limit(8),
      supabase.from("profiles").select("user_id, full_name").ilike("full_name", searchTerm).limit(5),
    ]);

    const results: MentionOption[] = [];
    (contacts || []).forEach((c) => results.push({ id: c.id, label: c.full_name, type: "contact" }));
    (profiles || []).forEach((p) => {
      if (p.full_name && !results.some((r) => r.label === p.full_name)) {
        results.push({ id: p.user_id, label: p.full_name, type: "staff" });
      }
    });
    setOptions(results);
    setSelectedIdx(0);
  }, []);

  useEffect(() => {
    if (showDropdown && query.length >= 1) {
      fetchOptions(query);
    } else if (showDropdown && query.length === 0) {
      fetchOptions("");
    }
  }, [query, showDropdown, fetchOptions]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(val);

    // Detect @mention trigger
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);
    if (atMatch) {
      setShowDropdown(true);
      setQuery(atMatch[1]);
      setMentionStart(cursorPos - atMatch[0].length);
    } else {
      setShowDropdown(false);
      setMentionStart(null);
    }
  };

  const insertMention = (option: MentionOption) => {
    if (mentionStart === null) return;
    const before = value.slice(0, mentionStart);
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const after = value.slice(cursorPos);
    const mention = `@${option.label} `;
    const newValue = before + mention + after;
    onChange(newValue);
    setShowDropdown(false);
    setMentionStart(null);

    // Re-focus and set cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = before.length + mention.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(options[selectedIdx]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const wrapSelection = (prefix: string, suffix: string = prefix) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(newValue);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const insertAtLineStart = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(newValue);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const toolbarButtons = [
    { icon: Bold, label: "Bold", action: () => wrapSelection("**") },
    { icon: Italic, label: "Italic", action: () => wrapSelection("_") },
    { icon: Heading2, label: "Section heading", action: () => insertAtLineStart("## ") },
    { icon: List, label: "Bullet list", action: () => insertAtLineStart("- ") },
    { icon: ListOrdered, label: "Numbered list", action: () => insertAtLineStart("1. ") },
    { icon: AtSign, label: "Mention", action: () => {
      const ta = textareaRef.current;
      if (!ta) return;
      const pos = ta.selectionStart;
      const newValue = value.slice(0, pos) + "@" + value.slice(pos);
      onChange(newValue);
      setShowDropdown(true);
      setQuery("");
      setMentionStart(pos);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(pos + 1, pos + 1);
      }, 0);
    }},
  ];

  return (
    <div className="relative">
      <div className="flex items-center gap-0.5 border border-b-0 rounded-t-md bg-muted/50 px-1 py-1">
        {toolbarButtons.map((btn) => (
          <Tooltip key={btn.label}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={btn.action}
              >
                <btn.icon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{btn.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={`${className} rounded-t-none`}
      />
      {showDropdown && options.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-72 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {options.map((opt, i) => (
            <button
              key={`${opt.type}-${opt.id}`}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent ${
                i === selectedIdx ? "bg-accent" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(opt);
              }}
            >
              <span className="font-medium text-foreground">{opt.label}</span>
              <span className="text-xs text-muted-foreground capitalize">({opt.type})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
