import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, ChevronDown, ChevronUp, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import ReactMarkdown from "react-markdown";
import { MentionTextarea } from "./MentionTextarea";

interface RecapCardProps {
  recap: {
    id: string;
    recap_date: string;
    author_id: string;
    body: string;
  };
  authorName: string;
  isAuthor: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSaveEdit: (id: string, body: string) => Promise<void>;
  saving: boolean;
}

export function RecapCard({ recap, authorName, isAuthor, isExpanded, onToggle, onSaveEdit, saving }: RecapCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState("");

  const startEdit = () => {
    setEditBody(recap.body);
    setIsEditing(true);
  };

  const handleSave = async () => {
    await onSaveEdit(recap.id, editBody);
    setIsEditing(false);
  };

  return (
    <Card className="transition-colors hover:border-primary/10">
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => {
          if (!isEditing) onToggle();
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-base font-semibold">
              {format(parseISO(recap.recap_date), "EEEE, MMMM d, yyyy")}
            </CardTitle>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {authorName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isExpanded && isAuthor && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit();
                }}
              >
                Edit
              </Button>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        {!isExpanded && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {recap.body.replace(/[#*_`]/g, "").slice(0, 150)}...
          </p>
        )}
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <MentionTextarea
                value={editBody}
                onChange={setEditBody}
                rows={12}
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{recap.body}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
