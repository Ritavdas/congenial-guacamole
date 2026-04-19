const BASE_URL = "https://pockaa.ritavdas.com";

const STORE = {
  userId: "pockaa_user_id",
};

// ── State ──
let allTags = [];
let selectedTagIds = new Set();
let currentUrl = "";
let currentTitle = "";
let currentUserId = "";
let savedBookmarkId = null;
let dropdownActiveIdx = -1;

// ── DOM refs ──
const $ = (id) => document.getElementById(id);

// All state view IDs
const STATE_VIEWS = [
  "onboarding",
  "settings",
  "stateSaving",
  "stateSaved",
  "stateExists",
  "stateError",
];

function showView(viewId) {
  STATE_VIEWS.forEach((id) => {
    const el = $(id);
    if (id === viewId) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
}

// ── Boot ──

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get([STORE.userId]);
  const userId = stored[STORE.userId];

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url || "";
  currentTitle = tab?.title || "";

  if (!userId) {
    showOnboarding();
  } else {
    currentUserId = userId;
    await startAutoSave(userId);
  }

  // Settings toggle
  $("settingsToggle").addEventListener("click", () => {
    const settingsEl = $("settings");
    if (settingsEl.classList.contains("active")) {
      // Go back to the appropriate main view
      restoreMainView();
    } else {
      showSettingsPanel();
    }
  });

  // Retry button
  $("retryBtn").addEventListener("click", () => {
    if (currentUserId) startAutoSave(currentUserId);
  });

  // Edit tags → opens in Pockaa web UI
  $("editTagsBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: `${BASE_URL}/` });
  });
});

// ── Auto-save flow ──

async function startAutoSave(userId) {
  if (!currentUrl) {
    showErrorState(
      "No active page",
      "Open a web page in this tab and try again.",
    );
    return;
  }

  // Block chrome:// and other unsavable URLs early
  if (
    /^(chrome|chrome-extension|edge|about|file|view-source):/i.test(currentUrl)
  ) {
    showErrorState(
      "Can't save this page",
      "Browser pages and local files can't be saved.",
    );
    return;
  }

  // Show saving spinner
  $("savingUrl").textContent = cleanUrl(currentUrl);
  showView("stateSaving");

  try {
    const res = await fetch(`${BASE_URL}/api/extension/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl, userId }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const message = errData.error || `HTTP ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();

    if (data.action === "existing") {
      showExistsState(data.bookmark);
    } else {
      savedBookmarkId = data.bookmark?.id;
      showSavedState(data.bookmark, userId);
    }
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      showErrorState(
        "Not signed in",
        "Your session expired. Re-login from settings.",
      );
    } else if (err.status >= 500) {
      showErrorState(
        "Server error",
        "Pockaa is having trouble. Try again shortly.",
      );
    } else if (err.status === 400) {
      showErrorState("Invalid URL", "This page can't be saved.");
    } else if (
      err.name === "TypeError" ||
      /Failed to fetch|NetworkError/i.test(err.message)
    ) {
      showErrorState("Offline", "Check your internet connection and retry.");
    } else {
      showErrorState(err.message || "Couldn't save", "Try again in a moment.");
    }
  }
}

// ── State views ──

function showSavedState(bookmark, userId) {
  const domain = bookmark?.domain || getDomain(currentUrl);
  const title = bookmark?.title || currentTitle || domain;
  $("savedTitle").textContent = title;
  $("savedMeta").textContent = `${domain} · just now`;

  const readerId = bookmark?.id;
  const readerLink = $("openReaderLink");
  if (readerId) {
    readerLink.href = `${BASE_URL}/read/${readerId}`;
    readerLink.style.display = "block";
  } else {
    readerLink.style.display = "none";
  }

  showView("stateSaved");

  // Load tags and set up tag UI
  loadTags(userId).then(() => {
    setupTagUI(userId, bookmark);
  });
}

function showExistsState(bookmark) {
  $("existsTitle").textContent = bookmark.title || getDomain(currentUrl);

  const domain = bookmark.domain || getDomain(currentUrl);
  const timeAgo = bookmark.createdAt ? formatTimeAgo(bookmark.createdAt) : "";
  $("existsMeta").textContent = timeAgo
    ? `${domain} · Saved ${timeAgo}`
    : domain;

  // Render existing tags (read-only)
  const tagsContainer = $("existsTags");
  tagsContainer.innerHTML = "";
  if (bookmark.tags && bookmark.tags.length > 0) {
    bookmark.tags.forEach((tag) => {
      const pill = document.createElement("span");
      pill.className = "tag-pill readonly selected";
      pill.style.borderColor = tag.color;
      pill.style.background = tag.color;
      pill.style.color = "white";
      pill.textContent = tag.name;
      tagsContainer.appendChild(pill);
    });
  }

  // Set up action links
  const readerId = bookmark.id;
  $("existsReaderLink").href = `${BASE_URL}/read/${readerId}`;
  $("existsDashboardLink").href = `${BASE_URL}/`;

  showView("stateExists");
}

