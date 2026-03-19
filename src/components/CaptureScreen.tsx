import { useState, useRef } from "react";
import { Camera, Image, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { saveMemory, getTodayKey } from "@/lib/memories";
import { compressImage } from "@/lib/image-compress";
import { extractGpsFromFile } from "@/lib/exif";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CaptureScreenProps {
  onSaved: () => void;
}

export default function CaptureScreen({ onSaved }: CaptureScreenProps) {
  const { user } = useAuth();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Extract GPS from original before compression strips EXIF
      const coords = await extractGpsFromFile(file);
      setGps(coords);
      const compressed = await compressImage(file);
      setImageFile(compressed);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch (err: any) {
      toast.error(err.message || "Failed to process image");
    }
  };

  const handleSave = async () => {
    if (!imageFile || !user) return;
    setSaving(true);
    try {
      await saveMemory(user.id, getTodayKey(), imageFile, note);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save memory");
      setSaving(false);
    }
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
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-xs flex flex-col items-center gap-4"
          >
            <div className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-primary/30 bg-card flex flex-col items-center justify-center gap-6 shadow-card">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 active:opacity-70 transition-opacity"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <span className="text-foreground font-body text-sm font-medium">Take Photo</span>
              </button>
              <button
                onClick={() => libraryRef.current?.click()}
                className="flex flex-col items-center gap-2 active:opacity-70 transition-opacity"
              >
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                  <Image className="w-6 h-6 text-muted-foreground" />
                </div>
                <span className="text-foreground font-body text-sm font-medium">From Library</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xs flex flex-col gap-4"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-elevated bg-card p-2">
              <img
                src={preview}
                alt="Today's capture"
                className="w-full aspect-[3/4] object-cover rounded-xl"
              />
              <button
                onClick={() => {
                  setPreview(null);
                  setImageFile(null);
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
                onChange={(e) => setNote(e.target.value.slice(0, 160))}
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
