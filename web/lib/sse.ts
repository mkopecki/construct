import type { GenerationEvent, RunEvent } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function postSSE<T>(
  url: string,
  body: unknown,
  onEvent: (event: T) => void,
  signal?: AbortSignal
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SSE ${res.status}: ${text}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";
    for (const msg of messages) {
      const trimmed = msg.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          onEvent(JSON.parse(trimmed.slice(6)));
        } catch {
          // skip malformed JSON
        }
      }
    }
  }
}

export function streamGenerate(
  sopId: string,
  onEvent: (event: GenerationEvent) => void,
  signal?: AbortSignal
) {
  return postSSE<GenerationEvent>(
    `${BASE}/api/sops/${sopId}/generate`,
    {},
    onEvent,
    signal
  );
}

export function streamRun(
  sopId: string,
  params: Record<string, unknown>,
  onEvent: (event: RunEvent) => void,
  signal?: AbortSignal
) {
  return postSSE<RunEvent>(
    `${BASE}/api/runs`,
    { sop_id: sopId, params },
    onEvent,
    signal
  );
}
