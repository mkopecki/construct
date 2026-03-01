import type { SOPSummary, SOPDetail, UpdateSOPRequest, RunSummary, RunDetail, DataTarget } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  listSOPs: () => apiFetch<SOPSummary[]>("/api/sops"),

  getSOP: (id: string) => apiFetch<SOPDetail>(`/api/sops/${id}`),

  updateSOP: (id: string, data: UpdateSOPRequest) =>
    apiFetch<{ ok: true }>(`/api/sops/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteSOP: (id: string) =>
    apiFetch<{ ok: true }>(`/api/sops/${id}`, { method: "DELETE" }),

  listRuns: (sopId: string) =>
    apiFetch<RunSummary[]>(`/api/sops/${sopId}/runs`),

  getRun: (runId: string) => apiFetch<RunDetail>(`/api/runs/${runId}`),

  cancelRun: (runId: string) =>
    apiFetch<{ ok: true }>(`/api/runs/${runId}/cancel`, { method: "POST" }),

  setDataTarget: (sopId: string, dataTarget: DataTarget | null) =>
    apiFetch<{ ok: true }>(`/api/sops/${sopId}/data-target`, {
      method: "PUT",
      body: JSON.stringify({ data_target: dataTarget }),
    }),
};
