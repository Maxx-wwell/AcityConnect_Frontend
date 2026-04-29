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

/** Stable UUID comparison (handles casing / stray whitespace). */
function normalizeId(id) {
  return String(id ?? "").trim().toLowerCase();
}

function emailLocalPart(email) {
  if (!email || typeof email !== "string") return "Student";
  const [local] = email.split("@");
  return local || "Student";
}

let activeConversationId = null;
let pollTimer = null;

function api(path, opts = {}) {
  const base = window.ACITY_API_BASE || "http://localhost:3000/api/v1";
  return fetch(`${base}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : String(s);
  return div.innerHTML;
}

async function ensureConversationForListing(listingId, userId) {
  const res = await api("/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ listingId, userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Could not open chat");
  return data.conversation;
}

async function fetchConversations(userId) {
  const res = await api(
    `/chat/conversations?userId=${encodeURIComponent(userId)}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load conversations");
  return data.conversations || [];
}

/** @returns {Promise<Array>} conversations list */
async function loadSidebar(userId, options = {}) {
  const silent = !!options.silent;
  const listEl = document.getElementById("convo-list");
  if (!listEl) return [];

  if (!silent) {
    listEl.innerHTML = "<p>Loading…</p>";
  }

  let conversations;
  try {
    conversations = await fetchConversations(userId);
  } catch (e) {
    if (!silent) {
      listEl.innerHTML = `<p style="color:#900">${escapeHtml(e.message)}</p>`;
    }
    return [];
  }

  const selfKey = normalizeId(userId);

  if (!conversations.length) {
    listEl.innerHTML =
      "<p>No conversations yet. Message someone from the marketplace.</p>";
    return [];
  }

  listEl.innerHTML = "";

  conversations.forEach((c) => {
    const other = (c.participants || []).find(
      (p) => normalizeId(p.userId) !== selfKey
    );
    const peerName = other?.user?.email
      ? emailLocalPart(other.user.email)
      : "Conversation";
    const preview =
      c.messages && c.messages[0]?.content
        ? c.messages[0].content.slice(0, 60)
        : "";

    const row = document.createElement("div");
    row.className =
      "chat-list-item" + (c.id === activeConversationId ? " active" : "");
    row.dataset.conversationId = c.id;
    row.innerHTML = `
      <div class="user-info">
        <strong>${escapeHtml(peerName)}</strong>
        <div style="font-size:12px;opacity:0.85">${escapeHtml(c.listing?.title || "Listing")}</div>
        ${preview ? `<div style="font-size:11px;color:#666">${escapeHtml(preview)}</div>` : ""}
      </div>
    `;
    row.addEventListener("click", () => openConversation(c.id, userId));
    listEl.appendChild(row);
  });

  return conversations;
}

async function openConversation(conversationId, userId, options = {}) {
  const silent = !!options.silent;

  activeConversationId = conversationId;

  document.querySelectorAll(".chat-list-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.conversationId === conversationId);
  });

  const titleEl = document.getElementById("chat-title");
  const subEl = document.getElementById("chat-subtitle");
  const thread = document.getElementById("thread");

  if (!thread) return;
  if (!silent) thread.innerHTML = "<p>Loading messages…</p>";

  const res = await api(
    `/messages/${encodeURIComponent(conversationId)}?userId=${encodeURIComponent(userId)}`
  );
  const data = await res.json();

  if (!res.ok) {
    thread.innerHTML = `<p>${escapeHtml(data.error || "Could not load messages")}</p>`;
    return;
  }

  const messages = data.messages || [];
  const selfKey = normalizeId(userId);

  let conversations;
  try {
    conversations = await fetchConversations(userId);
  } catch {
    conversations = [];
  }

  const meta = conversations.find((c) => c.id === conversationId);

  if (titleEl && meta?.listing?.title) {
    titleEl.textContent = meta.listing.title;
  }
  if (subEl && meta) {
    const other = (meta.participants || []).find(
      (p) => normalizeId(p.userId) !== selfKey
    );
    subEl.textContent = other?.user?.email
      ? `Chat with ${emailLocalPart(other.user.email)}`
      : "";
  }

  thread.innerHTML = "";

  messages.forEach((m) => {
    const mine = normalizeId(m.senderId) === selfKey;
    const wrap = document.createElement("div");
    wrap.className = "message " + (mine ? "sent" : "received");
    const when = m.createdAt
      ? new Date(m.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    const fromLabel =
      !mine && m.sender?.email
        ? `<span class="msg-from">${escapeHtml(emailLocalPart(m.sender.email))}</span>`
        : "";

    wrap.innerHTML = `
      ${fromLabel}
      <p>${escapeHtml(m.content)}</p>
      <span class="time">${escapeHtml(when)}</span>
    `;
    thread.appendChild(wrap);
  });

  thread.scrollTop = thread.scrollHeight;

  const input = document.getElementById("msg-input");
  if (input && !silent) input.focus();
}

function startPolling(userId) {
  stopPolling();
  pollTimer = window.setInterval(async () => {
    if (!activeConversationId || document.visibilityState === "hidden") return;
    await openConversation(activeConversationId, userId, { silent: true });
    await loadSidebar(userId, { silent: true });
  }, 4000);
}

function stopPolling() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = getStoredUser();
  if (!user?.id) {
    window.location.href = "login.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const listingId = params.get("listing");

  try {
    if (listingId) {
      const conv = await ensureConversationForListing(listingId, user.id);
      activeConversationId = conv.id;
    }

    const conversations = await loadSidebar(user.id);

    if (!activeConversationId && conversations.length > 0 && !listingId) {
      activeConversationId = conversations[0].id;
    }

    if (activeConversationId) {
      await openConversation(activeConversationId, user.id);
    }

    startPolling(user.id);
  } catch (e) {
    const listEl = document.getElementById("convo-list");
    if (listEl)
      listEl.innerHTML = `<p style="color:#900">${escapeHtml(e.message)}</p>`;
  }

  window.addEventListener("beforeunload", stopPolling);

  const composer = document.getElementById("composer");
  if (composer) {
    composer.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("msg-input");
      const text = (input?.value || "").trim();
      if (!text || !activeConversationId) return;

      const res = await api(
        `/messages/${encodeURIComponent(activeConversationId)}`,
        {
          method: "POST",
          body: JSON.stringify({ userId: user.id, content: text }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Send failed");
        return;
      }
      input.value = "";
      await openConversation(activeConversationId, user.id, { silent: true });
      await loadSidebar(user.id, { silent: true });
    });
  }
});
