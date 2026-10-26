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

  var state = {
    open: false,
    busy: false,
    config: null,
    messages: loadMessages(), // [{ role: "user" | "assistant", content: string, error?: true }]
  };

  // ---------- DOM ----------
  var host = document.createElement("div");
  host.id = "mccs-assistant";
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML =
    "<style>" + css() + "</style>" +
    '<button class="launcher" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="panel">' +
      icon("chat") + '<span class="launcher-label">Ask me anything</span>' +
    "</button>" +
    '<section class="panel" id="panel" role="dialog" aria-modal="false" aria-labelledby="title" hidden>' +
      '<header class="head">' +
        '<div class="head-text"><h2 id="title">Assistant</h2><p class="subtitle"></p></div>' +
        '<button class="icon-btn reset" type="button" aria-label="Start a new chat" title="New chat">' + icon("refresh") + "</button>" +
        '<button class="icon-btn close" type="button" aria-label="Close assistant" title="Close">' + icon("close") + "</button>" +
      "</header>" +
      '<div class="sample-banner" hidden>Sample data — answers use placeholder content, not real MCCS information.</div>' +
      '<div class="log" role="log" aria-live="polite" aria-relevant="additions text"></div>' +
      '<form class="composer">' +
        '<label class="sr-only" for="input">Message</label>' +
        '<textarea id="input" rows="1" placeholder="Ask me anything..." autocomplete="off" enterkeyhint="send"></textarea>' +
        '<button class="send" type="submit" aria-label="Send">' + icon("send") + "</button>" +
      "</form>" +
      '<p class="disclaimer">AI answers can be wrong. Check the linked MCCS page before you go.</p>' +
    "</section>";

  var launcher = root.querySelector(".launcher");
  var panel = root.querySelector(".panel");
  var titleEl = root.querySelector("#title");
  var subtitleEl = root.querySelector(".subtitle");
  var sampleBanner = root.querySelector(".sample-banner");
  var log = root.querySelector(".log");
  var form = root.querySelector(".composer");
  var input = root.querySelector("#input");
  var sendBtn = root.querySelector(".send");

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

  // ---------- behavior ----------
  function fetchConfig() {
    fetch(apiBase + "/api/installations/" + encodeURIComponent(installationId))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (!cfg) return;
        state.config = cfg;
        host.style.setProperty("--primary", cfg.theme.primary);
        host.style.setProperty("--accent", cfg.theme.accent);
        titleEl.textContent = cfg.assistantName;
        subtitleEl.textContent = cfg.name;
        sampleBanner.hidden = !cfg.sample;
        render();
      })
      .catch(function () { /* widget still works with defaults */ });
  }

  function setOpen(open) {
    state.open = open;
    panel.hidden = !open;
    launcher.hidden = open;
    launcher.setAttribute("aria-expanded", String(open));
    // Full-screen on phones: stop the page underneath from scrolling.
    document.documentElement.style.overflow = open && isPhone() ? "hidden" : "";
    if (open) {
      render();
      scrollToEnd();
      input.focus();
    } else {
      launcher.focus();
    }
  }

  function resetChat() {
    if (state.busy) return;
    state.messages = [];
    saveMessages();
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId: installationId,
        messages: history.map(function (m) { return { role: m.role, content: m.content }; }),
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
            reply.content += decoder.decode(chunk.value, { stream: true });
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
        reply.error = true;
        reply.content = (reply.content ? reply.content + "\n\n" : "") +
          (err && err.message ? err.message : "Couldn't reach the assistant.") + " Please try again.";
      })
      .then(function () {
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

    if (!state.messages.length) {
      var welcome = document.createElement("div");
      welcome.className = "msg assistant";
      welcome.textContent = state.config ? state.config.welcomeMessage : "Hi! How can I help?";
      log.appendChild(welcome);

      var qs = state.config ? state.config.suggestedQuestions : [];
      if (qs.length) {
        var list = document.createElement("div");
        list.className = "suggestions";
        qs.forEach(function (q) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "chip";
          b.textContent = q;
          b.addEventListener("click", function () { send(q); });
          list.appendChild(b);
        });
        log.appendChild(list);
      }
      return;
    }

    state.messages.forEach(function (m) { log.appendChild(bubble(m)); });
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
  function inline(s) {
    return s.replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^\s)]+)\)|(https?:\/\/[^\s<]*[^\s<.,;:!?)\]])|\*\*([^*]+)\*\*/g,
      function (_, text, href, bare, bold) {
        if (href) return link(href, text);
        if (bare) return link(bare, bare);
        return "<strong>" + bold + "</strong>";
      }
    );
  }

  function link(href, text) {
    var external = /^https?:/.test(href);
    return '<a href="' + href + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + text + "</a>";
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
      "  display: flex; align-items: center; gap: 8px; padding: 12px 18px 12px 14px; border: 0; border-radius: 999px; cursor: pointer;",
      "  background: var(--primary); color: #fff; font: 600 15px/1 inherit; font-family: inherit; box-shadow: 0 6px 20px rgba(0,0,0,.25); }",
      ".launcher:hover { filter: brightness(1.08); }",
      ".launcher:focus-visible, button:focus-visible, textarea:focus-visible, a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }",

      ".panel { position: fixed; z-index: 2147483001; top: 0; right: 0; bottom: 0; width: 420px; max-width: 100vw;",
      "  display: flex; flex-direction: column; background: var(--bg); box-shadow: -8px 0 30px rgba(0,0,0,.18); animation: slide .2s ease-out; }",
      "@keyframes slide { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }",
      "@media (max-width: 640px) { .panel { width: 100vw; height: 100dvh; bottom: auto; } }",

      ".head { display: flex; align-items: center; gap: 4px; padding: 14px 10px 14px 18px; padding-top: max(14px, env(safe-area-inset-top));",
      "  background: var(--primary); color: #fff; }",
      ".head-text { flex: 1; min-width: 0; }",
      "h2 { margin: 0; font-size: 17px; font-weight: 700; }",
      ".subtitle { margin: 2px 0 0; font-size: 13px; opacity: .85; }",
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

      ".suggestions { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }",
      ".chip { text-align: left; padding: 9px 13px; border: 1px solid var(--line); border-radius: 12px; background: #fff; color: var(--ink);",
      "  font: inherit; font-size: 14px; cursor: pointer; }",
      ".chip:hover { border-color: var(--primary); color: var(--primary); }",

      ".typing { display: inline-flex; gap: 4px; padding: 4px 0; }",
      ".typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); animation: blink 1.2s infinite both; }",
      ".typing i:nth-child(2) { animation-delay: .2s; } .typing i:nth-child(3) { animation-delay: .4s; }",
      "@keyframes blink { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }",

      ".composer { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); background: var(--bg); }",
      // 16px font stops iOS Safari from zooming in when the field is focused.
      "textarea { flex: 1; resize: none; max-height: 120px; padding: 11px 14px; border: 1px solid var(--line); border-radius: 22px;",
      "  font: inherit; font-size: 16px; line-height: 1.35; color: var(--ink); background: #fff; }",
      ".send { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 50%;",
      "  background: var(--primary); color: #fff; cursor: pointer; }",
      ".send:disabled { opacity: .45; cursor: default; }",
      ".disclaimer { margin: 0; padding: 0 16px 10px; padding-bottom: max(10px, env(safe-area-inset-bottom)); font-size: 12px; color: var(--muted); background: var(--bg); text-align: center; }",

      "@media (prefers-reduced-motion: reduce) { .panel, .typing i { animation: none; } }",
    ].join("\n");
  }
})();
