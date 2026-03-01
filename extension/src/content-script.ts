declare global {
  interface Window {
    __constructRecorderInjected?: boolean;
  }
}

if (!window.__constructRecorderInjected) {
  window.__constructRecorderInjected = true;

  let lastClickTimestamp = 0;

  function describeElement(el: Element): {
    text: string | null;
    tag: string;
    role: string | null;
    ariaLabel: string | null;
  } {
    const text = el.textContent?.trim().slice(0, 200) || null;
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    const ariaLabel = el.getAttribute("aria-label");
    return { text, tag, role, ariaLabel };
  }

  function getFieldLabel(el: Element): string | null {
    // Check for aria-label
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;

    // Check for associated <label> via id
    const id = el.getAttribute("id");
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label?.textContent) return label.textContent.trim();
    }

    // Check for wrapping <label>
    const parentLabel = el.closest("label");
    if (parentLabel?.textContent) return parentLabel.textContent.trim();

    // Check placeholder
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.placeholder) return el.placeholder;
    }

    // Check name attribute
    const name = el.getAttribute("name");
    if (name) return name;

    return null;
  }

  const interactiveTags = new Set([
    "a", "button", "input", "select", "textarea", "summary", "option",
  ]);
  const interactiveRoles = new Set([
    "button", "link", "menuitem", "tab", "checkbox", "radio",
    "switch", "option", "combobox", "textbox",
  ]);

  function findInteractiveAncestor(el: Element): Element {
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      if (
        interactiveTags.has(node.tagName.toLowerCase()) ||
        interactiveRoles.has(node.getAttribute("role") ?? "") ||
        node.hasAttribute("onclick") ||
        (node instanceof HTMLElement && node.tabIndex >= 0 && node.tagName.toLowerCase() !== "div")
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return el;
  }

  // Click listener (capture phase)
  document.addEventListener(
    "click",
    (e: MouseEvent) => {
      const now = Date.now();
      if (now === lastClickTimestamp) return;
      lastClickTimestamp = now;

      const raw = e.composedPath()[0];
      if (!(raw instanceof Element)) return;

      const target = findInteractiveAncestor(raw);
      const { text, tag, role, ariaLabel } = describeElement(target);

      chrome.runtime.sendMessage({
        type: "RECORD_EVENT",
        event: {
          type: "click",
          text,
          tag,
          role,
          ariaLabel,
          pageUrl: location.href,
          timestamp: now,
        },
      });
    },
    true
  );

  const skipInputTypes = new Set([
    "hidden", "checkbox", "radio", "file", "submit", "reset", "button", "image",
  ]);

  // Track debounce timers and last-sent values per element to avoid duplicates
  const inputTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
  const lastSentValues = new WeakMap<Element, string>();

  // Bug 6: Track elements with pending debounce timers for flush on navigation
  const pendingInputElements = new Set<HTMLInputElement | HTMLTextAreaElement>();

  function sendInputEvent(el: HTMLInputElement | HTMLTextAreaElement) {
    const inputType = (el.getAttribute("type") || "text").toLowerCase();
    if (skipInputTypes.has(inputType)) return;

    const isPassword = inputType === "password";
    const value = isPassword ? "[REDACTED]" : el.value;

    // Skip if value hasn't changed since last send
    if (lastSentValues.get(el) === value) return;
    lastSentValues.set(el, value);

    chrome.runtime.sendMessage({
      type: "RECORD_EVENT",
      event: {
        type: "input",
        fieldLabel: getFieldLabel(el),
        value,
        pageUrl: location.href,
        timestamp: Date.now(),
      },
    });
  }

  // Debounced input listener — captures typing in real time
  document.addEventListener(
    "input",
    (e: Event) => {
      const target = e.target;
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement)
      ) return;

      const prev = inputTimers.get(target);
      if (prev) clearTimeout(prev);

      pendingInputElements.add(target);
      inputTimers.set(
        target,
        setTimeout(() => {
          pendingInputElements.delete(target);
          sendInputEvent(target);
        }, 500)
      );
    },
    true
  );

  // Change listener — fires on blur, catches anything the debounce missed
  // Also handles <select> elements
  document.addEventListener(
    "change",
    (e: Event) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      if (target instanceof HTMLSelectElement) {
        const selectedOption = target.options[target.selectedIndex];
        chrome.runtime.sendMessage({
          type: "RECORD_EVENT",
          event: {
            type: "select",
            fieldLabel: getFieldLabel(target),
            optionText: selectedOption?.textContent?.trim() || null,
            pageUrl: location.href,
            timestamp: Date.now(),
          },
        });
        return;
      }

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        // Clear any pending debounce and send immediately
        const pending = inputTimers.get(target);
        if (pending) clearTimeout(pending);
        pendingInputElements.delete(target);
        sendInputEvent(target);
      }
    },
    true
  );

  // Bug 6: Flush all pending input timers before the page unloads
  window.addEventListener("beforeunload", () => {
    for (const el of pendingInputElements) {
      const timer = inputTimers.get(el);
      if (timer) clearTimeout(timer);
      sendInputEvent(el);
    }
    pendingInputElements.clear();
  });

  // ── Bug 2: SPA navigation detection ─────────────────────────────────
  let lastRecordedUrl = location.href;

  function recordSpaNavigation() {
    const currentUrl = location.href;
    if (currentUrl === lastRecordedUrl) return;
    lastRecordedUrl = currentUrl;

    chrome.runtime.sendMessage({
      type: "RECORD_EVENT",
      event: {
        type: "navigate",
        url: currentUrl,
        timestamp: Date.now(),
      },
    });
  }

  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState(...args);
    recordSpaNavigation();
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    originalReplaceState(...args);
    recordSpaNavigation();
  };

  window.addEventListener("popstate", () => {
    recordSpaNavigation();
  });
}

export {};
