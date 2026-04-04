const BASE_URL = "https://pockaa.ritavdas.com";

const STORE = {
  userId: "pockaa_user_id",
};

// ── State ──
let allTags = [];
let selectedTagIds = new Set();
let currentUrl = "";

// ── DOM refs ──
const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  const mainEl = $("main");

  // Load stored credentials
  const stored = await chrome.storage.local.get([STORE.userId]);
  const userId = stored[STORE.userId];

  // Get current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url || "";

  if (!userId) {
    showOnboarding(userId);
  } else {
    showMain(userId);
  }

  // Settings toggle
  $("settingsToggle").addEventListener("click", () => {
    const settingsEl = $("settings");
    if (settingsEl.classList.contains("hidden")) {
      showSettings();
    } else {
      hideSettings();
    }
  });
});

// ── Screens ──

function showOnboarding(existingUserId) {
  $("onboarding").classList.remove("hidden");
  $("settings").classList.add("hidden");
  $("main").classList.add("hidden");

  const loginBtn = $("onboardLogin");
  const loginStatusEl = $("loginStatus");
  const loginStepLabel = $("loginStepLabel");

  // Check if already logged in
  if (existingUserId) {
    loginStepLabel.innerHTML =
      '<span class="step-check">✓</span> Account connected';
    loginStatusEl.textContent = "Already connected.";
    loginBtn.textContent = "Open Pockaa";

    // Already good — go straight to main
    showMain(existingUserId);
    return;
  }

  // Login flow
  loginBtn.addEventListener("click", async () => {
    chrome.tabs.create({ url: `${BASE_URL}/extension-auth` });
    loginStatusEl.textContent = "Waiting for login…";

    // Poll for userId to appear in storage (set by content script)
    const poll = setInterval(async () => {
      const s = await chrome.storage.local.get(STORE.userId);
      if (s[STORE.userId]) {
        clearInterval(poll);
        loginStepLabel.innerHTML =
          '<span class="step-check">✓</span> Account connected';
        loginStatusEl.textContent = "Connected!";
        setTimeout(() => showMain(s[STORE.userId]), 600);
      }
    }, 1000);
  });
}

async function showMain(userId) {
  $("onboarding").classList.add("hidden");
  $("settings").classList.add("hidden");
  $("main").classList.remove("hidden");

  $("currentUrl").textContent = currentUrl || "No URL detected";

  await loadTags(userId);
  setupTagUI(userId);
  setupSaveButton(userId);
}

function showSettings() {
  $("main").classList.add("hidden");
  $("onboarding").classList.add("hidden");
  $("settings").classList.remove("hidden");

  chrome.storage.local.get([STORE.userId], (s) => {
    if (s[STORE.userId]) {
      $("connectedBadge").textContent = `✓ ${s[STORE.userId].slice(0, 16)}…`;
    }
  });

  $("reconnectBtn").onclick = () => {
    chrome.tabs.create({ url: `${BASE_URL}/extension-auth` });
  };

  $("logoutBtn").onclick = async () => {
    await chrome.storage.local.remove(STORE.userId);
    showOnboarding(null);
  };
}

function hideSettings() {
  $("settings").classList.add("hidden");
  chrome.storage.local.get([STORE.userId], (s) => {
    if (s[STORE.userId]) {
      showMain(s[STORE.userId]);
    }
  });
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

function setupTagUI(userId) {
  renderQuickTags();
  setupTagSearch(userId);
}

function renderQuickTags() {
  const container = $("quickTags");
  container.innerHTML = "";

  // Top 5 by bookmark count
  const top5 = allTags.slice(0, 5);
  if (top5.length === 0) {
    container.innerHTML =
      '<span style="font-size:11px;color:#bbb;">No tags yet</span>';
    return;
  }

  top5.forEach((tag) => {
    const pill = createTagPill(tag, true);
    container.appendChild(pill);
  });

  // Also render any selected tags not in top 5
  const top5Ids = new Set(top5.map((t) => t.id));
  for (const tagId of selectedTagIds) {
    if (!top5Ids.has(tagId)) {
      const tag = allTags.find((t) => t.id === tagId);
      if (tag) {
        const pill = createTagPill(tag, true);
        container.appendChild(pill);
      }
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
    });
  }

  return pill;
}

function setupTagSearch(userId) {
  const input = $("tagSearch");
  const dropdown = $("tagDropdown");

  input.addEventListener("focus", () => {
    renderDropdown("", userId);
    dropdown.classList.add("open");
  });

  input.addEventListener("input", () => {
    renderDropdown(input.value.trim(), userId);
    dropdown.classList.add("open");
  });

  // Close dropdown on outside click
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
      } catch {
        createOpt.textContent = "Failed to create tag";
      }
    });
    dropdown.appendChild(createOpt);
  }
}

// ── Save ──

function setupSaveButton(userId) {
  const saveBtn = $("saveBtn");

  // Remove old listeners by cloning
  const newBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newBtn, saveBtn);

  newBtn.addEventListener("click", async () => {
    if (!currentUrl) {
      showStatus("status", "No URL to save", "error");
      return;
    }

    newBtn.disabled = true;
    newBtn.innerHTML = '<span class="spinner"></span>Saving…';
    $("status").style.display = "none";

    try {
      const body = {
        url: currentUrl,
        userId,
      };

      if (selectedTagIds.size > 0) {
        body.tagIds = Array.from(selectedTagIds);
      }

      const response = await fetch(`${BASE_URL}/api/extension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      showStatus("status", "✓ Saved to Pockaa!", "success");
      newBtn.textContent = "✓ Saved";
      selectedTagIds.clear();
      renderQuickTags();
    } catch (err) {
      showStatus("status", `Failed: ${err.message}`, "error");
    } finally {
      newBtn.disabled = false;
      setTimeout(() => {
        newBtn.textContent = "Save to Pockaa";
      }, 2000);
    }
  });
}

// ── Helpers ──

function showStatus(elementId, message, type) {
  const el = $(elementId);
  el.textContent = message;
  el.className = `status ${type}`;
  setTimeout(() => {
    el.style.display = "none";
  }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