function showErrorState(errorMsg, hint) {
  $("errorUrl").textContent = cleanUrl(currentUrl);
  $("errorMessage").textContent = `${errorMsg}. ${hint || ""}`;
  showView("stateError");
}

// ── Onboarding ──

function showOnboarding() {
  showView("onboarding");

  const loginBtn = $("onboardLogin");
  const loginStatusEl = $("loginStatus");
  const loginStepLabel = $("loginStepLabel");

  // Clone to remove old listeners
  const newBtn = loginBtn.cloneNode(true);
  loginBtn.parentNode.replaceChild(newBtn, loginBtn);

  // Listen for storage changes for instant pickup (popup-open case)
  const storageListener = (changes, area) => {
    if (area !== "local") return;
    if (changes[STORE.userId] && changes[STORE.userId].newValue) {
      onLoginDetected(changes[STORE.userId].newValue);
    }
  };
  chrome.storage.onChanged.addListener(storageListener);

  function onLoginDetected(userId) {
    chrome.storage.onChanged.removeListener(storageListener);
    loginStepLabel.innerHTML =
      '<span class="step-check">✓</span> Account connected';
    loginStatusEl.textContent = "Connected!";
    newBtn.disabled = true;
    newBtn.textContent = "Connected";
    currentUserId = userId;
    setTimeout(() => startAutoSave(currentUserId), 500);
  }

  newBtn.addEventListener("click", async () => {
    newBtn.disabled = true;
    newBtn.textContent = "Opening login…";
    loginStatusEl.textContent = "Waiting for login…";

    const authUrl = `${BASE_URL}/extension-auth`;

    // Reuse existing auth tab if one is already open, otherwise create it
    try {
      const existing = await chrome.tabs.query({ url: `${authUrl}*` });
      if (existing && existing.length > 0) {
        await chrome.tabs.update(existing[0].id, { active: true });
        await chrome.windows.update(existing[0].windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: authUrl });
      }
    } catch {
      // Fallback: just create
      chrome.tabs.create({ url: authUrl });
    }

    newBtn.textContent = "Login to Pockaa";
    newBtn.disabled = false;

    // Safety net: also poll in case storage event was missed
    // (e.g., write happened before listener attached)
    const poll = setInterval(async () => {
      const s = await chrome.storage.local.get(STORE.userId);
      if (s[STORE.userId]) {
        clearInterval(poll);
        onLoginDetected(s[STORE.userId]);
      }
    }, 1000);

    // Stop polling after 5 minutes to avoid running forever
    setTimeout(() => clearInterval(poll), 5 * 60 * 1000);
  });
}

// ── Settings ──

let lastMainView = null;

function showSettingsPanel() {
  // Remember which view we came from
  lastMainView = STATE_VIEWS.find((id) => $(id).classList.contains("active"));

  showView("settings");

  chrome.storage.local.get([STORE.userId], (s) => {
    if (s[STORE.userId]) {
      const truncated = s[STORE.userId].slice(0, 16);
      $("connectedBadge").textContent = "✓ Connected";
      $("connectedUserId").textContent = `${truncated}…`;
    }
  });

  $("reconnectBtn").onclick = () => {
    chrome.tabs.create({ url: `${BASE_URL}/extension-auth` });
  };

  $("openDashboardBtn").onclick = () => {
    chrome.tabs.create({ url: `${BASE_URL}/` });
  };

  $("logoutBtn").onclick = async () => {
    await chrome.storage.local.remove(STORE.userId);
    currentUserId = "";
    lastMainView = null;
    showOnboarding();
  };
}

function restoreMainView() {
  if (lastMainView && lastMainView !== "settings") {
    showView(lastMainView);
  } else if (currentUserId) {
    startAutoSave(currentUserId);
  } else {
    showOnboarding();
  }
}

// ── Tags ──

async function loadTags(userId) {
  try {
    const res = await fetch(`${BASE_URL}/api/extension/tags`, {
      headers: { "X-User-Id": userId },
    });
    if (!res.ok) throw new Error("Failed to fetch tags");
    const data = await res.json();
    allTags = data.tags || [];
  } catch {
    allTags = [];
  }
}

function setupTagUI(userId, bookmark) {
  selectedTagIds.clear();
  renderQuickTags();
  setupTagSearch(userId, bookmark);
}

function renderQuickTags() {
  const container = $("quickTags");
  container.innerHTML = "";

  const top5 = allTags.slice(0, 5);
  if (top5.length === 0) {
    container.innerHTML =
      '<span style="font-size:11px;color:#bbb;">No tags yet</span>';
    return;
  }

  top5.forEach((tag) => {
    container.appendChild(createTagPill(tag, true));
  });

  // Render selected tags not in top 5
  const top5Ids = new Set(top5.map((t) => t.id));
  for (const tagId of selectedTagIds) {
    if (!top5Ids.has(tagId)) {
      const tag = allTags.find((t) => t.id === tagId);
      if (tag) container.appendChild(createTagPill(tag, true));
    }
  }
}

