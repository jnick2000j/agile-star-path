/* Lovable Helpdesk Intake Widget — embed on any website */
(function () {
  if (window.__LOVABLE_HELPDESK_LOADED__) return;
  window.__LOVABLE_HELPDESK_LOADED__ = true;

  var TOKEN = window.LOVABLE_HELPDESK_TOKEN;
  var URL = window.LOVABLE_HELPDESK_URL;
  if (!TOKEN || !URL) {
    console.error("[Helpdesk Widget] Missing LOVABLE_HELPDESK_TOKEN or LOVABLE_HELPDESK_URL");
    return;
  }

  var STYLES = "\
.lhw-fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#2563eb;color:#fff;border:none;box-shadow:0 4px 16px rgba(0,0,0,.2);cursor:pointer;z-index:999998;display:flex;align-items:center;justify-content:center;font-size:24px}\
.lhw-fab:hover{background:#1d4ed8}\
.lhw-panel{position:fixed;bottom:96px;right:24px;width:360px;max-width:calc(100vw - 48px);background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden;display:none}\
.lhw-panel.open{display:block}\
.lhw-header{background:#2563eb;color:#fff;padding:16px;font-weight:600}\
.lhw-body{padding:16px;display:flex;flex-direction:column;gap:10px}\
.lhw-body input,.lhw-body textarea,.lhw-body select{width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:14px;font-family:inherit;box-sizing:border-box}\
.lhw-body textarea{min-height:80px;resize:vertical}\
.lhw-body button{background:#2563eb;color:#fff;border:none;padding:10px;border-radius:6px;font-weight:600;cursor:pointer;font-size:14px}\
.lhw-body button:disabled{opacity:.6;cursor:not-allowed}\
.lhw-success{padding:24px;text-align:center;color:#166534}\
.lhw-error{color:#dc2626;font-size:13px}\
.lhw-close{position:absolute;top:12px;right:12px;background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer}\
";
  var s = document.createElement("style");
  s.textContent = STYLES;
  document.head.appendChild(s);

  var fab = document.createElement("button");
  fab.className = "lhw-fab";
  fab.innerHTML = "💬";
  fab.title = "Get support";
  document.body.appendChild(fab);

  var panel = document.createElement("div");
  panel.className = "lhw-panel";
  panel.innerHTML = '\
<div class="lhw-header">Get Support<button class="lhw-close" type="button">&times;</button></div>\
<form class="lhw-body">\
  <input name="name" placeholder="Your name" />\
  <input name="email" type="email" placeholder="Email *" required />\
  <input name="subject" placeholder="Subject *" required />\
  <textarea name="description" placeholder="Describe the issue..."></textarea>\
  <select name="priority">\
    <option value="low">Low</option>\
    <option value="medium" selected>Medium</option>\
    <option value="high">High</option>\
    <option value="urgent">Urgent</option>\
  </select>\
  <button type="submit">Submit Ticket</button>\
  <div class="lhw-error" style="display:none"></div>\
</form>';
  document.body.appendChild(panel);

  fab.addEventListener("click", function () { panel.classList.toggle("open"); });
  panel.querySelector(".lhw-close").addEventListener("click", function () { panel.classList.remove("open"); });

  var form = panel.querySelector("form");
  var errEl = panel.querySelector(".lhw-error");
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errEl.style.display = "none";
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Sending...";
    var fd = new FormData(form);
    try {
      var resp = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-channel-token": TOKEN },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          subject: fd.get("subject"),
          description: fd.get("description"),
          priority: fd.get("priority"),
        }),
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.message || data.error || "Submission failed");
      panel.querySelector(".lhw-body").innerHTML =
        '<div class="lhw-success">✅ Ticket created!<br><small>Reference: ' + data.reference_number + '</small></div>';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Submit Ticket";
    }
  });
})();
