# Chrome Extension — Task Spec

## Purpose

A minimal Chrome extension that records user browser actions in a single tab and produces a structured event log. This log is used to generate a natural language prompt for a browser agent — not to replay DOM events. The extension captures **intent**, not implementation details.

---

## Events to Log

Four event types. Each event includes `pageUrl` as passive context (what page the user was on when the action happened) and a `timestamp`.

### 1. NavigateEvent

Fires when the user directly navigates to a URL (types in address bar, clicks a bookmark). Does NOT fire for click-triggered navigations — those are captured as ClickEvents, with the resulting URL recorded as context on the next event.

```typescript
{
  type: "navigate"
  url: string           // the URL navigated to
  timestamp: number
}
```

**Source:** `chrome.webNavigation.onCommitted` where `transitionType` is `"typed"`, `"auto_bookmark"`, or `"generated"`, filtered to `frameId === 0` (main frame only) and the recording tab.

### 2. ClickEvent

Fires when the user clicks an element. Captures a human-readable description of what was clicked.

```typescript
{
  type: "click"
  text: string | null       // innerText of the element, truncated to 100 chars
  tag: string               // tagName (button, a, input, div, etc.)
  role: string | null       // role attribute if present
  ariaLabel: string | null  // aria-label if present
  pageUrl: string           // current page URL
  timestamp: number
}
```

**Source:** Content script, `document.addEventListener('click', handler, true)` (capture phase).

**Element description extraction:**

```javascript
function describeElement(el) {
  // Walk composedPath for shadow DOM support
  return {
    text: el.innerText?.trim().substring(0, 100) || null,
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role') || null,
    ariaLabel: el.getAttribute('aria-label') || null,
  }
}
```

**Deduplication:** Discard click events that share the same `timestamp` as the immediately preceding event (handles label → input double-fire).

### 3. InputEvent

Fires when the user finishes typing into a field. Captures the field description and the **final value** — not per-keystroke.

```typescript
{
  type: "input"
  fieldLabel: string        // how to identify the field (placeholder, aria-label, or associated label text)
  value: string             // the final text value
  pageUrl: string           // current page URL
  timestamp: number
}
```

**Source:** Content script, `document.addEventListener('change', handler, true)` for standard inputs. The `change` event fires on blur/commit, giving us the final value naturally without debouncing.

**Field label extraction:**

```javascript
function getFieldLabel(el) {
  // Priority order: associated <label>, aria-label, placeholder, name attribute
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.innerText.trim();
  }
  return el.getAttribute('aria-label')
    || el.getAttribute('placeholder')
    || el.getAttribute('name')
    || null;
}
```

**Filter:** Only log for `<input>` (text types), `<textarea>`, and `contenteditable` elements. Ignore `type="hidden"`, `type="password"` (security — log the field but not the value), checkboxes, and radio buttons (handled by ClickEvent).

### 4. SelectEvent

Fires when the user selects an option from a `<select>` dropdown.

```typescript
{
  type: "select"
  fieldLabel: string        // how to identify the dropdown
  optionText: string        // the visible text of the selected option
  pageUrl: string           // current page URL
  timestamp: number
}
```

**Source:** Content script, `document.addEventListener('change', handler, true)`, filtered to `el.tagName === 'SELECT'`. Uses the same `getFieldLabel` function as InputEvent. The `optionText` is `el.options[el.selectedIndex].text`.

**Custom dropdowns** (React Select, listbox divs, etc.) are captured as ClickEvents on the option element — no special handling needed.

---

## Events NOT Logged

| Event | Reason |
|---|---|
| Scroll | Browser agent handles scrolling automatically |
| Hover | Edge case (hover menus), skip for hackathon |
| Keyboard shortcuts | Not part of typical SOPs |
| Timing / delays | Agent handles wait-for-element natively |
| Mouse movement | Irrelevant to intent |
| Form submit | Redundant — click on submit button is already captured |
| Focus / blur | Noise |
| Click-triggered navigation | The click is the action; the new URL appears as `pageUrl` on the next event |

---

## Extension Architecture

### Components

```
extension/
├── manifest.json          — MV3 manifest, permissions, content script registration
├── service-worker.js      — background: manages recording state, stores events, handles navigation
├── content-script.js      — injected into recorded tab: captures DOM events, sends to SW
├── popup.html             — extension popup: record/stop button, status indicator
└── popup.js               — popup logic: toggle recording, show event count
```

### Manifest

