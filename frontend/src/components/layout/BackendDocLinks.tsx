/**
 * Opens FastAPI Swagger and health JSON in a new tab.
 * URLs follow `VITE_API_BASE_URL` in production; in Vite dev they target :8000 directly.
 */
import { Activity, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backendDocsUrl, backendHealthUrl } from "@/lib/api-base";
import { cn } from "@/lib/utils";

/** Matches History / Back to Home outline pills on ReaderPage */
const readerHeaderBtnClass =
  "gap-1.5 rounded-full border-violet-500/25 bg-white/60 px-3 shadow-sm backdrop-blur-sm dark:border-violet-400/30 dark:bg-slate-900/70 cursor-pointer";

export function BackendDocLinks({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      aria-label="Backend API links"
    >
      <Button variant="outline" size="sm" asChild className={readerHeaderBtnClass}>
        <a
          href={backendDocsUrl()}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
          API Docs
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild className={readerHeaderBtnClass}>
        <a
          href={backendHealthUrl()}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
          API Health
        </a>
      </Button>
    </div>
  );
}
