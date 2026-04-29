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

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = String(s);
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = getStoredUser();
  if (!user) {
    alert("Please login first");
    window.location.href = "login.html";
    return;
  }

  if (user.role !== "ADMIN") {
    alert("Access denied — admins only.");
    window.location.href = "index.html";
    return;
  }

  const statsEl = document.getElementById("stats");
  const container = document.getElementById("allListings");
  const reportsEl = document.getElementById("adminReports");

  try {
    const [listRes, repRes] = await Promise.all([
      fetch(`${window.ACITY_API_BASE}/listings`),
      fetch(
        `${window.ACITY_API_BASE}/reports?adminUserId=${encodeURIComponent(user.id)}`
      ),
    ]);

    const data = await listRes.json();
    if (!listRes.ok) throw new Error(data.message || "Failed to load listings");

    const items = data.listings || [];

    const repData = await repRes.json().catch(() => ({}));
    if (reportsEl) {
      if (!repRes.ok) {
        reportsEl.innerHTML = `<p style="color:#900">${escapeHtml(
          repData.message || repData.error || "Could not load reports (admin only)."
        )}</p>`;
      } else {
        const reps = repData.reports || [];
        if (!reps.length) {
          reportsEl.innerHTML = "<p>No reports submitted.</p>";
        } else {
          reportsEl.innerHTML = "";
          reps.forEach((r) => {
            const div = document.createElement("div");
            div.classList.add("card");
            const title =
              r.listing && r.listing.title ? r.listing.title : r.listingId;
            const who =
              r.user && r.user.email ? r.user.email : r.reportedBy;
            div.innerHTML = `
              <h4>${escapeHtml(title)}</h4>
              <p>${escapeHtml(r.reason || "")}</p>
              <p><small>From: ${escapeHtml(who)} · ${escapeHtml(
                r.createdAt ? String(r.createdAt).slice(0, 19) : ""
              )}</small></p>
            `;
            reportsEl.appendChild(div);
          });
        }
      }
    }

    if (statsEl) {
      statsEl.innerHTML = `<p>Total listings: ${items.length}</p>`;
    }

    if (!container) return;
    container.innerHTML = "";

    items.forEach((item) => {
      const div = document.createElement("div");
      div.classList.add("card");
      div.innerHTML = `
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description || "")}</p>
        <p><small>Status: ${escapeHtml(item.status)} · Moderation: ${escapeHtml(item.moderationStatus)}</small></p>
        <button type="button" class="Add-button" data-id="${escapeHtml(item.id)}">Delete</button>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!id || !confirm("Delete this listing?")) return;

        const del = await fetch(`${window.ACITY_API_BASE}/listings/${id}`, {
          method: "DELETE",
        });
        const body = await del.json().catch(() => ({}));
        if (!del.ok) {
          alert(body.message || body.error || "Delete failed");
          return;
        }
        alert("Deleted.");
        location.reload();
      });
    });
  } catch (err) {
    if (statsEl) statsEl.textContent = String(err.message);
    if (container) container.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
});
