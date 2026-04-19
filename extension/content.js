// Pockaa Extension — Content script for auto-login
// Runs on the extension-auth page to capture the Clerk userId
(function () {
  const el = document.getElementById("pockaa-extension-auth");
  if (!el) return;

  const userId = el.getAttribute("data-user-id");
  if (!userId) return;

  chrome.storage.local.set({ pockaa_user_id: userId }, () => {
    const badge = document.createElement("div");
    badge.textContent = "✓ Extension connected — closing…";
    badge.style.position = "fixed";
    badge.style.bottom = "24px";
    badge.style.left = "50%";
    badge.style.transform = "translateX(-50%)";
    badge.style.background = "#166534";
    badge.style.color = "white";
    badge.style.padding = "10px 20px";
    badge.style.borderRadius = "99px";
    badge.style.fontSize = "13px";
    badge.style.fontFamily = "system-ui";
    badge.style.zIndex = "9999";
    badge.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    document.body.appendChild(badge);

    // Auto-close the tab after a short delay so the user sees confirmation
    setTimeout(() => {
      window.close();
    }, 1200);
  });
})();
