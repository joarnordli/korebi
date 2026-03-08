import { useState, useRef } from "react";
import { Camera, Image, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { saveMemory, getTodayKey } from "@/lib/memories";

interface CaptureScreenProps {
  onSaved: () => void;
}

export default function CaptureScreen({ onSaved }: CaptureScreenProps) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!imageData) return;
    setSaving(true);
    setTimeout(() => {
      saveMemory({
        id: crypto.randomUUID(),
        date: getTodayKey(),
        imageData,
        note: note.trim(),
        createdAt: Date.now(),
      });
      onSaved();
    }, 400);
  };

  return (
    <div className="flex flex-col items-center px-6 pt-4 pb-8">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-muted-foreground font-body text-sm mb-6"
      >
        Capture today's highlight
      </motion.p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <AnimatePresence mode="wait">
        {!imageData ? (
          <motion.button
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-[3/4] max-w-xs rounded-2xl border-2 border-dashed border-primary/30 bg-card flex flex-col items-center justify-center gap-4 shadow-card transition-colors hover:border-primary/50 active:bg-secondary"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-7 h-7 text-primary" />
            </div>
            <span className="text-muted-foreground font-body text-sm">
              Tap to add a photo
            </span>
          </motion.button>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xs flex flex-col gap-4"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-elevated bg-card p-2">
              <img
                src={imageData}
                alt="Today's capture"
                className="w-full aspect-[3/4] object-cover rounded-xl"
              />
              <button
                onClick={() => {
                  setImageData(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-foreground/60 flex items-center justify-center"
              >
                <Image className="w-4 h-4 text-background" />
              </button>
            </div>

            <div className="relative">
              <textarea
                value={note}
                onChange={(e) =>
                  setNote(e.target.value.slice(0, 160))
                }
                placeholder="What made today special?"
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                {note.length}/160
              </span>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-semibold text-sm flex items-center justify-center gap-2 shadow-card disabled:opacity-60"
            >
              {saving ? (
                <span>Saving…</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Memory
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
