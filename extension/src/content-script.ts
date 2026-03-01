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

  // Click listener (capture phase)
  document.addEventListener(
    "click",
    (e: MouseEvent) => {
      const now = Date.now();
      if (now === lastClickTimestamp) return;
      lastClickTimestamp = now;

      const target = e.composedPath()[0];
      if (!(target instanceof Element)) return;

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

  // Change listener (capture phase)
  document.addEventListener(
    "change",
    (e: Event) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const now = Date.now();
      const tag = target.tagName.toLowerCase();

      if (tag === "select" && target instanceof HTMLSelectElement) {
        const selectedOption = target.options[target.selectedIndex];
        chrome.runtime.sendMessage({
          type: "RECORD_EVENT",
          event: {
            type: "select",
            fieldLabel: getFieldLabel(target),
            optionText: selectedOption?.textContent?.trim() || null,
            pageUrl: location.href,
            timestamp: now,
          },
        });
        return;
      }

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        const inputType = (target.getAttribute("type") || "text").toLowerCase();
        const skip = ["hidden", "checkbox", "radio", "file", "submit", "reset", "button", "image"];
        if (skip.includes(inputType)) return;

        const isPassword = inputType === "password";
        chrome.runtime.sendMessage({
          type: "RECORD_EVENT",
          event: {
            type: "input",
            fieldLabel: getFieldLabel(target),
            value: isPassword ? "[REDACTED]" : target.value,
            pageUrl: location.href,
            timestamp: now,
          },
        });
      }
    },
    true
  );
}

export {};
