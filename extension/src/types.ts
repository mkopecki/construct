export interface NavigateEvent {
  type: "navigate";
  url: string;
  timestamp: number;
}

export interface ClickEvent {
  type: "click";
  text: string | null;
  tag: string;
  role: string | null;
  ariaLabel: string | null;
  pageUrl: string;
  timestamp: number;
}

export interface InputEvent {
  type: "input";
  fieldLabel: string | null;
  value: string;
  pageUrl: string;
  timestamp: number;
}

export interface SelectEvent {
  type: "select";
  fieldLabel: string | null;
  optionText: string | null;
  pageUrl: string;
  timestamp: number;
}

export type RecordedEvent =
  | NavigateEvent
  | ClickEvent
  | InputEvent
  | SelectEvent;

export interface RecordingState {
  isRecording: boolean;
  tabId: number | null;
  events: RecordedEvent[];
  startUrl: string | null;
}
