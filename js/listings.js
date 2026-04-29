let cachedCategories = [];

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function showStatus(form, message, isError) {
  let el = form.querySelector("#listing-status");
  if (!el) {
    el = document.createElement("p");
    el.id = "listing-status";
    form.appendChild(el);
  }
  el.textContent = message;
  el.style.color = isError ? "#c0392b" : "#1e8449";
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("ItemForm");
  const categorySelect = document.getElementById("category");
  if (!form || !categorySelect) return;

  try {
    const res = await fetch(`${window.ACITY_API_BASE}/category`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not load categories");
    cachedCategories = data.categories || [];

    categorySelect.innerHTML =
      '<option value="">Select category</option>' +
      cachedCategories
        .map(
          (c) =>
            `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.type)})</option>`
        )
        .join("");
  } catch (e) {
    categorySelect.innerHTML = `<option value="">Error loading categories</option>`;
    showStatus(form, e.message, true);
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const raw = localStorage.getItem("acityUser") || localStorage.getItem("user");
    if (!raw) {
      showStatus(form, "Please log in first.", true);
      window.location.href = "login.html";
      return;
    }

    let user;
    try {
      user = JSON.parse(raw);
    } catch {
      showStatus(form, "Invalid session. Please log in again.", true);
      return;
    }

    const fd = new FormData(form);
    const title = String(fd.get("title") || "").trim();
    const description = String(fd.get("description") || "").trim();
    const categoryId = String(fd.get("category") || "");

    const cat = cachedCategories.find((c) => c.id === categoryId);
    if (!cat) {
      showStatus(form, "Pick a category.", true);
      return;
    }

    const payload = {
      userId: user.id,
      title,
      description,
      categoryId,
      listingType: cat.type,
    };

    const btn = form.querySelector(".Add-button");
    if (btn) btn.disabled = true;
    showStatus(form, "Creating listing…", false);

    try {
      const imagesInput = document.getElementById("images");
      if (imagesInput && imagesInput.files && imagesInput.files.length > 0) {
        showStatus(form, "Uploading images…", false);
        const upFd = new FormData();
        upFd.append("userId", user.id);
        for (let i = 0; i < imagesInput.files.length; i++) {
          upFd.append("images", imagesInput.files[i]);
        }
        const upRes = await fetch(
          `${window.ACITY_API_BASE}/listings/upload-images`,
          {
            method: "POST",
            body: upFd,
          }
        );
        const upData = await upRes.json().catch(() => ({}));
        if (!upRes.ok) {
          throw new Error(
            upData.message || upData.error || "Image upload failed"
          );
        }
        if (Array.isArray(upData.paths) && upData.paths.length > 0) {
          payload.imageUrls = upData.paths;
        }
      }

      showStatus(form, "Saving listing…", false);

      const res = await fetch(`${window.ACITY_API_BASE}/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Create failed");

      showStatus(form, "Listing created. Redirecting…", false);
      setTimeout(() => {
        window.location.href = "marketplace.html";
      }, 800);
    } catch (err) {
      showStatus(form, err.message || "Failed", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});
