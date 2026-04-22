const DEFAULT_STATE = {
  listSelector: "",
  listXPath: "",
  listPreviewText: "",
  listPreviewCount: 0,
  pagination: {
    mode: "none",
    selector: "",
  },
  fields: {
    title: null,
    price: null,
    link: null,
    image: null,
  },
  previewRows: [],
};

document.addEventListener("DOMContentLoaded", async () => {
  bindFieldButtons();
  document.getElementById("stopSelection").addEventListener("click", stopSelection);
  document.getElementById("clearSelection").addEventListener("click", clearSelection);
  document.getElementById("saveConfig").addEventListener("click", saveConfig);
  await hydrateState();
});

async function bindFieldButtons() {
  const buttons = document.querySelectorAll("[data-field]");
  for (const button of buttons) {
    button.addEventListener("click", async () => {
      const fieldType = button.getAttribute("data-field");
      const tab = await getActiveTab();
      if (!tab?.id) return;

      setStatus(`Selecting ${fieldType} on the page...`);
      await sendMessage({
        type: "ensure-content-script",
        tabId: tab.id,
      });
      await sendMessage({
        type: "start-selection",
        tabId: tab.id,
        fieldType,
      });
      window.close();
    });
  }
}

async function hydrateState() {
  try {
    const response = await sendMessage({ type: "get-state" });
    const state = response.state || DEFAULT_STATE;
    renderState(state);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

async function stopSelection() {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await sendMessage({ type: "stop-selection", tabId: tab.id });
  setStatus("Selection mode stopped.");
}

async function clearSelection() {
  const tab = await getActiveTab();
  const response = await sendMessage({ type: "clear-state", tabId: tab?.id });
  renderState(response.state || DEFAULT_STATE);
  setStatus("Selection state cleared.");
}

async function saveConfig() {
  try {
    const response = await sendMessage({ type: "get-state" });
    const selectionState = response.state || DEFAULT_STATE;

    const payload = {
      apiBaseUrl: document.getElementById("apiBaseUrl").value.trim(),
      automationId: document.getElementById("automationId").value.trim(),
      automationName: document.getElementById("automationName").value.trim(),
      startUrl: document.getElementById("startUrl").value.trim(),
      webhookUrl: document.getElementById("webhookUrl").value.trim(),
      previewRows: selectionState.previewRows || [],
      selectionState,
    };

    await sendMessage({
      type: "save-config",
      payload,
    });

    setStatus("Config pushed to Maxun.");
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

function renderState(state) {
  document.getElementById("listSelector").value = state.listSelector || "";
  document.getElementById("paginationSummary").value = buildPaginationSummary(state.pagination);
  document.getElementById("preview").textContent = JSON.stringify(state.previewRows || [], null, 2);
  document.getElementById("chips").innerHTML = buildChips(state);
}

function buildChips(state) {
  const chips = [];
  if (state.listPreviewCount) {
    chips.push(`<span class="pill">List items: ${escapeHtml(String(state.listPreviewCount))}</span>`);
  }
  Object.entries(state.fields || {}).forEach(([fieldName, value]) => {
    if (value?.selector) {
      chips.push(`<span class="pill">${escapeHtml(fieldName)}: ${escapeHtml(value.selector)}</span>`);
    }
  });
  return chips.length > 0 ? chips.join("") : '<span class="muted">No fields selected yet.</span>';
}

function buildPaginationSummary(pagination) {
  if (!pagination || pagination.mode === "none") return "No pagination detected";
  if (pagination.selector) return `${pagination.mode} (${pagination.selector})`;
  return pagination.mode;
}

function setStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.style.color = isError ? "#b91c1c" : "#4b5563";
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Extension request failed"));
        return;
      }
      resolve(response);
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
