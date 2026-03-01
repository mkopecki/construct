"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { UpdateSOPRequest, RunDetail } from "./types";

export function useSOPs() {
  return useQuery({
    queryKey: ["sops"],
    queryFn: api.listSOPs,
  });
}

export function useSOP(id: string) {
  return useQuery({
    queryKey: ["sops", id],
    queryFn: () => api.getSOP(id),
  });
}

export function useRuns(sopId: string) {
  return useQuery({
    queryKey: ["runs", { sopId }],
    queryFn: () => api.listRuns(sopId),
  });
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: ["runs", runId],
    queryFn: () => api.getRun(runId),
    refetchInterval: (query) => {
      const data = query.state.data as RunDetail | undefined;
      if (data && (data.status === "running" || data.status === "pending")) {
        return 2000;
      }
      return false;
    },
  });
}

export function useUpdateSOP(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSOPRequest) => api.updateSOP(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sops", id] });
      qc.invalidateQueries({ queryKey: ["sops"] });
    },
  });
}

export function useDeleteSOP(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteSOP(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sops"] });
    },
  });
}