```json
{
  "manifest_version": 3,
  "name": "Construct Recorder",
  "version": "0.1.0",
  "permissions": [
    "activeTab",
    "tabs",
    "webNavigation",
    "storage",
    "scripting"
  ],
  "background": {
    "service_worker": "service-worker.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

No static `content_scripts` declaration — the content script is injected dynamically via `chrome.scripting.executeScript` only into the tab being recorded. This avoids running on every tab.

### Recording State

Stored in `chrome.storage.session` (in-memory, survives service worker restarts, cleared on browser quit).

```typescript
{
  isRecording: boolean
  tabId: number | null          // the tab being recorded
  events: RecordedEvent[]       // all captured events
  startUrl: string | null       // URL when recording started
}
```

### Flow

#### Start Recording

1. User clicks "Record" in the popup.
2. Popup sends `{ action: "START_RECORDING" }` to service worker.
3. Service worker:
   - Gets the current active tab ID and URL.
   - Sets `isRecording = true`, `tabId`, `startUrl`.
   - Injects `content-script.js` into the tab via `chrome.scripting.executeScript`.
   - Registers `chrome.webNavigation.onCommitted` listener for navigate events.
   - Registers `chrome.webNavigation.onCompleted` listener to re-inject the content script after page navigations (content script dies on navigation).
   - Saves state to `chrome.storage.session`.
4. Popup updates UI to show "Recording..." with a stop button.

#### During Recording

- **Content script** listens for `click`, `change` events (capture phase). On each relevant event, it extracts the event data and sends it to the service worker via `chrome.runtime.sendMessage({ type: "RECORD_EVENT", event: {...} })`.
- **Service worker** receives events, appends to `events[]`, saves to `chrome.storage.session`.
- **Service worker** listens for `chrome.webNavigation.onCommitted` to capture direct navigations (filtered by `tabId` and `transitionType`).
- **Service worker** listens for `chrome.webNavigation.onCompleted` (filtered by `tabId`, `frameId === 0`) to re-inject the content script after each page load.

#### Stop Recording

1. User clicks "Stop" in the popup.
2. Popup sends `{ action: "STOP_RECORDING" }` to service worker.
3. Service worker:
   - Sets `isRecording = false`.
   - Removes navigation listeners.
   - POSTs the event log to the backend: `POST /api/recordings` with body `{ startUrl, events }`.
   - Receives a `recording_id` in the response.
   - Opens the web UI annotation page in a new tab: `{WEB_UI_URL}/recordings/{recording_id}/annotate`.
   - Clears the recording state from `chrome.storage.session`.
4. Popup updates UI back to "Record" button.

### Content Script Detail

```javascript
// content-script.js — injected into the recorded tab only

function describeElement(el) {
  return {
    text: el.innerText?.trim().substring(0, 100) || null,
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role') || null,
    ariaLabel: el.getAttribute('aria-label') || null,
  };
}

function getFieldLabel(el) {
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.innerText.trim();
  }
  return el.getAttribute('aria-label')
    || el.getAttribute('placeholder')
    || el.getAttribute('name')
    || null;
}

let lastEventTimestamp = 0;

document.addEventListener('click', (e) => {
  if (e.timeStamp === lastEventTimestamp) return; // deduplicate
  lastEventTimestamp = e.timeStamp;

  const target = e.composedPath()[0]; // shadow DOM support
  chrome.runtime.sendMessage({
    type: 'RECORD_EVENT',
    event: {
      type: 'click',
      ...describeElement(target),
      pageUrl: window.location.href,
      timestamp: Date.now(),
    }
  });
}, true);

document.addEventListener('change', (e) => {
  const el = e.target;

  if (el.tagName === 'SELECT') {
    chrome.runtime.sendMessage({
      type: 'RECORD_EVENT',
      event: {
        type: 'select',
        fieldLabel: getFieldLabel(el),
        optionText: el.options[el.selectedIndex]?.text || null,
        pageUrl: window.location.href,
        timestamp: Date.now(),
      }
    });
  } else if (
    (el.tagName === 'INPUT' && !['hidden', 'checkbox', 'radio', 'file'].includes(el.type))
    || el.tagName === 'TEXTAREA'
  ) {
    chrome.runtime.sendMessage({
      type: 'RECORD_EVENT',
      event: {
        type: 'input',
        fieldLabel: getFieldLabel(el),
        value: el.type === 'password' ? '[REDACTED]' : el.value,
        pageUrl: window.location.href,
        timestamp: Date.now(),
      }
    });
  }
}, true);
```

### Service Worker Detail

```javascript
// service-worker.js

let state = { isRecording: false, tabId: null, events: [], startUrl: null };

