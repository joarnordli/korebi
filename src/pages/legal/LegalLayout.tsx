import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import okiroLogo from "@/assets/okiro-logo.png";

interface LegalLayoutProps {
  title: string;
  updated?: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, updated = "May 2026", children }: LegalLayoutProps) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 py-5 max-w-2xl mx-auto w-full flex items-center justify-between">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/welcome"))}
          className="flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <Link to="/welcome" className="flex items-center gap-2">
          <img src={okiroLogo} alt="Okiro" className="w-6 h-6" />
          <span className="font-display text-lg font-bold text-foreground tracking-tight">Okiro</span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 pb-20">
        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight mb-1">{title}</h1>
        <p className="font-body text-xs text-muted-foreground mb-8">Last updated: {updated}</p>
        <article className="font-body text-sm text-foreground/90 leading-relaxed space-y-5 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline">
          {children}
        </article>

        <div className="mt-12 pt-6 border-t border-border flex flex-wrap gap-x-4 gap-y-2 font-body text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link to="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
          <a href="mailto:hello@okiro.online" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </main>
    </div>
  );
}
