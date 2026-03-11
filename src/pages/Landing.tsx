import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, BookOpen, Sparkles, ArrowRight, Clock, CreditCard, Download, Share, Plus, MoreVertical, ChevronDown, ChevronUp, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import okiroLogo from "@/assets/okiro-logo.png";

const features = [
  {
    icon: Camera,
    title: "One Photo a Day",
    description: "Capture the single moment that defined your day. No pressure, no perfection — just presence.",
  },
  {
    icon: BookOpen,
    title: "Add a Thought",
    description: "Pair your photo with a short reflection. A sentence, a word, a feeling — whatever comes to mind.",
  },
  {
    icon: Sparkles,
    title: "Watch It Grow",
    description: "Over weeks and months, your feed becomes a beautiful, scrollable timeline of your life.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <img src={okiroLogo} alt="Okiro" className="w-7 h-7" />
          <span className="font-display text-xl font-bold text-foreground tracking-tight">
            Okiro
          </span>
        </div>
        <Link
          to="/auth"
          className="font-body text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md text-center mt-12 mb-14"
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <img src={okiroLogo} alt="" className="w-12 h-12" />
          </div>
          <h1 className="font-display text-4xl font-bold text-foreground tracking-tight leading-tight mb-4">
            One moment,
            <br />
            every day.
          </h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed max-w-xs mx-auto mb-8">
            A daily photo journal that helps you slow down, reflect, and remember what matters most.
          </p>
          <Link to="/auth">
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-semibold text-sm shadow-card hover:shadow-elevated transition-shadow"
            >
              Start free — no card needed
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-md space-y-4 mb-14"
        >
          {features.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.25 + i * 0.1 }}
              className="flex gap-4 bg-card rounded-2xl p-5 shadow-card"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-foreground mb-1">
                  {title}
                </h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Install Guide */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-md mb-14"
        >
          <InstallGuide />
        </motion.div>

        {/* Pricing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full max-w-md mb-16"
        >
          <div className="bg-card rounded-2xl shadow-card p-6 text-center">
            <h2 className="font-display text-xl font-bold text-foreground mb-4">
              Simple pricing
            </h2>

            <div className="flex items-center justify-center gap-6 mb-5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-body text-sm text-foreground font-medium">
                  7 days free
                </span>
              </div>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="font-body text-sm text-foreground font-medium">
                  Then 7 NOK/week
                </span>
              </div>
            </div>

            <p className="font-body text-sm text-muted-foreground leading-relaxed mb-6">
              No card required to start. Use Okiro free for 7 days — if you love it, subscribe to keep going. Tax included.
            </p>

            <Link to="/auth">
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-semibold text-sm flex items-center justify-center gap-2 shadow-card"
              >
                Get started for free
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Footer */}
        <footer className="w-full max-w-md text-center pb-8">
          <p className="font-body text-xs text-muted-foreground">
            © {new Date().getFullYear()} Okiro. Made with care.
          </p>
        </footer>
      </main>
    </div>
  );
}
