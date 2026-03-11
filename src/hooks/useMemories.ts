import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMemories, hasTodayMemory, getStreak, Memory } from "@/lib/memories";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

export function useMemories() {
  const { user } = useAuth();

  const memoriesQuery = useQuery({
    queryKey: ["memories"],
    queryFn: getMemories,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!user,
  });

  const todayQuery = useQuery({
    queryKey: ["hasTodayMemory"],
    queryFn: hasTodayMemory,
    staleTime: 60 * 1000, // 1 minute
    enabled: !!user,
  });

  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["memories"] }),
      queryClient.invalidateQueries({ queryKey: ["hasTodayMemory"] }),
    ]);
  }, [queryClient]);

  const memories = memoriesQuery.data ?? [];
  const todayCaptured = todayQuery.data ?? false;
  const streak = getStreak(memories.map((m) => m.date));
  const loading = memoriesQuery.isLoading || todayQuery.isLoading;

  const locations = memories.filter(
    (m): m is Memory & { latitude: number; longitude: number } =>
      m.latitude !== null && m.longitude !== null
  );

  return {
    memories,
    todayCaptured,
    streak,
    locations,
    loading,
    refresh,
  };
}
