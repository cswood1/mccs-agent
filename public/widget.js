/*
 * MCCS Installation Assistant — embeddable chat widget.
 *
 * Drop onto any page with one tag:
 *   <script src="https://<app-host>/widget.js" data-installation="quantico" defer></script>
 *
 * Plain JS (no build step, no dependencies) rendered inside a Shadow DOM so the
 * host site's CSS can't break it and ours can't leak out. Talks to /api/chat on
 * the same origin the script was loaded from.
 */
(function () {
  "use strict";
  if (window.__mccsAssistantLoaded) return;
  window.__mccsAssistantLoaded = true;

  var script =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"][data-installation]');
  if (!script) return;

  var installationId = script.getAttribute("data-installation") || "quantico";
  var apiBase = script.getAttribute("data-api-base") || new URL(script.src, location.href).origin;
  var storageKey = "mccs-assistant:" + installationId;
  var openKey = storageKey + ":open";
  // On the demo app (data-demo-host), pages of any installation's real site live at /<slug>/...,
  // so links to them in answers stay in this site and tab. data-path-prefix is this installation's
  // prefix ("/quantico"), so its home page is recognized.
  var demoHost = script.getAttribute("data-demo-host") === "1";
  var pathPrefix = script.getAttribute("data-path-prefix") || "";
  // Demo access code, for when the widget runs on another site (bookmarklet) and our cookie isn't sent.
  var accessCode = script.getAttribute("data-access-code") || "";
  var apiHeaders = accessCode ? { "X-Demo-Access": accessCode } : {};

  var currentPath = (location.pathname.replace(/\/+$/, "") || "/");
  var FRAME = "\u001e"; // separates answer text from the follow-up chips frame in /api/chat responses

  var state = {
    open: false,
    busy: false,
    config: null,
    page: null, // { title, chips, chipsFrom, welcome, known } from /api/installations/:id/page
    messages: loadMessages(), // [{ role: "user" | "assistant", content: string, error?: true }]
    followups: loadJSON(storageKey + ":followups", null), // { path, items } — replace page chips until navigation
    trail: updateTrail(), // pages visited earlier this session, most recent first
  };

  // ---------- DOM ----------
  var host = document.createElement("div");
  host.id = "mccs-assistant";
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML =
    "<style>" + css() + "</style>" +
    '<div class="nudge" role="status" hidden>' +
      '<button class="nudge-text" type="button"></button>' +
      '<button class="nudge-close" type="button" aria-label="Dismiss suggestion">' + icon("close") + "</button>" +
    "</div>" +
    '<button class="launcher" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="panel">' +
      sparkle() + '<span class="launcher-label">Ask MCCS</span>' +
    "</button>" +
    '<section class="panel" id="panel" role="dialog" aria-modal="false" aria-labelledby="title" hidden>' +
      '<header class="head">' +
        '<div class="head-text">' +
          '<h2 id="title">' + sparkle() + '<span class="title-text">Ask MCCS</span></h2>' +
          '<p class="subtitle"></p><p class="context-line" hidden></p>' +
        "</div>" +
        '<button class="icon-btn reset" type="button" aria-label="Start a new chat" title="New chat">' + icon("refresh") + "</button>" +
        '<button class="icon-btn close" type="button" aria-label="Close assistant" title="Close">' + icon("close") + "</button>" +
      "</header>" +
      '<div class="sample-banner" hidden>Sample data — answers use placeholder content, not real MCCS information.</div>' +
      '<div class="log" role="log" aria-live="polite" aria-relevant="additions text"></div>' +
      '<div class="chips" role="group" aria-label="Suggested questions" hidden></div>' +
      '<form class="composer">' +
        '<label class="sr-only" for="input">Message</label>' +
        '<textarea id="input" rows="1" placeholder="Ask me anything…" autocomplete="off" enterkeyhint="send"></textarea>' +
        '<button class="send" type="submit" aria-label="Send">' + icon("send") + "</button>" +
      "</form>" +
      '<p class="disclaimer">AI answers can be wrong. Check the linked MCCS page before you go.</p>' +
    "</section>";

  var launcher = root.querySelector(".launcher");
  var panel = root.querySelector(".panel");
  var titleEl = root.querySelector("#title");
  var subtitleEl = root.querySelector(".subtitle");
  var contextEl = root.querySelector(".context-line");
  var sampleBanner = root.querySelector(".sample-banner");
  var log = root.querySelector(".log");
  var form = root.querySelector(".composer");
  var input = root.querySelector("#input");
  var sendBtn = root.querySelector(".send");
  var chipsEl = root.querySelector(".chips");
  var nudge = root.querySelector(".nudge");
  var nudgeText = root.querySelector(".nudge-text");

  nudgeText.addEventListener("click", function () {
    var q = nudgeText.textContent;
    hideNudge();
    setOpen(true);
    send(q);
  });
  root.querySelector(".nudge-close").addEventListener("click", hideNudge);

  launcher.addEventListener("click", function () { setOpen(true); });
  root.querySelector(".close").addEventListener("click", function () { setOpen(false); });
  root.querySelector(".reset").addEventListener("click", resetChat);
  panel.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    send(input.value);
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send(input.value);
    }
  });
  input.addEventListener("input", autosize);

  document.body.appendChild(host);
  fetchConfig();
  fetchPage();
  // Reopen after navigating to another page if the chat was open.
  if (loadOpen()) setOpen(true, true);

  // Lets the host page open the chat (e.g. from its search box) or ask a question.
  window.mccsAssistant = {
    open: function () { setOpen(true); },
    ask: function (q) { setOpen(true); send(q); },
  };

  // ---------- behavior ----------
  function fetchConfig() {
    fetch(apiBase + "/api/installations/" + encodeURIComponent(installationId), { headers: apiHeaders })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (!cfg) return;
        state.config = cfg;
        host.style.setProperty("--primary", cfg.theme.primary);
        host.style.setProperty("--accent", cfg.theme.accent);
        root.querySelector(".title-text").textContent = cfg.assistantName;
        sampleBanner.hidden = !cfg.sample;
        renderHeader();
        render();
        scheduleNudge();
      })
      .catch(function () { /* widget still works with defaults */ });
  }

  // Title, breadcrumb and chips for the page this widget is on (no AI call).
  function fetchPage() {
    fetch(apiBase + "/api/installations/" + encodeURIComponent(installationId) + "/page?path=" + encodeURIComponent(currentPath), { headers: apiHeaders })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (info) {
        if (!info) return;
        state.page = info;
        // Remember this page's title for the trail on later pages.
        try { sessionStorage.setItem(storageKey + ":current", JSON.stringify({ path: currentPath, title: info.title || document.title })); } catch { /* ignore */ }
        renderHeader();
        render();
        scheduleNudge();
      })
      .catch(function () { /* chips just won't show */ });
  }

  function isHome() {
    return currentPath === "/" || (pathPrefix && currentPath === pathPrefix);
  }

  function renderHeader() {
    var page = state.page;
    // Subtitle: the installation's short name ("MCB Quantico"); context line: the page they're on (§5, §13).
    subtitleEl.textContent = state.config ? state.config.shortName || state.config.name : "";
    var viewing = page && page.known && !isHome();
    contextEl.hidden = !viewing;
    contextEl.textContent = viewing ? "Viewing: " + page.title : "";
  }

  // ---------- page trail (last 5 pages this session; sent with each question, never shown) ----------
  function updateTrail() {
    var trail = loadJSON(storageKey + ":trail", []);
    var prev = loadJSON(storageKey + ":current", null);
    if (prev && prev.path && prev.path !== currentPath) {
      trail = [prev].concat(trail.filter(function (t) { return t.path !== prev.path && t.path !== currentPath; })).slice(0, 5);
      try { sessionStorage.setItem(storageKey + ":trail", JSON.stringify(trail)); } catch { /* ignore */ }
    }
    try { sessionStorage.setItem(storageKey + ":current", JSON.stringify({ path: currentPath, title: document.title })); } catch { /* ignore */ }
    return trail;
  }

  function readBreadcrumb() {
    var items = document.querySelectorAll('.breadcrumb li, nav[aria-label*="readcrumb"] li');
    return Array.prototype.map.call(items, function (li) { return li.textContent.trim(); }).filter(Boolean).slice(0, 6);
  }

  // ---------- nudge: one suggestion bubble on a non-home page, once per session ----------
  function scheduleNudge() {
    if (scheduleNudge.done || !state.config || !state.page) return;
    scheduleNudge.done = true;
    var chip = state.page.chips && state.page.chips[0];
    if (!state.config.nudge || isHome() || !chip || state.page.chipsFrom === "home") return;
    if (loadJSON(storageKey + ":nudged", false)) return;
    setTimeout(function () {
      if (state.open || loadJSON(storageKey + ":nudged", false)) return;
      try { sessionStorage.setItem(storageKey + ":nudged", "true"); } catch { /* ignore */ }
      nudgeText.textContent = chip;
      nudge.hidden = false;
    }, 20000);
  }

  function hideNudge() {
    nudge.hidden = true;
  }

  function setOpen(open, restoring) {
    state.open = open;
    saveOpen(open);
    panel.hidden = !open;
    launcher.hidden = open;
    launcher.setAttribute("aria-expanded", String(open));
    // Full-screen on phones: stop the page underneath from scrolling.
    document.documentElement.style.overflow = open && isPhone() ? "hidden" : "";
    if (open) {
      hideNudge();
      warmCache();
      render();
      scrollToEnd();
      if (!(restoring && isPhone())) input.focus({ preventScroll: true });
    } else {
      launcher.focus();
    }
  }

  // Ask the server to pre-load the assistant's knowledge into the prompt cache while the
  // person types. At most once per browser per 50 minutes (the cache lasts an hour).
  function warmCache() {
    var key = storageKey + ":warmed";
    try {
      if (Date.now() - Number(localStorage.getItem(key) || 0) < 50 * 60 * 1000) return;
      localStorage.setItem(key, String(Date.now()));
    } catch { /* storage unavailable: warm anyway */ }
    fetch(apiBase + "/api/warm", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, apiHeaders),
      body: JSON.stringify({ installationId: installationId }),
    }).catch(function () { /* best effort */ });
  }

  function resetChat() {
    if (state.busy) return;
    state.messages = [];
    state.followups = null;
    saveMessages();
    saveFollowups();
    render();
    input.focus();
  }

  function send(text) {
    text = (text || "").trim();
    if (!text || state.busy) return;
    input.value = "";
    autosize();

    state.messages.push({ role: "user", content: text });
    var reply = { role: "assistant", content: "" };
    var raw = "";
    state.messages.push(reply);
    state.busy = true;
    render();
    scrollToEnd();

    // Only send real turns; drop error bubbles and anything after the last 30.
    var history = state.messages
      .filter(function (m) { return m !== reply && !m.error && m.content; })
      .slice(-29);
    while (history.length && history[0].role !== "user") history.shift();

    fetch(apiBase + "/api/chat", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, apiHeaders),
      body: JSON.stringify({
        installationId: installationId,
        messages: history.map(function (m) { return { role: m.role, content: m.content }; }),
        page: { url: location.href, path: currentPath, title: document.title, breadcrumb: readBreadcrumb() },
        trail: state.trail.map(function (t) { return { path: t.path, title: t.title }; }),
      }),
    })
      .then(function (res) {
        if (!res.ok || !res.body) {
          return res.json().catch(function () { return {}; }).then(function (j) {
            throw new Error(j.error || "Request failed (" + res.status + ")");
          });
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var pending = false;
        function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) return;
            raw += decoder.decode(chunk.value, { stream: true });
            reply.content = raw.split(FRAME)[0];
            if (!pending) {
              pending = true;
              requestAnimationFrame(function () {
                pending = false;
                updateLast();
              });
            }
            return pump();
          });
        }
        return pump();
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : "Couldn't reach the assistant.";
        reply.error = true;
        reply.content = (reply.content ? reply.content + "\n\n" : "") + msg + (/try again/i.test(msg) ? "" : " Please try again.");
      })
      .then(function () {
        reply.content = reply.content.trim();
        var frame = raw.split(FRAME)[1];
        if (frame) {
          try {
            var items = JSON.parse(frame).followups;
            if (Array.isArray(items) && items.length) state.followups = { path: currentPath, items: items.slice(0, 2) };
          } catch { /* ignore a malformed frame */ }
        } else if (!reply.error) {
          state.followups = null;
        }
        saveFollowups();
        if (!reply.content) {
          reply.error = true;
          reply.content = "No answer came back. Please try again.";
        }
        state.busy = false;
        saveMessages();
        render();
        scrollToEnd();
        if (state.open && !isPhone()) input.focus();
      });
  }

  // ---------- rendering ----------
  function render() {
    sendBtn.disabled = state.busy;
    log.innerHTML = "";
    renderChips();

    if (!state.messages.length) {
      var welcome = document.createElement("div");
      welcome.className = "msg assistant";
      welcome.textContent = (state.page && state.page.welcome) || (state.config ? state.config.welcomeMessage : "Hi! How can I help?");
      log.appendChild(welcome);
      return;
    }

    state.messages.forEach(function (m) { log.appendChild(bubble(m)); });
  }

  // Follow-ups from the last answer on this page, else this page's chips (page → section → home).
  function renderChips() {
    var items = [];
    if (state.followups && state.followups.path === currentPath && state.messages.length) items = state.followups.items;
    else if (state.page && state.page.chips) items = state.page.chips.slice(0, 4);
    else if (state.config && state.config.defaultChips) items = state.config.defaultChips.slice(0, 4);
    chipsEl.innerHTML = "";
    chipsEl.hidden = state.busy || !items.length;
    items.forEach(function (q) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = q;
      b.addEventListener("click", function () { send(q); });
      chipsEl.appendChild(b);
    });
  }

  function updateLast() {
    var last = state.messages[state.messages.length - 1];
    var el = log.lastElementChild;
    if (!el || !last) return;
    var nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    el.replaceWith(bubble(last));
    if (nearBottom) scrollToEnd();
  }

  function bubble(m) {
    var el = document.createElement("div");
    el.className = "msg " + m.role + (m.error ? " error" : "");
    if (m.role === "user") {
      el.textContent = m.content;
    } else if (!m.content) {
      el.innerHTML = '<span class="typing" aria-label="Assistant is typing"><i></i><i></i><i></i></span>';
    } else {
      el.innerHTML = markdown(m.content);
    }
    return el;
  }

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

  function isPhone() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  // ---------- persistence (survives navigating between pages of the site) ----------
  function loadMessages() {
    try {
      var saved = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function loadJSON(key, fallback) {
    try {
      var v = sessionStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  }

  function saveFollowups() {
    try { sessionStorage.setItem(storageKey + ":followups", JSON.stringify(state.followups)); } catch { /* ignore */ }
  }

  function loadOpen() {
    try {
      return sessionStorage.getItem(openKey) === "1";
    } catch {
      return false;
    }
  }

  function saveOpen(open) {
    try {
      sessionStorage.setItem(openKey, open ? "1" : "0");
    } catch { /* ignore */ }
  }

  function saveMessages() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state.messages.slice(-30)));
    } catch { /* storage unavailable: chat just won't persist */ }
  }

  // ---------- tiny, safe markdown: paragraphs, lists, **bold**, links ----------
  function markdown(src) {
    var lines = escapeHtml(src).split(/\r?\n/);
    var out = [];
    var list = null; // "ul" | "ol"
    var para = [];

    function flushPara() {
      if (para.length) out.push("<p>" + para.join("<br>") + "</p>");
      para = [];
    }
    function closeList() {
      if (list) out.push("</" + list + ">");
      list = null;
    }

    lines.forEach(function (raw) {
      var line = raw.trim();
      var ul = /^[-*•]\s+(.*)$/.exec(line);
      var ol = /^\d+[.)]\s+(.*)$/.exec(line);
      if (ul || ol) {
        flushPara();
        var type = ul ? "ul" : "ol";
        if (list !== type) {
          closeList();
          out.push("<" + type + ">");
          list = type;
        }
        out.push("<li>" + inline((ul || ol)[1]) + "</li>");
      } else if (!line) {
        flushPara();
        closeList();
      } else {
        closeList();
        para.push(inline(line.replace(/^#{1,6}\s+/, "")));
      }
    });
    flushPara();
    closeList();
    return out.join("");
  }

  // Input is already HTML-escaped; only add tags we construct ourselves.
  // Phone numbers become tap-to-call links and street addresses become map links (§4 Actions).
  var PHONE = "(?:\\+?1[-.\\s])?\\(?\\d{3}\\)?[-.\\s]\\d{3}[-.\\s]\\d{4}";
  var CRISIS = "(?:dial|call) 988|text 838255";
  var STREET = "\\b\\d{2,5} (?:[A-Z][a-z]+\\.? ){1,3}(?:Rd|Road|Ave|Avenue|St|Street|Loop|Blvd|Dr|Drive|Ln|Lane|Hwy|Way|Ct|Pl|Cir|Circle)\\b\\.?(?:,? (?:Suite|Ste\\.?|Bldg\\.?|Building) [\\w-]+)?(?:, ?Quantico(?:, ?VA)?(?: \\d{5})?)?";
  var INLINE = new RegExp(
    "\\[([^\\]]+)\\]\\(((?:https?:\\/\\/|mailto:|tel:)[^\\s)]+)\\)|(https?:\\/\\/[^\\s<]*[^\\s<.,;:!?)\\]])|\\*\\*([^*]+)\\*\\*|(" + CRISIS + ")|(" + PHONE + ")|(" + STREET + ")",
    "g"
  );

  function inline(s) {
    return s.replace(INLINE, function (_, text, href, bare, bold, crisis, phone, street) {
      if (href) return link(href, text);
      if (bare) return link(bare, bare);
      if (bold) return "<strong>" + inline(bold) + "</strong>";
      if (crisis) {
        var sms = /838255/.test(crisis);
        return '<a href="' + (sms ? "sms:838255" : "tel:988") + '">' + crisis + "</a>";
      }
      if (phone) return '<a href="tel:' + phone.replace(/[^\d+]/g, "") + '">' + phone + "</a>";
      if (street) {
        var place = unescapeHtml(street);
        if (!/Quantico/i.test(place) && state.config && state.config.location) place += ", " + state.config.location;
        return '<a href="https://www.google.com/maps/search/?api=1&amp;query=' + encodeURIComponent(place) + '" target="_blank" rel="noopener noreferrer">' + street + "</a>";
      }
      return _;
    });
  }

  function unescapeHtml(s) {
    return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }

  function link(href, text) {
    var local = sameSitePath(href);
    if (local) return '<a href="' + escapeHtml(local) + '">' + text + "</a>";
    var external = /^https?:/.test(href);
    return '<a href="' + href + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + text + "</a>";
  }

  // A link to this site (or to the real site this page recreates) opens here, in the same tab.
  // The chat stays open across the navigation (see loadOpen/saveOpen).
  function sameSitePath(href) {
    var u;
    try {
      u = new URL(href.replace(/&amp;/g, "&"));
    } catch {
      return null;
    }
    if (!/^https?:$/.test(u.protocol)) return null;
    if (u.pathname.indexOf("/modules/") === 0) return null; // files (PDFs, menus) only exist on the real site
    var path = (u.pathname.replace(/\/+$/, "") || "/") + u.search + u.hash;
    var host = u.hostname.replace(/^www\./, "");
    if (host === location.hostname.replace(/^www\./, "")) return path;
    // Demo app: <slug>.usmc-mccs.org/<path> -> /<slug>/<path>. (usmc-mccs.org itself is Corps-wide.)
    var m = /^([a-z0-9]+)\.usmc-mccs\.org$/.exec(host);
    if (demoHost && m) return "/" + m[1] + (path === "/" ? "" : path);
    return null;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Original four-point sparkle: the AI signal (docs/PRODUCT.md §13). Gold on the scarlet theme.
  function sparkle() {
    return (
      '<svg class="sparkle" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M12 2.5c.7 5.2 4.3 8.8 9.5 9.5-5.2.7-8.8 4.3-9.5 9.5-.7-5.2-4.3-8.8-9.5-9.5 5.2-.7 8.8-4.3 9.5-9.5z"/>' +
      "</svg>"
    );
  }

  function icon(name) {
    var paths = {
      chat: '<path d="M4 5h16v11H8l-4 4z"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
      refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    };
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + "</svg>";
  }

  function css() {
    return [
      ":host { --primary: #9e1b32; --accent: #ffc72c; --ink: #1c1c1e; --muted: #5f6368; --line: #e3e3e6; --bg: #ffffff; --soft: #f4f4f6;",
      "  all: initial; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.45; color: var(--ink); }",
      "*, *::before, *::after { box-sizing: border-box; }",
      "[hidden] { display: none !important; }",
      ".sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }",

      ".launcher { position: fixed; z-index: 2147483000; right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom));",
      "  display: flex; align-items: center; gap: 8px; padding: 11px 18px 11px 14px; border: 2px solid transparent; border-radius: 999px; cursor: pointer;",
      // Soft scarlet-to-gold gradient border (the outer layer shows only through the transparent border).
      "  background: linear-gradient(var(--primary), var(--primary)) padding-box,",
      "    linear-gradient(110deg, var(--primary) 0%, var(--accent) 45%, #fff3c4 50%, var(--accent) 55%, var(--primary) 100%) border-box;",
      "  background-size: 100% 100%, 250% 100%; background-position: 0 0, 100% 0;",
      "  color: #fff; font: 600 15px/1 inherit; font-family: inherit; box-shadow: 0 6px 20px rgba(0,0,0,.25);",
      // The border shimmers once on page load.
      "  animation: launcher-shimmer 1.6s ease-in-out .6s 1 both; }",
      "@keyframes launcher-shimmer { from { background-position: 0 0, 100% 0; } to { background-position: 0 0, 0% 0; } }",
      ".launcher:hover { filter: brightness(1.08); }",
      ".sparkle { width: 20px; height: 20px; flex: none; fill: var(--accent); }",
      ".launcher .sparkle { width: 22px; height: 22px; }",
      ".launcher:focus-visible, button:focus-visible, textarea:focus-visible, a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }",

      ".panel { position: fixed; z-index: 2147483001; top: 0; right: 0; bottom: 0; width: 420px; max-width: 100vw;",
      "  display: flex; flex-direction: column; background: var(--bg); box-shadow: -8px 0 30px rgba(0,0,0,.18); animation: slide .2s ease-out; }",
      "@keyframes slide { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }",
      "@media (max-width: 640px) { .panel { width: 100vw; height: 100dvh; bottom: auto; } }",

      ".head { display: flex; align-items: center; gap: 4px; padding: 14px 10px 14px 18px; padding-top: max(14px, env(safe-area-inset-top));",
      "  background: var(--primary); color: #fff; }",
      ".head-text { flex: 1; min-width: 0; }",
      "h2 { margin: 0; display: flex; align-items: center; gap: 7px; font-size: 17px; font-weight: 700; }",
      "h2 .sparkle { width: 18px; height: 18px; }",
      ".subtitle { margin: 2px 0 0; font-size: 13px; opacity: .85; }",
      ".context-line { margin: 1px 0 0; font-size: 12px; opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
      ".icon-btn { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 10px; background: transparent; color: inherit; cursor: pointer; }",
      ".icon-btn:hover { background: rgba(255,255,255,.15); }",

      ".sample-banner { padding: 8px 18px; background: #fff4cc; color: #5c4400; font-size: 13px; border-bottom: 1px solid #f0dc8c; }",

      ".log { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--soft); }",
      ".msg { max-width: 88%; padding: 10px 14px; border-radius: 16px; overflow-wrap: anywhere; }",
      ".msg.user { align-self: flex-end; background: var(--primary); color: #fff; border-bottom-right-radius: 4px; white-space: pre-wrap; }",
      ".msg.assistant { align-self: flex-start; background: #fff; border: 1px solid var(--line); border-bottom-left-radius: 4px; }",
      ".msg.error { border-color: #e2a3a3; background: #fff5f5; }",
      ".msg p { margin: 0 0 8px; } .msg p:last-child { margin-bottom: 0; }",
      ".msg ul, .msg ol { margin: 4px 0 8px; padding-left: 20px; } .msg li { margin: 2px 0; }",
      ".msg a { color: var(--primary); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }",

      ".chips { display: flex; gap: 8px; padding: 10px 12px 2px; overflow-x: auto; scrollbar-width: none; background: var(--bg); border-top: 1px solid var(--line); }",
      ".chips::-webkit-scrollbar { display: none; }",
      "@media (min-width: 641px) { .chips { flex-wrap: wrap; overflow-x: visible; } }",
      ".chip { flex: none; text-align: left; padding: 8px 12px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--ink);",
      "  font: inherit; font-size: 14px; white-space: nowrap; cursor: pointer; }",
      ".chip:hover { border-color: var(--primary); color: var(--primary); }",
      ".nudge { position: fixed; z-index: 2147483000; right: max(16px, env(safe-area-inset-right)); bottom: calc(max(16px, env(safe-area-inset-bottom)) + 58px);",
      "  display: flex; align-items: center; max-width: min(280px, calc(100vw - 32px)); background: #fff; color: var(--ink); border: 1px solid var(--line);",
      "  border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,.18); animation: pop .2s ease-out; }",
      "@keyframes pop { from { transform: translateY(6px); opacity: 0; } to { transform: none; opacity: 1; } }",
      ".nudge-text { flex: 1; min-width: 0; padding: 10px 4px 10px 14px; border: 0; background: none; color: inherit; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }",
      ".nudge-close { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border: 0; background: none; color: var(--muted); cursor: pointer; }",
      ".nudge-close svg { width: 16px; height: 16px; }",

      ".typing { display: inline-flex; gap: 4px; padding: 4px 0; }",
      ".typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); animation: blink 1.2s infinite both; }",
      ".typing i:nth-child(2) { animation-delay: .2s; } .typing i:nth-child(3) { animation-delay: .4s; }",
      "@keyframes blink { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }",

      ".composer { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); background: var(--bg); }",
      ".chips:not([hidden]) + .composer { border-top: 0; }",
      // 16px font stops iOS Safari from zooming in when the field is focused.
      "textarea { flex: 1; resize: none; max-height: 120px; padding: 11px 14px; border: 1px solid var(--line); border-radius: 22px;",
      "  font: inherit; font-size: 16px; line-height: 1.35; color: var(--ink); background: #fff; }",
      ".send { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 50%;",
      "  background: var(--primary); color: #fff; cursor: pointer; }",
      ".send:disabled { opacity: .45; cursor: default; }",
      ".disclaimer { margin: 0; padding: 0 16px 10px; padding-bottom: max(10px, env(safe-area-inset-bottom)); font-size: 12px; color: var(--muted); background: var(--bg); text-align: center; }",

      "@media (prefers-reduced-motion: reduce) { .panel, .typing i, .nudge, .launcher { animation: none; } }",
    ].join("\n");
  }
})();
