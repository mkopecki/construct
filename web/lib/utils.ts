import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceStrict } from "date-fns";
import type { RecordedEvent } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return format(new Date(iso), "MMM d, yyyy h:mm a");
}

export function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  return formatDistanceStrict(new Date(start), new Date(end));
}

export function eventToStepDescription(event: RecordedEvent): string {
  switch (event.type) {
    case "navigate":
      return `Navigate to ${event.url ?? "page"}`;
    case "click":
      return `Click on "${event.text || event.selector || "element"}"`;
    case "input":
      return `Type "${event.value ?? ""}" into ${event.selector || "field"}`;
    case "key_press":
      return `Press ${event.key ?? "key"}`;
    case "select_change":
      return `Select "${event.value ?? ""}" from ${event.selector || "dropdown"}`;
    case "scroll":
      return `Scroll on page`;
    case "go_back":
      return "Go back";
    case "go_forward":
      return "Go forward";
    default:
      return `${event.type} action`;
  }
}
