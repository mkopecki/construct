import { BACKEND_URL, WEB_UI_URL } from "./config";
import type { RecordedEvent, RecordingState } from "./types";

const DEFAULT_STATE: RecordingState = {
  isRecording: false,
  tabId: null,
  events: [],
  startUrl: null,
};

async function getState(): Promise<RecordingState> {
  const result = await chrome.storage.session.get("recordingState");
  return (result.recordingState as RecordingState) ?? { ...DEFAULT_STATE };
}

async function setState(state: RecordingState): Promise<void> {
  await chrome.storage.session.set({ recordingState: state });
}

async function injectContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"],
    });
  } catch (err) {
    console.warn("[construct] Failed to inject content script:", err);
  }
}

// Navigation listener callbacks
function onNavCommitted(
  details: chrome.webNavigation.WebNavigationTransitionCallbackDetails
) {
  if (details.frameId !== 0) return;

  const validTransitions = ["typed", "auto_bookmark", "generated"];
  if (!validTransitions.includes(details.transitionType)) return;

  getState().then((state) => {
    if (!state.isRecording || state.tabId !== details.tabId) return;

    const event: RecordedEvent = {
      type: "navigate",
      url: details.url,
      timestamp: Date.now(),
    };
    state.events.push(event);
    setState(state);
  });
}

function onNavCompleted(
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails
) {
  if (details.frameId !== 0) return;

  getState().then((state) => {
    if (!state.isRecording || state.tabId !== details.tabId) return;
    injectContentScript(details.tabId);
  });
}

async function startRecording(): Promise<{ success: boolean }> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id || !tab.url) return { success: false };

  const state: RecordingState = {
    isRecording: true,
    tabId: tab.id,
    events: [],
    startUrl: tab.url,
  };
  await setState(state);

  await injectContentScript(tab.id);

  chrome.webNavigation.onCommitted.addListener(onNavCommitted);
  chrome.webNavigation.onCompleted.addListener(onNavCompleted);

  return { success: true };
}

async function stopRecording(): Promise<{ success: boolean; recordingId?: string; error?: string }> {
  const state = await getState();

  chrome.webNavigation.onCommitted.removeListener(onNavCommitted);
  chrome.webNavigation.onCompleted.removeListener(onNavCompleted);

  const events = state.events;
  const startUrl = state.startUrl ?? "";

  console.log("[construct] Recording payload:", { startUrl, events });

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

    await setState({ ...DEFAULT_STATE });
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

    await setState({ ...DEFAULT_STATE });
    return { success: false, error: message };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      case "START_RECORDING": {
        const result = await startRecording();
        return result;
      }
      case "STOP_RECORDING": {
        return await stopRecording();
      }
      case "RECORD_EVENT": {
        const state = await getState();
        if (!state.isRecording) return;
        if (sender.tab?.id !== state.tabId) return;

        state.events.push(message.event as RecordedEvent);
        await setState(state);
        return { success: true };
      }
      case "GET_STATE": {
        const state = await getState();
        return {
          isRecording: state.isRecording,
          eventCount: state.events.length,
        };
      }
    }
  };

  handle().then(sendResponse);
  return true; // keep message channel open for async response
});