function createTagPill(tag, toggleable) {
  const pill = document.createElement("span");
  const isSelected = selectedTagIds.has(tag.id);

  pill.className = `tag-pill ${isSelected ? "selected" : "unselected"}`;
  pill.style.borderColor = tag.color;
  if (isSelected) {
    pill.style.background = tag.color;
    pill.style.color = "white";
  } else {
    pill.style.color = tag.color;
  }
  pill.textContent = tag.name;

  if (toggleable) {
    pill.addEventListener("click", () => {
      if (selectedTagIds.has(tag.id)) {
        selectedTagIds.delete(tag.id);
      } else {
        selectedTagIds.add(tag.id);
      }
      renderQuickTags();
      applyTagsToBookmark();
    });
  }

  return pill;
}

function applyTagsToBookmark() {
  if (!savedBookmarkId || !currentUserId) return;

  // Fire-and-forget: update tags on existing bookmark via PATCH
  fetch(`${BASE_URL}/api/extension`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookmarkId: savedBookmarkId,
      userId: currentUserId,
      tagIds: Array.from(selectedTagIds),
    }),
  }).catch(() => {
    // Silently fail — tags are optional
  });
}

function setupTagSearch(userId, bookmark) {
  const input = $("tagSearch");
  const dropdown = $("tagDropdown");

  // Clone to clear old listeners
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  const freshInput = $("tagSearch");

  freshInput.addEventListener("focus", () => {
    dropdownActiveIdx = -1;
    renderDropdown("", userId);
    dropdown.classList.add("open");
  });

  freshInput.addEventListener("input", () => {
    dropdownActiveIdx = -1;
    renderDropdown(freshInput.value.trim(), userId);
    dropdown.classList.add("open");
  });

  freshInput.addEventListener("keydown", (e) => {
    const options = dropdown.querySelectorAll(".tag-option");
    if (!dropdown.classList.contains("open") || options.length === 0) {
      if (e.key === "Escape") freshInput.blur();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      dropdownActiveIdx = (dropdownActiveIdx + 1) % options.length;
      updateDropdownActive(options);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      dropdownActiveIdx =
        (dropdownActiveIdx - 1 + options.length) % options.length;
      updateDropdownActive(options);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = dropdownActiveIdx >= 0 ? dropdownActiveIdx : 0;
      options[idx]?.click();
    } else if (e.key === "Escape") {
      e.preventDefault();
      dropdown.classList.remove("open");
      freshInput.blur();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".tag-search-wrap")) {
      dropdown.classList.remove("open");
    }
  });
}

function updateDropdownActive(options) {
  options.forEach((opt, i) => {
    opt.classList.toggle("active", i === dropdownActiveIdx);
  });
  const active = options[dropdownActiveIdx];
  if (active && active.scrollIntoView) {
    active.scrollIntoView({ block: "nearest" });
  }
}

function renderDropdown(query, userId) {
  const dropdown = $("tagDropdown");
  dropdown.innerHTML = "";

  const lowerQuery = query.toLowerCase();
  const filtered = query
    ? allTags.filter((t) => t.name.toLowerCase().includes(lowerQuery))
    : allTags;

  if (filtered.length === 0 && !query) {
    dropdown.innerHTML =
      '<div class="no-tags-hint">No tags yet. Type to create one.</div>';
    return;
  }

  filtered.forEach((tag) => {
    const opt = document.createElement("div");
    opt.className = "tag-option";

    const dot = document.createElement("span");
    dot.className = "tag-dot";
    dot.style.background = tag.color;
    opt.appendChild(dot);

    const name = document.createElement("span");
    name.textContent = tag.name;
    opt.appendChild(name);

    if (selectedTagIds.has(tag.id)) {
      const check = document.createElement("span");
      check.className = "check";
      check.textContent = "✓";
      opt.appendChild(check);
    }

    opt.addEventListener("click", () => {
      if (selectedTagIds.has(tag.id)) {
        selectedTagIds.delete(tag.id);
      } else {
        selectedTagIds.add(tag.id);
      }
      renderQuickTags();
      renderDropdown($("tagSearch").value.trim(), userId);
      applyTagsToBookmark();
    });

    dropdown.appendChild(opt);
  });

  // "Create new" option
  const exactMatch = allTags.some((t) => t.name.toLowerCase() === lowerQuery);
  if (query && !exactMatch) {
    const createOpt = document.createElement("div");
    createOpt.className = "tag-option create";
    createOpt.innerHTML = `<span>+ Create "<strong>${escapeHtml(query)}</strong>"</span>`;
    createOpt.addEventListener("click", async () => {
      createOpt.textContent = "Creating…";
      try {
        const res = await fetch(`${BASE_URL}/api/extension/tags`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": userId,
          },
          body: JSON.stringify({ name: query }),
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const newTag = { ...data.tag, bookmarkCount: 0 };
        allTags.unshift(newTag);
        selectedTagIds.add(newTag.id);
        $("tagSearch").value = "";
        renderQuickTags();
        dropdown.classList.remove("open");
        applyTagsToBookmark();
      } catch {
        createOpt.textContent = "Failed to create tag";
      }
    });
    dropdown.appendChild(createOpt);
  }
}

// ── Helpers ──

function cleanUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname + u.search;
  } catch {
    return url;
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatTimeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