async function saveState() {
  await chrome.storage.session.set({ recordingState: state });
}

async function restoreState() {
  const data = await chrome.storage.session.get('recordingState');
  if (data.recordingState) state = data.recordingState;
}

restoreState();

// Re-inject content script after navigation
function onNavCompleted(details) {
  if (details.tabId !== state.tabId || details.frameId !== 0) return;
  chrome.scripting.executeScript({
    target: { tabId: state.tabId },
    files: ['content-script.js'],
  });
}

// Capture direct URL navigations
function onNavCommitted(details) {
  if (details.tabId !== state.tabId || details.frameId !== 0) return;
  if (!['typed', 'auto_bookmark', 'generated'].includes(details.transitionType)) return;

  state.events.push({
    type: 'navigate',
    url: details.url,
    timestamp: Date.now(),
  });
  saveState();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'START_RECORDING') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
      const tab = tabs[0];
      state = { isRecording: true, tabId: tab.id, events: [], startUrl: tab.url };

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js'],
      });

      chrome.webNavigation.onCompleted.addListener(onNavCompleted);
      chrome.webNavigation.onCommitted.addListener(onNavCommitted);

      await saveState();
      sendResponse({ ok: true, tabId: tab.id });
    });
    return true; // async response
  }

  if (msg.action === 'STOP_RECORDING') {
    state.isRecording = false;
    chrome.webNavigation.onCompleted.removeListener(onNavCompleted);
    chrome.webNavigation.onCommitted.removeListener(onNavCommitted);

    // POST to backend
    fetch(`${BACKEND_URL}/api/recordings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startUrl: state.startUrl, events: state.events }),
    })
      .then(res => res.json())
      .then(data => {
        // Open annotation page in web UI
        chrome.tabs.create({ url: `${WEB_UI_URL}/recordings/${data.recording_id}/annotate` });
        state = { isRecording: false, tabId: null, events: [], startUrl: null };
        saveState();
        sendResponse({ ok: true, recordingId: data.recording_id });
      });
    return true; // async response
  }

  if (msg.type === 'RECORD_EVENT' && state.isRecording) {
    state.events.push(msg.event);
    saveState();
  }

  if (msg.action === 'GET_STATE') {
    sendResponse({ isRecording: state.isRecording, eventCount: state.events.length });
    return false;
  }
});
```

### Popup UI

Minimal — two states:

**Not recording:**
- "Record" button
- Brief instructions: "Click Record, then perform your workflow in the active tab."

**Recording:**
- "Stop" button
- Event counter: "12 actions recorded"
- Red recording indicator dot

```html
<!-- popup.html -->
<div id="idle">
  <p>Click Record to start capturing your workflow.</p>
  <button id="startBtn">Record</button>
</div>
<div id="recording" style="display:none;">
  <p>🔴 Recording... <span id="count">0</span> actions</p>
  <button id="stopBtn">Stop</button>
</div>
```

---

## Backend API Contract

The extension talks to one endpoint:

### `POST /api/recordings`

**Request:**
```json
{
  "startUrl": "https://amazon.com",
  "events": [
    { "type": "click", "text": "Search", "tag": "button", "role": null, "ariaLabel": "Search", "pageUrl": "https://amazon.com", "timestamp": 1709000000000 },
    { "type": "input", "fieldLabel": "Search Amazon", "value": "wireless mouse", "pageUrl": "https://amazon.com", "timestamp": 1709000001000 },
    { "type": "click", "text": "Logitech M720 Triathlon...", "tag": "a", "role": null, "ariaLabel": null, "pageUrl": "https://amazon.com/s?k=wireless+mouse", "timestamp": 1709000005000 }
  ]
}
```

**Response:**
```json
{
  "recording_id": "rec_abc123"
}
```

The extension then redirects to: `{WEB_UI_URL}/recordings/rec_abc123/annotate`

---

## Configuration

One constant in the service worker, configurable for dev/prod:

```javascript
const BACKEND_URL = 'http://localhost:8000';
const WEB_UI_URL = 'http://localhost:3000';
```

---

## Scope Boundaries

- **Single tab only.** No multi-tab, no popup tracking.
- **No iframe capture.** `allFrames: false`. Cross-origin iframes are a rabbit hole.
- **No file uploads.** Captured as a click, but file path is not recorded.
- **Passwords redacted.** `type="password"` fields log `[REDACTED]` instead of the value.
- **No hover events.** Hover-triggered menus are a known limitation.
- **No drag-and-drop.** Out of scope for hackathon.
