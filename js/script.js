const getAuthBase = () =>
  `${window.ACITY_API_BASE || `${window.ACITY_API_ORIGIN}/api/v1`}/auth`;

const appendStatusElement = (form) => {
  const status = document.createElement("p");
  status.id = "form-status";
  form.appendChild(status);
  return status;
};

const setStatus = (statusElement, message, isError = false) => {
  statusElement.textContent = message;
  statusElement.style.color = isError ? "#c0392b" : "#1e8449";
};

const persistSession = (user) => {
  const serialized = JSON.stringify(user);
  localStorage.setItem("acityUser", serialized);
  localStorage.setItem("user", serialized);
};

const getAuthPayload = (form) => {
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  return { email, password };
};

const redirectAfterAuth = (path) => {
  const lower = path.toLowerCase();
  if (lower.endsWith("adlogin.html")) {
    const raw =
      localStorage.getItem("acityUser") || localStorage.getItem("user");
    let user = null;
    try {
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }
    if (user && user.role === "ADMIN") {
      window.location.href = "admin.html";
    } else {
      alert("This entrance is for administrators only.");
      window.location.href = "index.html";
    }
    return;
  }
  window.location.href = "marketplace.html";
};

const handleAuthSubmit = async (event, endpoint, isRegisterPage) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector(
    'button[type="submit"], button.submit'
  );
  const statusElement =
    form.querySelector("#form-status") || appendStatusElement(form);

  setStatus(statusElement, "Please wait...");
  if (submitButton) submitButton.disabled = true;

  try {
    const payload = getAuthPayload(form);

    const response = await fetch(`${getAuthBase()}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Request failed");
    }

    persistSession(data.user);
    setStatus(
      statusElement,
      isRegisterPage
        ? "Registration successful. Redirecting..."
        : "Login successful. Redirecting..."
    );

    window.setTimeout(() => {
      redirectAfterAuth(window.location.pathname);
    }, 700);
  } catch (error) {
    setStatus(statusElement, error.message || "Something went wrong", true);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  if (!form) return;

  const path = window.location.pathname.toLowerCase();
  const isRegisterPage = path.endsWith("register.html");
  const isLoginPage = path.endsWith("login.html");
  const isAdLoginPage = path.endsWith("adlogin.html");

  if (isRegisterPage) {
    form.addEventListener("submit", (event) =>
      handleAuthSubmit(event, "register", true)
    );
  }

  if (isLoginPage || isAdLoginPage) {
    form.addEventListener("submit", (event) =>
      handleAuthSubmit(event, "login", false)
    );
  }
});
