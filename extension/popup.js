const BASE_URL = "https://pockaa.ritavdas.com";

const STORE = {
  userId: "pockaa_user_id",
};

// ── State ──
let allTags = [];
let selectedTagIds = new Set();
let currentUrl = "";
let currentUserId = "";
let savedBookmarkId = null;

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
    chrome.tabs.create({ url: `${BASE_URL}/dashboard` });
  });
});

// ── Auto-save flow ──

async function startAutoSave(userId) {
  if (!currentUrl) {
    showErrorState("No URL detected", "Open a web page and try again.");
    return;
  }

  // Show saving spinner
  $("savingUrl").textContent = cleanUrl(currentUrl);
  showView("stateSaving");

  try {
    // Step 1: Check if URL already exists
    const checkRes = await fetch(
      `${BASE_URL}/api/extension/check?url=${encodeURIComponent(currentUrl)}`,
      { headers: { "X-User-Id": userId } }
    );

    if (!checkRes.ok) {
      const errData = await checkRes.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${checkRes.status}`);
    }

    const checkData = await checkRes.json();

    if (checkData.exists) {
      // Already saved — show existing bookmark info
      showExistsState(checkData.bookmark);
    } else {
      // New URL — auto-save it
      const saveRes = await fetch(`${BASE_URL}/api/extension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl, userId }),
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${saveRes.status}`);
      }

      const saveData = await saveRes.json();
      savedBookmarkId = saveData.bookmark?.id;
      showSavedState(saveData.bookmark, userId);
    }
  } catch (err) {
    showErrorState(err.message, "Check your connection and try again.");
  }
}

// ── State views ──

function showSavedState(bookmark, userId) {
  const domain = bookmark?.domain || getDomain(currentUrl);
  $("savedMeta").textContent = `${domain} · just now`;

  const readerId = bookmark?.id;
  const readerLink = $("openReaderLink");
  if (readerId) {
    readerLink.href = `${BASE_URL}/reader/${readerId}`;
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
  $("existsReaderLink").href = `${BASE_URL}/reader/${readerId}`;
  $("existsDashboardLink").href = `${BASE_URL}/dashboard`;

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

  newBtn.addEventListener("click", async () => {
    chrome.tabs.create({ url: `${BASE_URL}/extension-auth` });
    loginStatusEl.textContent = "Waiting for login…";

    const poll = setInterval(async () => {
      const s = await chrome.storage.local.get(STORE.userId);
      if (s[STORE.userId]) {
        clearInterval(poll);
        loginStepLabel.innerHTML =
          '<span class="step-check">✓</span> Account connected';
        loginStatusEl.textContent = "Connected!";
        currentUserId = s[STORE.userId];
        setTimeout(() => startAutoSave(currentUserId), 600);
      }
    }, 1000);
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
      $("connectedBadge").textContent = `✓ ${truncated}…`;
    }
  });

  $("reconnectBtn").onclick = () => {
    chrome.tabs.create({ url: `${BASE_URL}/extension-auth` });
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
    renderDropdown("", userId);
    dropdown.classList.add("open");
  });

  freshInput.addEventListener("input", () => {
    renderDropdown(freshInput.value.trim(), userId);
    dropdown.classList.add("open");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".tag-search-wrap")) {
      dropdown.classList.remove("open");
    }
  });
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
