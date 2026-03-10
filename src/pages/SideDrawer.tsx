import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Folder,
  FolderOpen,
  FileText,
  Upload,
  UserPlus,
  Plus,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  File,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface DrawerRecord {
  id: string;
  name: string;
  record_type?: string;
  files_count?: number;
}

interface DrawerFile {
  id: string;
  file_name: string;
  file_size?: number;
  created_at?: string;
  download_url?: string;
  mime_type?: string;
}

const SideDrawerPage = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<any>(null);
  const [drawers, setDrawers] = useState<DrawerRecord[]>([]);
  const [drawerFiles, setDrawerFiles] = useState<Record<string, DrawerFile[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [credentialsMissing, setCredentialsMissing] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, full_name, sidedrawer_url, family_id, household_id")
      .eq("id", contactId)
      .maybeSingle();
    setContact(data);
    return data;
  }, [contactId]);

  const fetchDrawers = useCallback(async (sidedrawerUrl: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sidedrawer-service", {
        body: { action: "listDrawers", sidedrawerUrl },
      });

      if (fnError) throw fnError;
      if (data?.error) {
        if (data.error.includes("credentials not configured")) {
          setCredentialsMissing(true);
          return;
        }
        throw new Error(data.error);
      }

      const records = Array.isArray(data?.data) ? data.data : data?.data?.records || [];
      setDrawers(records);
    } catch (err: any) {
      console.error("Failed to fetch drawers:", err);
      setError(err.message || "Failed to load SideDrawer data");
    }
  }, []);

  const fetchFiles = useCallback(async (drawerId: string, sidedrawerUrl: string) => {
    setLoadingFiles((prev) => ({ ...prev, [drawerId]: true }));
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sidedrawer-service", {
        body: { action: "listFiles", sidedrawerUrl, drawerId },
      });

      if (fnError) throw fnError;
      const files = Array.isArray(data?.data) ? data.data : data?.data?.files || [];
      setDrawerFiles((prev) => ({ ...prev, [drawerId]: files }));
    } catch (err: any) {
      console.error("Failed to fetch files:", err);
      toast.error("Failed to load files");
    } finally {
      setLoadingFiles((prev) => ({ ...prev, [drawerId]: false }));
    }
  }, []);

  useEffect(() => {
    (async () => {
      const c = await fetchContact();
      if (c?.sidedrawer_url) {
        await fetchDrawers(c.sidedrawer_url);
      }
      setLoading(false);
    })();
  }, [fetchContact, fetchDrawers]);

  const handleUpload = async (drawerId: string) => {
    if (!contact?.sidedrawer_url) return;

    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        toast.info(`Uploading ${file.name}...`);
        const { data, error: fnError } = await supabase.functions.invoke("sidedrawer-service", {
          body: {
            action: "getUploadUrl",
            sidedrawerUrl: contact.sidedrawer_url,
            drawerId,
            fileName: file.name,
          },
        });

        if (fnError || data?.error) throw new Error(data?.error || "Failed to get upload URL");

        const uploadUrl = data?.data?.upload_url;
        if (uploadUrl) {
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          });
          if (!uploadRes.ok) throw new Error("Upload failed");
        }

        toast.success(`${file.name} uploaded successfully`);
        await fetchFiles(drawerId, contact.sidedrawer_url);
      } catch (err: any) {
        toast.error(err.message || "Upload failed");
      }
    };
    input.click();
  };

  const handleRefresh = async () => {
    if (!contact?.sidedrawer_url) return;
    setLoading(true);
    setDrawers([]);
    setDrawerFiles({});
    setError(null);
    await fetchDrawers(contact.sidedrawer_url);
    setLoading(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!contact) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Contact not found.</p>
      </AppLayout>
    );
  }

  const hasSideDrawer = !!contact.sidedrawer_url;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Contacts", href: "/contacts" },
            {
              label: `${contact.first_name} ${contact.last_name || ""}`.trim(),
              href: `/contacts/${contact.id}`,
            },
            { label: "SideDrawer" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/contacts/${contactId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                SideDrawer — {contact.first_name} {contact.last_name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Document vault management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasSideDrawer && (
              <>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={contact.sidedrawer_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in SideDrawer
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Credentials missing notice */}
        {credentialsMissing && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <h3 className="font-semibold">
                    SideDrawer credentials not configured
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    The SideDrawer API credentials have not been added yet. Once you
                    receive your <code className="text-xs bg-muted px-1 rounded">client_id</code>,{" "}
                    <code className="text-xs bg-muted px-1 rounded">client_secret</code>, and{" "}
                    <code className="text-xs bg-muted px-1 rounded">tenant_id</code> from
                    SideDrawer, they'll be configured here automatically.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No SideDrawer linked */}
        {!hasSideDrawer && (
          <Card>
            <CardContent className="p-12 text-center">
              <Folder className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-semibold">No SideDrawer linked</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                This contact doesn't have a SideDrawer URL set. Edit the contact to add
                their SideDrawer link, or provision a new SideDrawer.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button variant="outline" onClick={() => navigate(`/contacts/${contactId}/edit`)}>
                  Edit Contact
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      toast.info("Provisioning new SideDrawer...");
                      const { data, error: fnError } = await supabase.functions.invoke(
                        "sidedrawer-service",
                        {
                          body: {
                            action: "createSideDrawer",
                            name: `${contact.first_name} ${contact.last_name || ""}`.trim(),
                            ownerEmail: undefined,
                          },
                        }
                      );
                      if (fnError || data?.error) {
                        throw new Error(data?.error || "Provisioning failed");
                      }
                      const newUrl = data?.data?.url || data?.data?.sidedrawer_url;
                      if (newUrl) {
                        await supabase
                          .from("contacts")
                          .update({ sidedrawer_url: newUrl })
                          .eq("id", contactId);
                        toast.success("SideDrawer provisioned!");
                        window.location.reload();
                      } else {
                        toast.success("SideDrawer created — update the contact URL manually.");
                      }
                    } catch (err: any) {
                      toast.error(err.message || "Failed to provision SideDrawer");
                    }
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Provision SideDrawer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && !credentialsMissing && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <h3 className="font-semibold text-destructive">Error loading SideDrawer</h3>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
                    Retry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Drawer tree */}
        {hasSideDrawer && !credentialsMissing && !error && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                Drawers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {drawers.length === 0 && !loading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No drawers found in this SideDrawer.
                </p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {drawers.map((drawer) => (
                    <AccordionItem key={drawer.id} value={drawer.id}>
                      <AccordionTrigger
                        className="hover:no-underline"
                        onClick={() => {
                          if (!drawerFiles[drawer.id] && contact.sidedrawer_url) {
                            fetchFiles(drawer.id, contact.sidedrawer_url);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Folder className="h-4 w-4 text-primary" />
                          <span className="font-medium">{drawer.name}</span>
                          {drawer.record_type && (
                            <Badge variant="outline" className="text-xs">
                              {drawer.record_type}
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pl-7 space-y-2">
                          {loadingFiles[drawer.id] ? (
                            <div className="space-y-2">
                              <Skeleton className="h-8 w-full" />
                              <Skeleton className="h-8 w-3/4" />
                            </div>
                          ) : (drawerFiles[drawer.id] || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">
                              No files in this drawer.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {(drawerFiles[drawer.id] || []).map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-sm font-medium">{file.file_name}</p>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        {file.file_size && (
                                          <span>{formatFileSize(file.file_size)}</span>
                                        )}
                                        {file.created_at && (
                                          <span>
                                            {format(new Date(file.created_at), "MMM d, yyyy")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {file.download_url && (
                                    <Button variant="ghost" size="icon" asChild>
                                      <a href={file.download_url} target="_blank" rel="noopener noreferrer">
                                        <Download className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => handleUpload(drawer.id)}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload file
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default SideDrawerPage;
