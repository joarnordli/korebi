import { motion } from "framer-motion";
import { Memory, formatDate } from "@/lib/memories";

interface MemoryCardProps {
  memory: Memory;
  index: number;
}

export default function MemoryCard({ memory, index }: MemoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="bg-card rounded-2xl shadow-card overflow-hidden p-2"
    >
      <img
        src={memory.imageData}
        alt={memory.note || "Memory"}
        className="w-full aspect-[3/4] object-cover rounded-xl"
        loading="lazy"
      />
      <div className="px-2 pt-3 pb-2">
        <p className="font-display text-sm font-semibold text-foreground">
          {formatDate(memory.date)}
        </p>
        {memory.note && (
          <p className="font-body text-sm text-muted-foreground mt-1 leading-relaxed">
            {memory.note}
          </p>
        )}
      </div>
    </motion.div>
  );
}
