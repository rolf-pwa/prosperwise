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

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
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
