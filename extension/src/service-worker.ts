import { BACKEND_URL, WEB_UI_URL } from "./config";
import type { RecordedEvent, RecordingState } from "./types";

// ── In-memory state (synchronous push — no storage race) ──────────────
let inMemoryEvents: RecordedEvent[] = [];
let inMemoryIsRecording = false;
let inMemoryTabId: number | null = null;
let inMemoryStartUrl: string | null = null;

// ── Debounced persistence to storage (backup for worker restart) ──────
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persistEventsToStorage() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const snapshot: RecordingState = {
      isRecording: inMemoryIsRecording,
      tabId: inMemoryTabId,
      events: [...inMemoryEvents],
      startUrl: inMemoryStartUrl,
    };
    chrome.storage.session.set({ recordingState: snapshot });
  }, 1_000);
}

function persistEventsToStorageSync() {
  if (persistTimer) clearTimeout(persistTimer);
  const snapshot: RecordingState = {
    isRecording: inMemoryIsRecording,
    tabId: inMemoryTabId,
    events: [...inMemoryEvents],
    startUrl: inMemoryStartUrl,
  };
  chrome.storage.session.set({ recordingState: snapshot });
}

// ── Hydrate from storage on worker startup (handles restart mid-recording) ──
chrome.storage.session.get("recordingState").then((result) => {
  const stored = result.recordingState as RecordingState | undefined;
  if (stored?.isRecording) {
    inMemoryIsRecording = stored.isRecording;
    inMemoryTabId = stored.tabId;
    inMemoryEvents = stored.events ?? [];
    inMemoryStartUrl = stored.startUrl;
    // Re-attach nav listeners since we're mid-recording
    chrome.webNavigation.onCommitted.addListener(onNavCommitted);
    chrome.webNavigation.onCompleted.addListener(onNavCompleted);
    console.log("[construct] Hydrated mid-recording state from storage", {
      eventCount: inMemoryEvents.length,
    });
  }
});

// ── Content-script injection with retry (Bug 3) ──────────────────────
const INJECT_DELAYS = [0, 100, 500, 1500];

async function injectContentScript(tabId: number): Promise<void> {
  for (let attempt = 0; attempt < INJECT_DELAYS.length; attempt++) {
    const delay = INJECT_DELAYS[attempt];
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content-script.js"],
      });
      return; // success
    } catch (err) {
      console.warn(
        `[construct] Content-script inject attempt ${attempt + 1}/${INJECT_DELAYS.length} failed:`,
        err
      );
    }
  }
  console.error(
    `[construct] Failed to inject content script after ${INJECT_DELAYS.length} attempts`
  );
}

// ── Navigation listener callbacks ─────────────────────────────────────
function onNavCommitted(
  details: chrome.webNavigation.WebNavigationTransitionCallbackDetails
) {
  if (details.frameId !== 0) return;

  const ignoredTransitions = ["reload", "auto_subframe", "manual_subframe"];
  if (ignoredTransitions.includes(details.transitionType)) return;

  if (!inMemoryIsRecording || inMemoryTabId !== details.tabId) return;

  const event: RecordedEvent = {
    type: "navigate",
    url: details.url,
    timestamp: Date.now(),
  };
  inMemoryEvents.push(event);
  persistEventsToStorage();
}

function onNavCompleted(
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails
) {
  if (details.frameId !== 0) return;
  if (!inMemoryIsRecording || inMemoryTabId !== details.tabId) return;

  injectContentScript(details.tabId);
}

// ── Start / Stop ──────────────────────────────────────────────────────
async function startRecording(): Promise<{ success: boolean }> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id || !tab.url) return { success: false };

  inMemoryIsRecording = true;
  inMemoryTabId = tab.id;
  inMemoryStartUrl = tab.url;
  inMemoryEvents = [
    { type: "navigate", url: tab.url, timestamp: Date.now() },
  ];
  persistEventsToStorageSync();

  await injectContentScript(tab.id);

  chrome.webNavigation.onCommitted.addListener(onNavCommitted);
  chrome.webNavigation.onCompleted.addListener(onNavCompleted);

  return { success: true };
}

async function stopRecording(): Promise<{
  success: boolean;
  recordingId?: string;
  error?: string;
}> {
  chrome.webNavigation.onCommitted.removeListener(onNavCommitted);
  chrome.webNavigation.onCompleted.removeListener(onNavCompleted);

  const events = [...inMemoryEvents];
  const startUrl = inMemoryStartUrl ?? "";

  console.log("[construct] Recording payload:", { startUrl, events });

  // Reset in-memory state immediately
  inMemoryIsRecording = false;
  inMemoryTabId = null;
  inMemoryEvents = [];
  inMemoryStartUrl = null;
  persistEventsToStorageSync();

  try {
    const res = await fetch(`${BACKEND_URL}/api/recordings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startUrl, events }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { recording_id: string };
    const recordingId = data.recording_id;

    console.log("[construct] Recording saved. ID:", recordingId);

    // Open the SOP detail page in the web UI
    const sopUrl = `${WEB_UI_URL}/sops/${recordingId}`;
    chrome.tabs.create({ url: sopUrl });

    return { success: true, recordingId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[construct] Failed to save recording:", message);

    // Fallback: save locally so events aren't lost
    const fallbackId = `local_${Date.now()}`;
    await chrome.storage.local.set({
      [`recording_${fallbackId}`]: {
        id: fallbackId,
        startUrl,
        events,
        stoppedAt: Date.now(),
        error: message,
      },
    });

    return { success: false, error: message };
  }
}

// ── Message handler ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      case "START_RECORDING": {
        return await startRecording();
      }
      case "STOP_RECORDING": {
        return await stopRecording();
      }
      case "RECORD_EVENT": {
        if (!inMemoryIsRecording) return;
        if (sender.tab?.id !== inMemoryTabId) return;

        inMemoryEvents.push(message.event as RecordedEvent);
        persistEventsToStorage();
        return { success: true };
      }
      case "GET_STATE": {
        return {
          isRecording: inMemoryIsRecording,
          eventCount: inMemoryEvents.length,
        };
      }
    }
  };

  handle().then(sendResponse);
  return true; // keep message channel open for async response
});
