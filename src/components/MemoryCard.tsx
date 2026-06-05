import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Memory, formatDate, updateMemory } from "@/lib/memories";
import { compressImage } from "@/lib/image-compress";
import { useAuth } from "@/hooks/useAuth";
import { MoreHorizontal, Check, X, ImagePlus, Pencil, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MemoryCardProps {
  memory: Memory;
  index: number;
  onUpdated: () => void;
}

export default function MemoryCard({ memory, index, onUpdated }: MemoryCardProps) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(memory.note || "");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Note: We intentionally do NOT revoke blob: URLs here because
  // react-query caches the Memory objects. Revoking on unmount
  // invalidates cached URLs, breaking images when re-entering the feed.
  // Blob URLs are freed automatically when the page unloads.

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setNewImage(compressed);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch (err: any) {
      toast.error(err.message || "Failed to process image");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateMemory(memory.id, user.id, {
        note,
        imageFile: newImage || undefined,
      });
      toast.success("Memory updated");
      setEditing(false);
      setNewImage(null);
      setImagePreview(null);
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setNote(memory.note || "");
    setNewImage(null);
    setImagePreview(null);
  };

  const downloadBlob = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `okiro-memory.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    setMenuOpen(false);
    setSharing(true);
    try {
      const response = await fetch(memory.image_url);
      const blob = await response.blob();
      const mimeMap: Record<string, string> = {
        "image/webp": "webp",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/heic": "heic",
        "image/heif": "heif",
      };
      const fileType = mimeMap[blob.type] ? blob.type : "image/jpeg";
      const ext = mimeMap[blob.type] ?? "jpg";
      const file = new File([blob], `okiro-memory.${ext}`, { type: fileType });

      const dateLabel = formatDate(memory.date);
      const text = memory.note
        ? `A memory from ${dateLabel}\n\n${memory.note}`
        : `A memory from ${dateLabel}`;

      if (navigator.canShare?.({ files: [file] })) {
        // Tier 1: Full native share with image + text (mobile)
        await navigator.share({ files: [file], text });
      } else if (navigator.share) {
        // Tier 2: Desktop with share API — download image + share text
        downloadBlob(blob, ext);
        await navigator.share({ text });
      } else {
        // Tier 3: No share API — download image + copy text to clipboard
        downloadBlob(blob, ext);
        await navigator.clipboard.writeText(text);
        toast.success("Image downloaded & caption copied");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("Failed to share");
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <motion.div
      initial={hasMounted.current ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: hasMounted.current ? 0 : index * 0.08, duration: 0.4 }}
      layout
      className="bg-card rounded-2xl shadow-card overflow-hidden p-1"
    >
      <div className="relative">
        <img
          src={imagePreview || memory.image_url}
          alt={memory.note ? `Daily memory from ${formatDate(memory.date)}: ${memory.note}` : `Daily memory from ${formatDate(memory.date)}`}
          className="w-full aspect-[3/4] object-cover rounded-xl"
          loading="lazy"
        />
        {editing && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Change image"
              className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-foreground/60 flex items-center justify-center backdrop-blur-sm"
            >
              <ImagePlus className="w-5 h-5 text-background" />
            </button>
          </>
        )}
      </div>

      <div className="px-2.5 pt-2 pb-1.5">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-semibold text-foreground">
            {formatDate(memory.date)}
          </p>
          {!editing && (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button className="p-1" aria-label="More options">
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                sideOffset={8}
                collisionPadding={{ top: 80, bottom: 100, left: 12, right: 12 }}
                className="w-auto p-0 bg-transparent border-0 shadow-none"
              >
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleShare}
                    disabled={sharing}
                    aria-label="Share memory"
                    className="glass-pill w-11 h-11 rounded-full flex items-center justify-center text-foreground transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setEditing(true); }}
                    aria-label="Edit memory"
                    className="glass-pill w-11 h-11 rounded-full flex items-center justify-center text-foreground transition-transform active:scale-95"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 160))}
              placeholder="What made this day special?"
              aria-label="Memory note"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleCancel}
                className="py-2 px-3 rounded-lg bg-secondary text-muted-foreground font-body text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          memory.note && (
            <p className="font-body text-sm text-muted-foreground mt-1 leading-relaxed">
              {memory.note}
            </p>
          )
        )}
      </div>
    </motion.div>
  );
}
