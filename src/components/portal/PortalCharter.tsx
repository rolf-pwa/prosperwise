import { Card, CardContent } from "@/components/ui/card";
import { ScrollText, ExternalLink } from "lucide-react";

interface Props {
  googleDriveUrl: string | null;
}

export function PortalCharter({ googleDriveUrl }: Props) {
  // Convert Google Drive sharing URL to embeddable format
  const getEmbedUrl = (url: string): string | null => {
    // Handle /file/d/{id} format
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;

    // Handle /document/d/{id} format (Google Docs)
    const docMatch = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) return `https://docs.google.com/document/d/${docMatch[1]}/preview`;

    // Handle ?id= format
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;

    return null;
  };

  if (!googleDriveUrl) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ScrollText className="h-12 w-12 text-slate-700 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 font-serif">
            Sovereignty Charter
          </h3>
          <p className="text-sm text-slate-500 mt-2 max-w-sm">
            Your charter document has not been linked yet. Your Personal CFO will upload it once it has been ratified.
          </p>
        </CardContent>
      </Card>
    );
  }

  const embedUrl = getEmbedUrl(googleDriveUrl);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-sanctuary-bronze" />
          <h2 className="text-lg font-semibold text-slate-100 font-serif">Sovereignty Charter</h2>
        </div>
        <a
          href={googleDriveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-sanctuary-bronze hover:text-sanctuary-bronze/80 transition-colors"
        >
          Open in Google Drive <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {embedUrl ? (
        <div className="rounded-lg border border-slate-800 overflow-hidden bg-slate-900">
          <iframe
            src={embedUrl}
            className="w-full"
            style={{ height: "70vh", minHeight: "500px" }}
            allow="autoplay"
            title="Sovereignty Charter"
          />
        </div>
      ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-slate-400">
              Unable to preview this document. 
            </p>
            <a
              href={googleDriveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-sanctuary-bronze hover:underline"
            >
              Open document <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
