import { Memory } from "@/lib/memories";
import MemoryCard from "./MemoryCard";
import { Shuffle } from "lucide-react";

interface ReliveFeedProps {
  memories: Memory[];
  onUpdated: () => void;
}

export default function ReliveFeed({ memories, onUpdated }: ReliveFeedProps) {
  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
          <Shuffle className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="font-display text-lg text-foreground">Nothing to relive yet</p>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Capture a few moments and they'll resurface here
        </p>
      </div>
    );
  }

  return (
    <div className="px-2 pb-24 space-y-3">
      {memories.map((memory, i) => (
        <MemoryCard key={memory.id} memory={memory} index={i} onUpdated={onUpdated} />
      ))}
    </div>
  );
}

