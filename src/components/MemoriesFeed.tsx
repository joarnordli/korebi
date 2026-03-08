import { Memory } from "@/lib/memories";
import MemoryCard from "./MemoryCard";
import { BookOpen } from "lucide-react";

interface MemoriesFeedProps {
  memories: Memory[];
}

export default function MemoriesFeed({ memories }: MemoriesFeedProps) {
  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
          <BookOpen className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="font-display text-lg text-foreground">No memories yet</p>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Your captured moments will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 space-y-4">
      {memories.map((memory, i) => (
        <MemoryCard key={memory.id} memory={memory} index={i} />
      ))}
    </div>
  );
}
