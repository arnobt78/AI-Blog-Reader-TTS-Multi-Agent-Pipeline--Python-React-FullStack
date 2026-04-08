/**
 * Opens FastAPI Swagger in a new tab; health opens the in-app dashboard at `/health`.
 */
import { Activity, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { backendDocsUrl } from "@/lib/api-base";
import { cn } from "@/lib/utils";

/** Matches History / Back to Home outline pills on ReaderPage */
const readerHeaderBtnClass =
  "gap-1.5 rounded-full border-violet-500/25 bg-white/60 px-3 shadow-sm backdrop-blur-xs dark:border-violet-400/30 dark:bg-slate-900/70 cursor-pointer";

export function BackendDocLinks({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      aria-label="Backend API links"
    >
      <Button
        variant="outline"
        size="sm"
        asChild
        className={readerHeaderBtnClass}
      >
        <a href={backendDocsUrl()} target="_blank" rel="noopener noreferrer">
          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
          API Docs
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        asChild
        className={readerHeaderBtnClass}
      >
        <Link to="/health">
          <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
          API Status
        </Link>
      </Button>
    </div>
  );
}
