import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Memory, formatDate, updateMemory } from "@/lib/memories";
import { useAuth } from "@/hooks/useAuth";
import { MoreHorizontal, Check, X, ImagePlus } from "lucide-react";
import { toast } from "sonner";

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
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="bg-card rounded-2xl shadow-card overflow-hidden p-2"
    >
      <div className="relative">
        <img
          src={imagePreview || memory.image_url}
          alt={memory.note || "Memory"}
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
              className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-foreground/60 flex items-center justify-center backdrop-blur-sm"
            >
              <ImagePlus className="w-5 h-5 text-background" />
            </button>
          </>
        )}
      </div>

      <div className="px-2 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-semibold text-foreground">
            {formatDate(memory.date)}
          </p>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 160))}
              placeholder="What made this day special?"
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
