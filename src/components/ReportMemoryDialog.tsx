import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

type Category = "self_delete" | "dmca" | "other";

const schema = z.object({
  category: z.enum(["self_delete", "dmca", "other"]),
  message: z.string().trim().max(500).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memoryId: string;
  onDeleted?: () => void;
}

export function ReportMemoryDialog({ open, onOpenChange, memoryId, onDeleted }: Props) {
  const [category, setCategory] = useState<Category>("self_delete");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory("self_delete");
    setMessage("");
  };

  const handleSubmit = async () => {
    const parsed = schema.safeParse({ category, message: message || undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    setSubmitting(true);
    try {
      if (category === "self_delete") {
        // Delete memory row; storage cleanup happens via cascading owner policies
        const { error } = await supabase.from("memories").delete().eq("id", memoryId);
        if (error) throw error;
        toast.success("Memory deleted");
        onDeleted?.();
      } else {
        const { error } = await supabase.functions.invoke("submit-abuse-report", {
          body: { category, memory_id: memoryId, message: message || null },
        });
        if (error) throw error;
        toast.success("Report submitted. We'll review within 10 business days.");
      }
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report or remove</DialogTitle>
          <DialogDescription>
            Tell us what's wrong with this memory. Reports are reviewed by the Okiro team.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={category} onValueChange={(v) => setCategory(v as Category)} className="space-y-2">
          <div className="flex items-start gap-3">
            <RadioGroupItem value="self_delete" id="cat-self" className="mt-1" />
            <Label htmlFor="cat-self" className="font-normal leading-snug">
              It's my content and I want to delete it
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="dmca" id="cat-dmca" className="mt-1" />
            <Label htmlFor="cat-dmca" className="font-normal leading-snug">
              It violates someone else's rights (DMCA / copyright)
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="other" id="cat-other" className="mt-1" />
            <Label htmlFor="cat-other" className="font-normal leading-snug">
              Other concern (abuse, illegal content, safety)
            </Label>
          </div>
        </RadioGroup>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          placeholder="Optional: add details (max 500 characters)"
          rows={3}
        />
        <p className="text-xs text-muted-foreground -mt-2">{message.length}/500</p>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            {submitting ? "Submitting…" : category === "self_delete" ? "Delete memory" : "Submit report"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
