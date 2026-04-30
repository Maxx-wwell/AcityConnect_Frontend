function getStoredUser() {
  const raw =
    localStorage.getItem("acityUser") || localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isLoggedIn() {
  const u = getStoredUser();
  return !!(u && u.id);
}

async function fetchMyInterestedListingIds(userId) {
  const url = new URL(`${window.ACITY_API_BASE}/interests/me`);
  url.searchParams.set("userId", userId);
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return new Set();
  const ids = new Set();
  for (const row of data.interests || []) {
    if (row.listing && row.listing.id) ids.add(row.listing.id);
  }
  return ids;
}

async function fetchListings(params) {
  const url = new URL(`${window.ACITY_API_BASE}/listings`);
  if (params.listingType)
    url.searchParams.set("listingType", params.listingType);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.interestedUserId)
    url.searchParams.set("interestedUserId", params.interestedUserId);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.message || data.error || "Failed to load listings");
  return data.listings || [];
}

function bindListingActions(container, user, interestedIds) {
  const apiBase = window.ACITY_API_BASE;

  container.querySelectorAll(".interest-btn[data-listing-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isLoggedIn()) {
        window.location.href = "login.html";
        return;
      }
      const listingId = btn.getAttribute("data-listing-id");
      if (!listingId || btn.disabled) return;

      btn.disabled = true;
      try {
        const res = await fetch(`${apiBase}/interests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId, userId: user.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || data.error || "Could not save interest");
        btn.textContent = "Interested";
        btn.setAttribute("aria-label", "You are interested in this listing");
        interestedIds.add(listingId);
      } catch (err) {
        btn.disabled = false;
        alert(err.message || "Interest failed");
      }
    });
  });

  container.querySelectorAll(".trade-btn[data-listing-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isLoggedIn()) {
        window.location.href = "login.html";
        return;
      }
      const listingId = btn.getAttribute("data-listing-id");
      if (!listingId || btn.disabled) return;

      btn.disabled = true;
      try {
        const res = await fetch(`${apiBase}/trades`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId, requesterId: user.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            data.message || data.error || "Could not request trade"
          );
        btn.textContent = "Trade requested";
      } catch (err) {
        btn.disabled = false;
        alert(err.message || "Trade request failed");
      }
    });
  });

  container.querySelectorAll(".delete-btn[data-listing-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isLoggedIn()) {
        window.location.href = "login.html";
        return;
      }
      const listingId = btn.getAttribute("data-listing-id");
      if (!listingId || !user || !user.id) return;
      if (!confirm("Delete this listing?")) return;

      btn.disabled = true;
      try {
        const url = new URL(`${apiBase}/listings/${listingId}`);
        url.searchParams.set("userId", user.id);
        const res = await fetch(url.toString(), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || data.error || "Delete failed");
        btn.textContent = "Deleted";
        btn.classList.add("disabled");
        btn.style.opacity = "0.6";
        btn.closest(".card")?.remove();
      } catch (err) {
        btn.disabled = false;
        alert(err.message || "Delete failed");
      }
    });
  });

  container.querySelectorAll(".report-btn[data-listing-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isLoggedIn()) {
        window.location.href = "login.html";
        return;
      }
      const listingId = btn.getAttribute("data-listing-id");
      if (!listingId) return;
      const reason = window.prompt("Briefly describe the issue (required):");
      if (!reason || !String(reason).trim()) return;

      btn.disabled = true;
      try {
        const res = await fetch(`${apiBase}/reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            reportedBy: user.id,
            reason: String(reason).trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || data.error || "Report failed");
        btn.textContent = "Reported";
      } catch (err) {
        btn.disabled = false;
        alert(err.message || "Report failed");
      }
    });
  });
}

