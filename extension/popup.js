const STORAGE_KEYS = {
  apiUrl: "pocketclone_api_url",
  apiKey: "pocketclone_api_key",
  userId: "pocketclone_user_id",
};

document.addEventListener("DOMContentLoaded", async () => {
  const setupEl = document.getElementById("setup");
  const mainEl = document.getElementById("main");
  const urlPreviewEl = document.getElementById("currentUrl");
  const saveBtnEl = document.getElementById("saveBtn");
  const statusEl = document.getElementById("status");
  const saveSettingsEl = document.getElementById("saveSettings");
  const toggleSettingsEl = document.getElementById("toggleSettings");

  const apiUrlInput = document.getElementById("apiUrl");
  const apiKeyInput = document.getElementById("apiKey");
  const userIdInput = document.getElementById("userId");

  // Load saved settings
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  const apiUrl = stored[STORAGE_KEYS.apiUrl];
  const apiKey = stored[STORAGE_KEYS.apiKey];
  const userId = stored[STORAGE_KEYS.userId];

  const hasSettings = apiUrl && apiKey && userId;

  if (hasSettings) {
    showMain();
    apiUrlInput.value = apiUrl;
    apiKeyInput.value = apiKey;
    userIdInput.value = userId;
  } else {
    showSetup();
  }

  // Get current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tab?.url || "";
  urlPreviewEl.textContent = currentUrl;

  // Save settings
  saveSettingsEl.addEventListener("click", async () => {
    const url = apiUrlInput.value.trim().replace(/\/$/, "");
    const key = apiKeyInput.value.trim();
    const uid = userIdInput.value.trim();

    if (!url || !key || !uid) {
      showStatus("Please fill in all fields", "error");
      return;
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.apiUrl]: url,
      [STORAGE_KEYS.apiKey]: key,
      [STORAGE_KEYS.userId]: uid,
    });

    showMain();
    showStatus("Settings saved!", "success");
  });

  // Toggle settings visibility
  toggleSettingsEl.addEventListener("click", (e) => {
    e.preventDefault();
    if (setupEl.style.display === "none") {
      showSetup();
      toggleSettingsEl.textContent = "Back";
    } else {
      showMain();
      toggleSettingsEl.textContent = "Settings";
    }
  });

  // Save bookmark
  saveBtnEl.addEventListener("click", async () => {
    if (!currentUrl) {
      showStatus("No URL to save", "error");
      return;
    }

    const settings = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
    const baseUrl = settings[STORAGE_KEYS.apiUrl];
    const token = settings[STORAGE_KEYS.apiKey];
    const uid = settings[STORAGE_KEYS.userId];

    if (!baseUrl || !token || !uid) {
      showSetup();
      showStatus("Please configure your settings first", "error");
      return;
    }

    saveBtnEl.disabled = true;
    saveBtnEl.innerHTML = '<span class="spinner"></span>Saving...';
    statusEl.style.display = "none";

    try {
      const response = await fetch(`${baseUrl}/api/extension`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: currentUrl, userId: uid }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      showStatus("✓ Saved to PocketClone!", "success");
    } catch (err) {
      showStatus(`Failed: ${err.message}`, "error");
    } finally {
      saveBtnEl.disabled = false;
      saveBtnEl.textContent = "Save to PocketClone";
    }
  });

  function showSetup() {
    setupEl.style.display = "block";
    mainEl.style.display = "none";
    toggleSettingsEl.textContent = "Back";
  }

  function showMain() {
    setupEl.style.display = "none";
    mainEl.style.display = "block";
    toggleSettingsEl.textContent = "Settings";
  }

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    setTimeout(() => {
      statusEl.style.display = "none";
    }, 4000);
  }
});
