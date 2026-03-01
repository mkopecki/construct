const idleView = document.getElementById("idle-view")!;
const recordingView = document.getElementById("recording-view")!;
const recordBtn = document.getElementById("record-btn")!;
const stopBtn = document.getElementById("stop-btn")!;
const eventCount = document.getElementById("event-count")!;
const errorView = document.getElementById("error-view")!;
const errorMsg = document.getElementById("error-msg")!;

let pollInterval: ReturnType<typeof setInterval> | null = null;

function showIdle() {
  idleView.style.display = "block";
  recordingView.style.display = "none";
  errorView.style.display = "none";
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function showError(msg: string) {
  idleView.style.display = "none";
  recordingView.style.display = "none";
  errorView.style.display = "block";
  errorMsg.textContent = msg;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function showRecording(count: number) {
  idleView.style.display = "none";
  recordingView.style.display = "block";
  eventCount.textContent = String(count);
}

function pollState() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (response?.isRecording) {
      showRecording(response.eventCount);
    } else {
      showIdle();
    }
  });
}

// Initialize
chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
  if (response?.isRecording) {
    showRecording(response.eventCount);
    pollInterval = setInterval(pollState, 500);
  } else {
    showIdle();
  }
});

recordBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "START_RECORDING" }, (response) => {
    if (response?.success) {
      showRecording(0);
      pollInterval = setInterval(pollState, 500);
    }
  });
});

document.getElementById("dismiss-btn")!.addEventListener("click", () => {
  showIdle();
});

stopBtn.addEventListener("click", () => {
  stopBtn.setAttribute("disabled", "true");
  stopBtn.textContent = "Saving…";
  chrome.runtime.sendMessage({ type: "STOP_RECORDING" }, (response) => {
    if (response?.success) {
      showIdle();
    } else {
      showError(response?.error ?? "Failed to save recording");
    }
    stopBtn.removeAttribute("disabled");
    stopBtn.textContent = "Stop";
  });
});
