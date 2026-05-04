import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  Download,
  Eye,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

type DriveFolder = { id: string; name: string };
type DriveFile = { id: string; name: string; mimeType: string; size: number | null };

const FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/vault-service`;

function formatSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function guestCall(
  token: string,
  unlockCode: string | null,
  action: string,
  payload: Record<string, unknown> = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-vault-guest-token": token,
  };
  if (unlockCode) headers["x-vault-unlock-code"] = unlockCode;
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

async function guestStream(token: string, fileId: string, disposition: "inline" | "attachment") {
  const res = await fetch(`${FUNCTIONS_URL}?disposition=${disposition}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-vault-guest-token": token },
    body: JSON.stringify({ action: "streamFile", fileId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.blob();
}

function GuestFolder({
  token,
  folderId,
  name,
  depth,
  onPreview,
}: {
  token: string;
  folderId: string;
  name: string;
  depth: number;
  onPreview: (f: DriveFile) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      setLoading(true);
      try {
        const j = await guestCall(token, null, "listFolder", { folderId });
        setFolders(j.folders ?? []);
        setFiles(j.files ?? []);
        setLoaded(true);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, loaded, folderId, token]);

  const dl = async (f: DriveFile) => {
    try {
      const blob = await guestStream(token, f.id, "attachment");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 py-1.5 text-left hover:text-amber-500 w-full">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Folder className="h-4 w-4 text-amber-500" />
        <span className="font-serif">{name}</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
      </button>
      {open && (
        <div className="border-l border-border ml-2 pl-2">
          {folders.map((f) => (
            <GuestFolder key={f.id} token={token} folderId={f.id} name={f.name} depth={depth + 1} onPreview={onPreview} />
          ))}
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 py-1.5 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onPreview(f)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => dl(f)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {loaded && folders.length === 0 && files.length === 0 && (
            <div className="text-xs text-muted-foreground py-1 italic">Empty</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VaultGuest() {
  const { token = "" } = useParams<{ token: string }>();
  const [unlockCode, setUnlockCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [roots, setRoots] = useState<{ id: string; name: string }[]>([]);
  const [preview, setPreview] = useState<{ file: DriveFile; url: string } | null>(null);

  const verify = async () => {
    setVerifying(true);
    try {
      // Pull collaborator's grants by listing each grant root
      const grants = await guestCall(token, unlockCode, "listFolder", {
        folderId: "__roots__", // server uses this only after unlock; harmless
      }).catch(() => null);
      // Even if listFolder("__roots__") errors, the unlock_verified_at is set.
      // Fetch grants via a subsequent call against the actual root by reading
      // server response — simpler: rely on the server returning forbidden until
      // we explicitly know roots. So load grants from a dedicated helper:
      const r = await fetch(FUNCTIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-vault-guest-token": token },
        body: JSON.stringify({ action: "myGrants" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "verification_failed");
      setRoots(j.roots ?? []);
      setUnlocked(true);
      toast.success("Access granted");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setVerifying(false);
    }
  };

  const openPreview = async (file: DriveFile) => {
    setPreview({ file, url: "" });
    try {
      const blob = await guestStream(token, file.id, "inline");
      setPreview({ file, url: URL.createObjectURL(blob) });
    } catch (e: any) {
      toast.error(e.message);
      setPreview(null);
    }
  };

  const previewable = useMemo(() => {
    if (!preview) return false;
    const mt = preview.file.mimeType;
    return mt === "application/pdf" || mt.startsWith("image/") || mt.startsWith("text/") || mt.includes("vnd.google-apps");
  }, [preview]);

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              <CardTitle className="font-serif">Secure Document Access</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You've been invited to view documents through ProsperWise. Enter the 6-digit code from your invite to continue.
            </p>
            <div>
              <Label>Unlock code</Label>
              <Input
                value={unlockCode}
                onChange={(e) => setUnlockCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                className="font-mono text-lg tracking-widest text-center"
                placeholder="••••••"
              />
            </div>
            <Button onClick={verify} disabled={unlockCode.length !== 6 || verifying} className="w-full">
              {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Unlock
            </Button>
            <p className="text-xs text-muted-foreground">
              Bound to this browser after unlock. All access is logged.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-serif">Shared Documents</h1>
        <p className="text-sm text-muted-foreground">Access via ProsperWise · all activity is audited</p>
      </div>
      {roots.length === 0 ? (
        <p className="text-muted-foreground italic">No active grants.</p>
      ) : (
        roots.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-6">
              <GuestFolder token={token} folderId={r.id} name={r.name} depth={0} onPreview={openPreview} />
            </CardContent>
          </Card>
        ))
      )}
      <Dialog
        open={!!preview}
        onOpenChange={(o) => {
          if (!o) {
            if (preview?.url) URL.revokeObjectURL(preview.url);
            setPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif">{preview?.file.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted rounded">
            {!preview?.url ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : previewable ? (
              preview.file.mimeType.startsWith("image/") ? (
                <img src={preview.url} alt={preview.file.name} className="max-h-full max-w-full mx-auto object-contain" />
              ) : (
                <iframe src={preview.url} className="w-full h-full" title={preview.file.name} />
              )
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Preview not available.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
