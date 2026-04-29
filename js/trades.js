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

async function loadTrades(userId) {
  const url = new URL(`${window.ACITY_API_BASE}/trades`);
  url.searchParams.set("userId", userId);
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || "Failed to load trades");
  return data.trades || [];
}

async function patchTrade(tradeId, userId, status) {
  const res = await fetch(`${window.ACITY_API_BASE}/trades/${encodeURIComponent(tradeId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || "Update failed");
  return data.trade;
}

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("trades-list");
  const user = getStoredUser();

  if (!user || !user.id) {
    window.location.href = "login.html";
    return;
  }

  if (!container) return;

  async function render() {
    container.innerHTML = "<p>Loading…</p>";
    try {
      const trades = await loadTrades(user.id);
      if (!trades.length) {
        container.innerHTML =
          "<p>No trades yet. Request a trade from the marketplace.</p>";
        return;
      }

      container.innerHTML = "";
      trades.forEach((t) => {
        const div = document.createElement("div");
        div.className = "card";

        const listingTitle =
          (t.listing && t.listing.title) || "Listing";
        const reqEmail =
          (t.requester && t.requester.email) || "—";
        const ownEmail = (t.owner && t.owner.email) || "—";
        const role =
          t.ownerId === user.id ? "You are the seller" : "You requested this trade";

        let actions = "";
        if (t.status === "PENDING" && t.ownerId === user.id) {
          actions = `
            <button type="button" data-act="accept" data-id="${escapeHtml(t.id)}">Accept</button>
            <button type="button" data-act="reject" data-id="${escapeHtml(t.id)}">Reject</button>
          `;
        } else if (t.status === "ACCEPTED") {
          actions = `
            <button type="button" data-act="complete" data-id="${escapeHtml(t.id)}">Mark completed</button>
          `;
        }

        div.innerHTML = `
          <h3>${escapeHtml(listingTitle)}</h3>
          <p><small>${escapeHtml(role)} · Status: <b>${escapeHtml(t.status)}</b></small></p>
          <p>Seller: ${escapeHtml(ownEmail)}</p>
          <p>Requester: ${escapeHtml(reqEmail)}</p>
          ${actions}
        `;
        container.appendChild(div);
      });

      container.querySelectorAll("button[data-act]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          const act = btn.getAttribute("data-act");
          if (!id || !act) return;

          let status;
          if (act === "accept") status = "ACCEPTED";
          else if (act === "reject") status = "REJECTED";
          else if (act === "complete") status = "COMPLETED";
          else return;

          btn.disabled = true;
          try {
            await patchTrade(id, user.id, status);
            await render();
          } catch (e) {
            btn.disabled = false;
            alert(e.message || "Could not update trade");
          }
        });
      });
    } catch (e) {
      container.innerHTML = `<p style="color:#900">${escapeHtml(e.message)}</p>`;
    }
  }

  await render();
});