function listingPhotoUrl(item) {
  const first =
    item.images &&
    item.images[0] &&
    typeof item.images[0].imageUrl === "string"
      ? item.images[0].imageUrl.trim()
      : "";
  if (first && /^https:\/\//i.test(first)) return first;
  return "https://via.placeholder.com/320x200?text=Listing";
}

function renderCards(listings, container, user, interestedIds) {
  container.innerHTML = "";
  const loggedIn = isLoggedIn();

  if (!listings.length) {
    container.innerHTML =
      "<p>No listings match your filters. Try adjusting search or category.</p>";
    return;
  }

  listings.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";

    const provider =
      item.user && item.user.email ? item.user.email.split("@")[0] : "Student";
    const catLabel =
      item.category && item.category.type === "SKILL" ? "Skill" : "Item";

    const listingIdAttr = escapeHtml(String(item.id));
    const listingQuery = encodeURIComponent(String(item.id));
    const ownerId = item.user && item.user.id ? String(item.user.id) : "";
    const isOwn =
      loggedIn && user && ownerId && ownerId === String(user.id);

    let actionsHtml;
    if (!loggedIn) {
      actionsHtml = `
      <a class="interest-btn" href="login.html">Interest</a>
      <a class="trade-btn" href="login.html">Trade</a>
      <a class="message-btn" href="login.html">Message</a>
      <button type="button" class="report-btn ghost" data-listing-id="${listingIdAttr}" disabled title="Sign in to report">Report</button>
    `;
    } else if (isOwn) {
      actionsHtml = `
      <p class="listing-meta"><small>Your listing</small></p>
      <button type="button" class="message-btn" onclick="window.location.href='messages.html?listing=${listingQuery}'">Messages</button>
      <button type="button" class="delete-btn ghost" data-listing-id="${listingIdAttr}">Delete</button>
        `;
    } else {
      const already =
        interestedIds && interestedIds.has(item.id);
      const interestLabel = already ? "Interested" : "Interest";
      const interestDisabled = already ? "disabled" : "";
      actionsHtml = `
      <button type="button" class="interest-btn" data-listing-id="${listingIdAttr}" ${interestDisabled}>${escapeHtml(interestLabel)}</button>
      <button type="button" class="trade-btn" data-listing-id="${listingIdAttr}">Request trade</button>
      <a class="message-btn" href="messages.html?listing=${listingQuery}">Message</a>
      <button type="button" class="report-btn ghost" data-listing-id="${listingIdAttr}">Report</button>
    `;
    }

    card.innerHTML = `
      <img class="listing-photo" src="" alt="">
      <h3>${escapeHtml(item.title)}</h3>
      <p>Category: <b>${escapeHtml(catLabel)}</b></p>
      <p>Provider: <b>${escapeHtml(provider)}</b></p>
      <p class="listing-status">Status: <b>${escapeHtml(item.status)}</b></p>
      <p class="listing-description">${escapeHtml(item.description || "")}</p>
      ${actionsHtml}
    `;
    const photoEl = card.querySelector(".listing-photo");
    if (photoEl) {
      photoEl.src = listingPhotoUrl(item);
      photoEl.alt = item.title ? String(item.title) : "Listing";
    }
    container.appendChild(card);
  });

  bindListingActions(container, user || {}, interestedIds || new Set());
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("listings-grid");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");

  if (!grid) return;

  async function refresh() {
    const user = getStoredUser();
    let interestedIds = new Set();
    if (user && user.id) {
      interestedIds = await fetchMyInterestedListingIds(user.id);
    }

    try {
      const q = searchInput ? searchInput.value.trim() : "";
      let listingType;
      let interestedUserId;

      const cf = categoryFilter ? categoryFilter.value : "All";
      if (cf === "Items") listingType = "ITEM";
      else if (cf === "Skills") listingType = "SKILL";
      else if (cf === "Interest") {
        if (!user || !user.id) {
          grid.innerHTML =
            "<p>Sign in to filter listings you’ve marked as <strong>Interested</strong>.</p>";
          return;
        }
        interestedUserId = user.id;
      } else listingType = undefined;

      grid.innerHTML = "<p>Loading…</p>";
      const listings = await fetchListings({
        q: q || undefined,
        listingType,
        interestedUserId,
      });
      renderCards(listings, grid, user, interestedIds);
    } catch (e) {
      grid.innerHTML = `<p style="color:#900">${escapeHtml(e.message)}</p>`;
    }
  }

  if (searchInput) {
    let t;
    searchInput.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(refresh, 300);
    });
  }
  if (categoryFilter) categoryFilter.addEventListener("change", refresh);

  const logoutLink = document.getElementById("nav-logout");
  if (logoutLink) {
    logoutLink.addEventListener("click", () => {
      localStorage.removeItem("acityUser");
      localStorage.removeItem("user");
    });
  }

  await refresh();
});
