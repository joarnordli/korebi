import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import okiroLogo from "@/assets/okiro-logo.png";
import { ArrowRight, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    // Best-effort: hint to crawlers this is a soft 404 without changing routing.
    document.title = "Page not found — Okiro";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "The page you were looking for does not exist on Okiro. Return to the daily photo journal home.");
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, follow");
  }, [location.pathname]);

  return (
    <main className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center">
      <img src={okiroLogo} alt="Okiro" className="w-14 h-14 mb-6" />
      <p className="font-body text-xs uppercase tracking-widest text-muted-foreground mb-3">
        Error 404
      </p>
      <h1 className="font-display text-3xl font-bold text-foreground tracking-tight mb-3">
        This page wandered off
      </h1>
      <p className="font-body text-sm text-muted-foreground max-w-sm leading-relaxed mb-8">
        The link may be broken or the page may have moved. Let's get you back to capturing today's moment.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-primary text-primary-foreground font-body font-semibold text-sm shadow-card hover:shadow-elevated transition-shadow flex-1"
        >
          <Home className="w-4 h-4" />
          Home
        </Link>
        <Link
          to="/welcome"
          className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl border border-border bg-card font-body font-semibold text-sm text-foreground hover:bg-secondary transition-colors flex-1"
        >
          About Okiro
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <nav
        aria-label="Helpful links"
        className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-body text-xs text-muted-foreground"
      >
        <Link to="/auth" className="hover:text-foreground transition-colors">Sign in</Link>
        <span aria-hidden>·</span>
        <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
        <span aria-hidden>·</span>
        <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        <span aria-hidden>·</span>
        <a href="mailto:hello@okiro.online" className="hover:text-foreground transition-colors">Contact</a>
      </nav>
    </main>
  );
};

export default NotFound;
