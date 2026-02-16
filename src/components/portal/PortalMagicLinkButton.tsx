import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  contactId: string;
}

export function PortalMagicLinkButton({ contactId }: Props) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const generateLink = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("portal_tokens" as any)
        .insert({
          contact_id: contactId,
          created_by: user.id,
        } as any)
        .select("token")
        .single();

      if (error) throw error;

      const url = `${window.location.origin}/portal/${(data as any).token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Portal link copied to clipboard — valid for 7 days.");
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      toast.error("Failed to generate portal link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={generateLink}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : copied ? (
        <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Link2 className="mr-1 h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : "Share Portal Link"}
    </Button>
  );
}
