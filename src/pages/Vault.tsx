import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  Download,
  Eye,
  UserPlus,
  ShieldCheck,
  Trash2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

type DriveFolder = { id: string; name: string; modifiedTime?: string };
type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime?: string;
};

const FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/vault-service`;

function formatSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function callVault(action: string, payload: Record<string, unknown> = {}) {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

function FolderNode({
  folderId,
  name,
  depth,
  contactId,
  onPreview,
}: {
  folderId: string;
  name: string;
  depth: number;
  contactId?: string;
  onPreview: (file: DriveFile) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [visMap, setVisMap] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  const loadVisibility = async (ids: string[]) => {
    if (!ids.length) return;
    const { data } = await supabase
      .from("vault_files")
      .select("drive_id, client_visible")
      .in("drive_id", ids);
    const m: Record<string, boolean> = {};
    (data ?? []).forEach((r: any) => (m[r.drive_id] = r.client_visible));
    setVisMap(m);
  };

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      setLoading(true);
      try {
        const json = await callVault("listFolder", { folderId });
        setFolders(json.folders ?? []);
        setFiles(json.files ?? []);
        await loadVisibility((json.files ?? []).map((f: DriveFile) => f.id));
        setLoaded(true);
      } catch (e: any) {
        toast.error(`Vault: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, loaded, folderId]);

  const toggleVisibility = async (file: DriveFile, next: boolean) => {
    try {
      await callVault("setVisibility", { fileId: file.id, contactId, clientVisible: next });
      setVisMap((m) => ({ ...m, [file.id]: next }));
      toast.success(next ? "Visible to client" : "Hidden from client");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 py-1.5 text-left hover:text-amber-500 w-full"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Folder className="h-4 w-4 text-amber-500" />
        <span className="font-serif">{name}</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
      </button>
      {open && (
        <div className="border-l border-border ml-2 pl-2">
          {folders.map((f) => (
            <FolderNode
              key={f.id}
              folderId={f.id}
              name={f.name}
              depth={depth + 1}
              contactId={contactId}
              onPreview={onPreview}
            />
          ))}
          {files.map((f) => {
            const visible = visMap[f.id] === true;
            return (
              <div key={f.id} className="flex items-center gap-2 py-1.5 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{f.name}</span>
                {contactId && (
                  <span className="flex items-center gap-1.5 mr-2" title="Visible to client">
                    <ShieldCheck className={`h-3.5 w-3.5 ${visible ? "text-amber-500" : "text-muted-foreground/40"}`} />
                    <Switch checked={visible} onCheckedChange={(v) => toggleVisibility(f, v)} />
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onPreview(f)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => downloadFile(f)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          {loaded && folders.length === 0 && files.length === 0 && (
            <div className="text-xs text-muted-foreground py-1 italic">Empty</div>
          )}
        </div>
      )}
    </div>
  );
}

async function fetchStream(fileId: string, disposition: "inline" | "attachment") {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch(`${FUNCTIONS_URL}?disposition=${disposition}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
    },
    body: JSON.stringify({ action: "streamFile", fileId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.blob();
}

async function downloadFile(file: DriveFile) {
  try {
    const blob = await fetchStream(file.id, "attachment");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    toast.error(e.message);
  }
}

export default function Vault() {
  const { contactId } = useParams<{ contactId?: string }>();
  const [rootId, setRootId] = useState<string>("");
  const [contactName, setContactName] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [preview, setPreview] = useState<{ file: DriveFile; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!contactId) return;
    (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("full_name, google_drive_url")
        .eq("id", contactId)
        .maybeSingle();
      if (data) {
        setContactName(data.full_name ?? "");
        const m = data.google_drive_url?.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (m) {
          setRootId(m[1]);
          setInput(m[1]);
        }
      }
    })();
  }, [contactId]);

  const openPreview = async (file: DriveFile) => {
    setPreviewLoading(true);
    setPreview({ file, url: "" });
    try {
      const blob = await fetchStream(file.id, "inline");
      const url = URL.createObjectURL(blob);
      setPreview({ file, url });
    } catch (e: any) {
      toast.error(e.message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const previewable = useMemo(() => {
    if (!preview) return false;
    const mt = preview.file.mimeType;
    return (
      mt === "application/pdf" ||
      mt.startsWith("image/") ||
      mt.startsWith("text/") ||
      mt.includes("vnd.google-apps.document") ||
      mt.includes("vnd.google-apps.presentation")
    );
  }, [preview]);

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-serif">The Vault</h1>
        <p className="text-muted-foreground">
          {contactName ? `Documents for ${contactName}` : "In-portal document workspace (POC)"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drive folder root</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Drive folder URL or ID"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button
            onClick={() => {
              const m = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
              setRootId(m ? m[1] : input.trim());
            }}
          >
            Load
          </Button>
        </CardContent>
      </Card>

      {rootId && (
        <Card>
          <CardContent className="pt-6">
            <FolderNode
              folderId={rootId}
              name={contactName ? `${contactName} — Vault` : "Vault Root"}
              depth={0}
              onPreview={openPreview}
            />
          </CardContent>
        </Card>
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
            {previewLoading || !preview?.url ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : previewable ? (
              preview.file.mimeType.startsWith("image/") ? (
                <img
                  src={preview.url}
                  alt={preview.file.name}
                  className="max-h-full max-w-full mx-auto object-contain"
                />
              ) : (
                <iframe src={preview.url} className="w-full h-full" title={preview.file.name} />
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <p>Preview not available for this file type.</p>
                <Button onClick={() => preview && downloadFile(preview.file)}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
