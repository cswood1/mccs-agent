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
  var STATUS = "\u001d"; // wraps a status line ("Checking the latest MCCS info…") sent while a tool runs
  // Shown in place of typing dots until the answer starts. Same list as THINKING in lib/chat-client.ts.
  var THINKING = ["Hooking and jabbing, be right back…"];
  // Composer placeholder before the first message and after it.
  var PLACEHOLDER_FIRST = "Ask MCCS anything…";
  var PLACEHOLDER_FOLLOWUP = "Ask a follow-up…";
  var INPUT_MAX = 108; // about 4 lines, then the field scrolls

  // Header search (Ask MCCS search bar, see enhanceHeaderSearch).
  // Rotating placeholder: the invitation first, then natural example questions (§13). The sparkle
  // already signals Ask MCCS, so the questions stand on their own.
  // Header search placeholder: "Ask MCCS" stays, the rest of each suggestion types out.
  // Demo app slugs that differ from the real subdomain (same map as scripts/extract-theme.mjs).
  var SLUG_FOR_SUBDOMAIN = { lejeunenewriver: "lejeune" };
  var PLACEHOLDER_PREFIX = "Ask MCCS";
  var PLACEHOLDER_SUFFIXES = [
    " anything…",
    "… Gym hours today",
    "… Events this weekend",
    "… Child care on base",
    "… Where to eat lunch",
    "… Things to do on base",
    "… Lodging on base",
  ];
  var TYPE_MS = 35; // per character typed
  var HOLD_MS = 2000; // full suggestion shown
  var ERASE_MS = 300; // whole suggestion erased
  var PAUSE_POLL_MS = 250; // while focused or typed in
  var searchIndex = null;
  var search = { input: null, listbox: null, sheet: null, options: [], active: -1 };

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
    '<button class="edge-tab" type="button" aria-label="Open Ask MCCS" aria-haspopup="dialog" aria-expanded="false" aria-controls="panel" hidden>' +
      sparkle() + '<span class="edge-label" aria-hidden="true">Ask MCCS</span>' +
    "</button>" +
    '<section class="panel" id="panel" role="dialog" aria-modal="false" aria-labelledby="title" hidden>' +
      '<header class="head">' +
        '<div class="head-text">' +
          '<h2 id="title">' + sparkle() + '<span class="title-text">Ask MCCS</span></h2>' +
          '<p class="subtitle"></p><p class="context-line" hidden></p>' +
        "</div>" +
        '<button class="icon-btn reset" type="button" aria-label="Start a new chat" title="New chat">' + icon("refresh") + "</button>" +
        '<button class="icon-btn minimize" type="button" aria-label="Minimize Ask MCCS" title="Minimize">' + icon("minimize") + "</button>" +
      "</header>" +
      '<div class="sample-banner" hidden>Sample data — answers use placeholder content, not real MCCS information.</div>' +
      // The scrolling conversation: the messages (the live region) and, under the latest answer,
      // the suggested questions (outside the live region, so they aren't read out on every update).
      '<div class="log">' +
        '<div class="thread" role="log" aria-live="polite" aria-relevant="additions text"></div>' +
        '<div class="chips" role="group" aria-label="Suggested questions" hidden></div>' +
      "</div>" +
      '<div class="bottom">' +
        '<form class="composer">' +
          '<label class="sr-only" for="input">Message</label>' +
          '<div class="field">' +
            '<textarea id="input" rows="1" placeholder="' + PLACEHOLDER_FIRST + '" autocomplete="off" enterkeyhint="send"></textarea>' +
            '<button class="send" type="submit" aria-label="Send">' + icon("send") + "</button>" +
          "</div>" +
        "</form>" +
        '<p class="disclaimer">SI answers can be wrong. Check the linked MCCS page before you go.</p>' +
      "</div>" +
    "</section>";

  var launcher = root.querySelector(".launcher");
  var edgeTab = root.querySelector(".edge-tab");
  var panel = root.querySelector(".panel");
  var subtitleEl = root.querySelector(".subtitle");
  var contextEl = root.querySelector(".context-line");
  var sampleBanner = root.querySelector(".sample-banner");
  var log = root.querySelector(".log");
  var thread = root.querySelector(".thread");
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
  edgeTab.addEventListener("click", function () { setOpen(true); });
  root.querySelector(".minimize").addEventListener("click", function () { setOpen(false); });
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
  window.addEventListener("resize", function () { if (state.open) placePanel(); });

  document.body.appendChild(host);
  fetchConfig();
  fetchPage();
  enhanceHeaderSearch();
  // A manual refresh starts over with the full button and the panel closed (the chat itself is
  // kept). Navigating to another page keeps the panel open, or the edge tab if it was minimized.
  if (isReload()) {
    saveOpen(false);
    saveTab(false);
  }
  if (loadOpen()) setOpen(true, true);
  else showButton();

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

  // ---------- header search bar becomes Ask MCCS (docs/PRODUCT.md §13) ----------
  // The site's own search box (same CMS theme on every MCCS site) turns into a second entry point
  // to the same assistant and conversation: page chips on focus; while typing, an "Ask MCCS" row
  // plus instant matches from captured page titles and breadcrumbs (no AI calls). The dropdown
  // lives in the page's own DOM so combobox ARIA references work.

  function enhanceHeaderSearch() {
    if (script.getAttribute("data-header-search") === "0") return;
    var desktopInput = document.getElementById("main-search-input");
    var mobileTrigger = document.querySelector(".mobile-search-trigger");
    if (!desktopInput && !mobileTrigger) return;
    injectSearchStyles();

    var listbox = document.createElement("div");
    listbox.id = "mccs-ask-listbox";
    listbox.setAttribute("role", "listbox");
    listbox.setAttribute("aria-label", "Ask MCCS suggestions");
    listbox.hidden = true;
    document.body.appendChild(listbox);
    search.listbox = listbox;

    if (desktopInput) {
      desktopInput.removeAttribute("readonly");
      desktopInput.removeAttribute("data-bs-toggle");
      desktopInput.removeAttribute("data-bs-target");
      desktopInput.style.cursor = "";
      var magnifier = desktopInput.parentNode.querySelector("svg.bi-search");
      if (magnifier) magnifier.outerHTML = lightSparkle("mccs-ask-icon position-absolute top-50 end-0 translate-middle-y me-3", "#ffc72c", 18);
      setupCombobox(desktopInput);
      rotatePlaceholder(desktopInput);
    }

    if (mobileTrigger) {
      mobileTrigger.removeAttribute("data-bs-toggle");
      mobileTrigger.removeAttribute("data-bs-target");
      mobileTrigger.setAttribute("aria-label", "Ask MCCS");
      var micon = mobileTrigger.querySelector("svg");
      if (micon) micon.outerHTML = lightSparkle("mccs-ask-icon", "#ffc72c", 24);
      search.sheet = createSheet();
      mobileTrigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openSheet();
      }, true);
    }

    // Cmd/Ctrl+K, as the real site's badge suggests.
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (desktopInput && desktopInput.offsetParent !== null) desktopInput.focus();
        else if (search.sheet) openSheet();
      }
    });
    window.addEventListener("resize", positionListbox);
    window.addEventListener("scroll", positionListbox, true);
  }

  function lightSparkle(cls, color, size) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false" style="pointer-events: none; fill: ' + color + ';">' +
      '<path d="M12 2.5c.7 5.2 4.3 8.8 9.5 9.5-5.2.7-8.8 4.3-9.5 9.5-.7-5.2-4.3-8.8-9.5-9.5 5.2-.7 8.8-4.3 9.5-9.5z"/></svg>';
  }

  // Types each suggestion after "Ask MCCS", holds it, erases it quickly, then types the next.
  // While the box is focused or has text, the current suggestion is shown in full and waits.
  function rotatePlaceholder(input) {
    var i = 0;
    var shown = PLACEHOLDER_SUFFIXES[0].length;
    var show = function () { input.placeholder = PLACEHOLDER_PREFIX + PLACEHOLDER_SUFFIXES[i].slice(0, shown); };
    show();
    // Typing text is motion too: keep it still for people who ask for reduced motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var paused = function () { return document.activeElement === input || !!input.value; };

    function wait() {
      shown = PLACEHOLDER_SUFFIXES[i].length;
      show();
      setTimeout(function () {
        if (paused()) wait();
        else setTimeout(erase, HOLD_MS);
      }, PAUSE_POLL_MS);
    }
    function erase() {
      if (paused()) return wait();
      if (shown > 0) {
        shown--;
        show();
        return setTimeout(erase, ERASE_MS / PLACEHOLDER_SUFFIXES[i].length);
      }
      i = (i + 1) % PLACEHOLDER_SUFFIXES.length;
      type();
    }
    function type() {
      if (paused()) return wait();
      if (shown < PLACEHOLDER_SUFFIXES[i].length) {
        shown++;
        show();
        return setTimeout(type, TYPE_MS);
      }
      setTimeout(erase, HOLD_MS);
    }
    setTimeout(erase, HOLD_MS);
  }

  function setupCombobox(input) {
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", search.listbox.id);
    // A fixed name, so screen readers don't announce the typing placeholder.
    input.setAttribute("aria-label", "Ask MCCS");
    input.setAttribute("autocomplete", "off");
    input.addEventListener("focus", function () {
      search.input = input;
      loadSearchIndex();
      buildOptions();
    });
    input.addEventListener("input", buildOptions);
    input.addEventListener("blur", function () {
      // Option clicks keep focus (mousedown is cancelled), so a blur means leaving the box.
      setTimeout(function () { if (document.activeElement !== input) closeListbox(); }, 0);
    });
    input.addEventListener("keydown", function (e) {
      var n = search.options.length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (search.listbox.hidden) buildOptions();
        if (!n) return;
        search.active = e.key === "ArrowDown" ? (search.active + 1) % n : (search.active <= 0 ? n - 1 : search.active - 1);
        renderListbox();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (search.active >= 0 && search.options[search.active]) choose(search.options[search.active]);
        else if (input.value.trim()) choose({ type: "ask", text: input.value.trim() });
      } else if (e.key === "Escape") {
        if (!search.listbox.hidden) {
          e.preventDefault();
          closeListbox();
        } else if (search.sheet && !search.sheet.hidden) {
          closeSheet();
        } else {
          input.blur();
        }
      } else if (e.key === "Tab") {
        closeListbox();
      }
    });
  }

  function loadSearchIndex() {
    if (searchIndex) return;
    searchIndex = loadJSON(storageKey + ":pages", null);
    if (searchIndex) return;
    searchIndex = [];
    fetch(apiBase + "/api/installations/" + encodeURIComponent(installationId) + "/pages", { headers: apiHeaders })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !Array.isArray(d.pages)) return;
        searchIndex = d.pages;
        try { sessionStorage.setItem(storageKey + ":pages", JSON.stringify(d.pages)); } catch { /* ignore */ }
        if (search.input && document.activeElement === search.input) buildOptions();
      })
      .catch(function () { /* page matches just won't show */ });
  }

  /** Up to 5 captured pages whose title (best) or breadcrumb matches every word typed. */
  function pageMatches(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || !searchIndex) return [];
    var kindPenalty = { page: 0, event: 0.5, story: 1 };
    return searchIndex
      .map(function (p) {
        var title = p.title.toLowerCase();
        var all = title + " " + (p.breadcrumb || []).join(" ").toLowerCase();
        var score = 0;
        if (words.every(function (w) { return title.indexOf(w) >= 0; })) score = title.indexOf(words[0]) === 0 ? 4 : 3;
        else if (words.every(function (w) { return all.indexOf(w) >= 0; })) score = 1.5;
        return { p: p, score: score ? score - (kindPenalty[p.kind] || 0) : 0 };
      })
      .filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score || a.p.title.length - b.p.title.length; })
      .slice(0, 5)
      .map(function (x) { return x.p; });
  }

  function localPagePath(path) {
    return demoHost && pathPrefix ? pathPrefix + (path === "/" ? "" : path) : path;
  }

  function buildOptions() {
    var q = search.input ? search.input.value.trim() : "";
    var opts = [];
    if (!q) {
      var chips = (state.page && state.page.chips) || (state.config && state.config.defaultChips) || [];
      chips.slice(0, 4).forEach(function (c) { opts.push({ type: "ask", text: c, label: c, chip: true }); });
    } else {
      opts.push({ type: "ask", text: q, label: "Ask MCCS: ‘" + q + "’" });
      pageMatches(q).forEach(function (p) {
        opts.push({ type: "page", href: localPagePath(p.path), title: p.title, crumb: (p.breadcrumb || []).join(" › "), kind: p.kind });
      });
    }
    search.options = opts;
    search.active = q ? 0 : -1; // with text, Enter asks by default
    renderListbox();
  }

  function renderListbox() {
    var lb = search.listbox;
    lb.innerHTML = "";
    if (!search.options.length) return closeListbox();
    if (search.options[0].chip) {
      var heading = document.createElement("div");
      heading.className = "mccs-ask-heading";
      heading.setAttribute("role", "presentation");
      heading.textContent = "Suggested for this page";
      lb.appendChild(heading);
    }
    search.options.forEach(function (o, i) {
      var el = document.createElement("div");
      el.id = "mccs-ask-opt-" + i;
      el.setAttribute("role", "option");
      el.setAttribute("aria-selected", String(i === search.active));
      el.className = "mccs-ask-option mccs-ask-" + o.type;
      if (o.type === "ask") {
        el.innerHTML = lightSparkle("mccs-ask-sparkle", "#9e1b32", 16);
        var t = document.createElement("span");
        t.textContent = o.label;
        el.appendChild(t);
      } else {
        var body = document.createElement("span");
        body.className = "mccs-ask-page";
        var title = document.createElement("span");
        title.className = "mccs-ask-title";
        title.textContent = o.title;
        body.appendChild(title);
        if (o.crumb || o.kind !== "page") {
          var crumb = document.createElement("span");
          crumb.className = "mccs-ask-crumb";
          crumb.textContent = [o.crumb, o.kind === "story" ? "Story" : o.kind === "event" ? "Event" : ""].filter(Boolean).join(" · ");
          body.appendChild(crumb);
        }
        el.appendChild(body);
      }
      el.addEventListener("mousedown", function (e) { e.preventDefault(); });
      el.addEventListener("click", function () { choose(o); });
      lb.appendChild(el);
    });
    lb.hidden = false;
    search.input.setAttribute("aria-expanded", "true");
    if (search.active >= 0) search.input.setAttribute("aria-activedescendant", "mccs-ask-opt-" + search.active);
    else search.input.removeAttribute("aria-activedescendant");
    positionListbox();
  }

  function positionListbox() {
    if (!search.input || search.listbox.hidden) return;
    var r = search.input.getBoundingClientRect();
    var width = Math.min(Math.max(r.width, 360), window.innerWidth - 16);
    var left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    search.listbox.style.top = r.bottom + 6 + "px";
    search.listbox.style.left = left + "px";
    search.listbox.style.width = width + "px";
  }

  function closeListbox() {
    search.listbox.hidden = true;
    search.active = -1;
    if (search.input) {
      search.input.setAttribute("aria-expanded", "false");
      search.input.removeAttribute("aria-activedescendant");
    }
  }

  function choose(o) {
    closeListbox();
    if (o.type === "page") {
      location.href = o.href;
      return;
    }
    // Same panel and conversation as the floating button, with the question already sent.
    var input = search.input;
    if (input) {
      input.value = "";
      input.blur();
    }
    closeSheet();
    setOpen(true);
    send(o.text);
  }

  // Phones (and narrow screens): the header's search icon opens a search sheet at the top.
  function createSheet() {
    var sheet = document.createElement("div");
    sheet.id = "mccs-ask-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", "Ask MCCS");
    sheet.hidden = true;
    sheet.innerHTML =
      '<div class="mccs-ask-sheet-bar">' +
        lightSparkle("mccs-ask-sheet-sparkle", "#ffc72c", 20) +
        '<input id="mccs-ask-sheet-input" type="search" enterkeyhint="search">' +
        '<button type="button" class="mccs-ask-sheet-close" aria-label="Close">' + icon("close") + "</button>" +
      "</div>";
    document.body.appendChild(sheet);
    var input = sheet.querySelector("input");
    setupCombobox(input);
    rotatePlaceholder(input);
    sheet.querySelector(".mccs-ask-sheet-close").addEventListener("click", closeSheet);
    return sheet;
  }

  function openSheet() {
    if (!search.sheet) return;
    search.sheet.hidden = false;
    search.sheet.querySelector("input").focus();
  }

  function closeSheet() {
    if (search.sheet && !search.sheet.hidden) {
      search.sheet.hidden = true;
      closeListbox();
    }
  }

  function injectSearchStyles() {
    if (document.getElementById("mccs-ask-style")) return;
    var st = document.createElement("style");
    st.id = "mccs-ask-style";
    st.textContent = [
      "#main-search-input[role=combobox] { cursor: text; padding-right: 2.6rem; text-overflow: ellipsis; }",
      "#main-search-input[role=combobox]::placeholder, #mccs-ask-sheet input::placeholder { opacity: 1; }",
      "#mccs-ask-listbox { position: fixed; z-index: 2147482990; box-sizing: border-box; max-height: min(70vh, 460px); overflow-y: auto; padding: 6px;",
      "  background: #fff; color: #212529; border: 1px solid #dee2e6; border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,.2);",
      "  font: 15px/1.35 'Noto Sans', system-ui, -apple-system, sans-serif; text-align: left; }",
      "#mccs-ask-listbox[hidden], #mccs-ask-sheet[hidden] { display: none !important; }",
      "#mccs-ask-listbox .mccs-ask-heading { padding: 6px 10px 4px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #6c757d; }",
      "#mccs-ask-listbox .mccs-ask-option { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; cursor: pointer; }",
      "#mccs-ask-listbox .mccs-ask-option:hover, #mccs-ask-listbox .mccs-ask-option[aria-selected=true] { background: #f1f3f5; }",
      "#mccs-ask-listbox .mccs-ask-ask { color: #9e1b32; font-weight: 600; }",
      "#mccs-ask-listbox .mccs-ask-sparkle { flex: none; }",
      "#mccs-ask-listbox .mccs-ask-page { display: flex; flex-direction: column; min-width: 0; padding-left: 26px; }",
      "#mccs-ask-listbox .mccs-ask-title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }",
      "#mccs-ask-listbox .mccs-ask-crumb { font-size: 12px; color: #6c757d; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }",
      "#mccs-ask-sheet { position: fixed; z-index: 2147482995; top: 0; left: 0; right: 0; padding: 10px 12px; padding-top: max(10px, env(safe-area-inset-top));",
      "  background: #0C2340; box-shadow: 0 6px 20px rgba(0,0,0,.3); }",
      "#mccs-ask-sheet .mccs-ask-sheet-bar { display: flex; align-items: center; gap: 10px; }",
      "#mccs-ask-sheet input { flex: 1; min-width: 0; height: 44px; padding: 0 14px; border: 1px solid rgba(255,255,255,.35); border-radius: 8px;",
      "  background: rgba(255,255,255,.12); color: #fff; font: 16px 'Noto Sans', system-ui, sans-serif; outline: none; }",
      "#mccs-ask-sheet input::placeholder { color: rgba(255,255,255,.75); }",
      "#mccs-ask-sheet input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }",
      "#mccs-ask-sheet input:focus { border-color: #ffc72c; }",
      "#mccs-ask-sheet .mccs-ask-sheet-close { display: grid; place-items: center; width: 44px; height: 44px; border: 0; background: none; color: #fff; cursor: pointer; }",
    ].join("\n");
    document.head.appendChild(st);
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
    var changed = open !== state.open;
    // The control the window grows out of (or the corner, when opened another way).
    var opener = !edgeTab.hidden ? edgeTab : !launcher.hidden ? launcher : null;
    var openerRect = opener && opener.getBoundingClientRect();
    state.open = open;
    saveOpen(open);
    if (open) {
      panel.hidden = false;
      placePanel();
      // Once the chat has been opened this session, minimizing leaves the compact edge tab.
      saveTab(true);
    }
    showButton();
    // Full-screen on phones: stop the page underneath from scrolling.
    document.documentElement.style.overflow = open && isPhone() ? "hidden" : "";
    if (open) {
      hideNudge();
      warmCache();
      render();
      scrollToEnd();
      if (changed && !restoring) animateOpen(openerRect);
      if (!(restoring && isPhone())) input.focus({ preventScroll: true });
    } else {
      var button = edgeTab.hidden ? launcher : edgeTab;
      if (changed) animateClose(button);
      else panel.hidden = true;
      button.focus();
    }
  }

  // ---------- open and minimize motion (Web Animations; the final state never depends on it) ----------
  // A gentle spring: a very slight overshoot that settles cleanly.
  var SPRING = "cubic-bezier(.32, 1.24, .52, 1)";
  var panelAnim = null;
  var contentAnims = [];
  var buttonAnims = [];

  function motionMode() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced";
    return isPhone() ? "sheet" : "window";
  }

  // Stops any open/minimize animation in flight and returns where the window was, so the next one
  // starts from there: a click mid-animation reverses smoothly instead of jumping.
  function stopPanelMotion() {
    var live = null;
    if (panelAnim) {
      if (panelAnim.playState === "running") {
        var cs = getComputedStyle(panel);
        live = { opacity: cs.opacity, transform: cs.transform };
      }
      panelAnim.onfinish = null;
      panelAnim.cancel();
      panelAnim = null;
    }
    contentAnims.forEach(function (a) { a.cancel(); });
    buttonAnims.forEach(function (a) { a.cancel(); });
    contentAnims = [];
    buttonAnims = [];
    panel.style.pointerEvents = "";
    return live;
  }

  // transform-origin at the center of a control, in the window's own (untransformed) coordinates.
  function originAt(rect) {
    if (!rect) return "100% 100%";
    var x = rect.left + rect.width / 2 - panel.offsetLeft;
    var y = rect.top + rect.height / 2 - panel.offsetTop;
    return Math.round(x) + "px " + Math.round(y) + "px";
  }

  function animateOpen(openerRect) {
    if (!panel.animate) return;
    var live = stopPanelMotion();
    var mode = motionMode();
    if (mode === "reduced") {
      panelAnim = panel.animate([{ opacity: live ? live.opacity : 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
    } else if (mode === "sheet") {
      panelAnim = panel.animate([{ transform: live ? live.transform : "translateY(100%)" }, { transform: "none" }], { duration: 280, easing: SPRING });
    } else {
      if (!live) panel.style.transformOrigin = originAt(openerRect);
      panelAnim = panel.animate(
        [{ opacity: live ? live.opacity : 0, transform: live ? live.transform : "translateX(16px) scale(.9)" }, { opacity: 1, transform: "none" }],
        { duration: 300, easing: SPRING }
      );
      // The inside follows a beat later: header, then conversation, then composer.
      if (!live) {
        [root.querySelector(".head"), log, root.querySelector(".bottom")].forEach(function (el, i) {
          contentAnims.push(el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
            { duration: 240, delay: 90 + i * 40, easing: "cubic-bezier(.2, .7, .3, 1)", fill: "backwards" }));
        });
      }
    }
    var a = panelAnim;
    a.onfinish = function () { if (panelAnim === a) panelAnim = null; };
  }

  function animateClose(button) {
    if (!panel.animate) { panel.hidden = true; return; }
    var live = stopPanelMotion() || { opacity: "1", transform: "none" };
    var mode = motionMode();
    var duration;
    panel.style.pointerEvents = "none";
    if (mode === "reduced") {
      duration = 150;
      panelAnim = panel.animate([{ opacity: live.opacity }, { opacity: 0 }], { duration: duration, easing: "ease-in", fill: "forwards" });
    } else if (mode === "sheet") {
      duration = 280;
      panelAnim = panel.animate([{ transform: live.transform, opacity: live.opacity }, { transform: "translateY(100%)", opacity: live.opacity }], { duration: duration, easing: SPRING, fill: "forwards" });
    } else {
      duration = 200;
      if (live.transform === "none") panel.style.transformOrigin = originAt(button.getBoundingClientRect());
      panelAnim = panel.animate([{ opacity: live.opacity, transform: live.transform }, { opacity: 0, transform: "translateX(8px) scale(.9)" }],
        { duration: duration, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" });
    }
    var a = panelAnim;
    a.onfinish = function () {
      if (panelAnim !== a) return;
      panelAnim = null;
      if (!state.open) panel.hidden = true;
      panel.style.pointerEvents = "";
      a.cancel();
    };
    arrive(button, mode, duration);
  }

  // The button arrives once the window has gone: a small pop and one sparkle glint (a fade with
  // reduced motion). It's shown and focused at once; fill: backwards keeps it invisible until then.
  function arrive(button, mode, delay) {
    if (mode === "reduced") {
      buttonAnims.push(button.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay: delay, easing: "ease-out", fill: "backwards" }));
      return;
    }
    var origin = button === edgeTab ? "100% 50%" : "50% 50%";
    buttonAnims.push(button.animate([
      { opacity: 0, transform: "scale(.85)", transformOrigin: origin },
      { opacity: 1, transform: "scale(1.04)", transformOrigin: origin, offset: 0.65 },
      { opacity: 1, transform: "scale(1)", transformOrigin: origin },
    ], { duration: 260, delay: delay, easing: "ease-out", fill: "backwards" }));
    var spark = button.querySelector(".sparkle");
    var glow = getComputedStyle(spark).filter;
    buttonAnims.push(spark.animate([
      { filter: glow, transform: "none" },
      { filter: "drop-shadow(0 0 9px rgba(255,236,160,1)) brightness(1.3)", transform: "scale(1.18) rotate(14deg)", offset: 0.4 },
      { filter: glow, transform: "none" },
    ], { duration: 520, delay: delay + 140, easing: "ease-in-out" }));
  }

  // The floating window starts below the demo site's banner when there is one (it scrolls with the
  // page, so its height is reserved whatever the scroll position).
  function placePanel() {
    var banner = document.querySelector(".demo-banner");
    panel.style.setProperty("--top-offset", (banner ? banner.offsetHeight : 0) + "px");
  }

  // The full "Ask MCCS" button, or the edge tab once the chat has been used this session.
  function showButton() {
    var tab = loadJSON(storageKey + ":tab", false);
    launcher.hidden = state.open || tab;
    edgeTab.hidden = state.open || !tab;
    launcher.setAttribute("aria-expanded", String(state.open));
    edgeTab.setAttribute("aria-expanded", String(state.open));
  }

  function saveTab(on) {
    try { sessionStorage.setItem(storageKey + ":tab", String(on)); } catch { /* ignore */ }
  }

  function isReload() {
    try {
      var nav = performance.getEntriesByType("navigation")[0];
      return !!nav && nav.type === "reload";
    } catch {
      return false;
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
    var reply = { role: "assistant", content: "", thinking: THINKING[0] }; // thinking: display only
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
            var parsed = parseStream(raw.split(FRAME)[0]);
            reply.content = parsed.text;
            reply.status = parsed.status;
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
        delete reply.status; // display only, never saved
        delete reply.thinking;
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

  /**
   * Answer text without status frames, and the status to show: the latest complete one, until
   * answer text arrives after it. A frame still arriving is left out.
   */
  function parseStream(answer) {
    var parts = answer.split(STATUS);
    var text = "";
    var status = "";
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        text += parts[i];
        if (parts[i].trim()) status = "";
      } else if (i < parts.length - 1) {
        status = parts[i];
      }
    }
    return { text: text, status: status };
  }

  // ---------- rendering ----------
  function render() {
    sendBtn.disabled = state.busy;
    input.placeholder = state.messages.length ? PLACEHOLDER_FOLLOWUP : PLACEHOLDER_FIRST;
    thread.innerHTML = "";
    renderChips();

    if (!state.messages.length) {
      var welcome = document.createElement("div");
      welcome.className = "msg assistant";
      welcome.textContent = (state.page && state.page.welcome) || (state.config ? state.config.welcomeMessage : "Hi! How can I help?");
      thread.appendChild(welcome);
      return;
    }

    state.messages.forEach(function (m) { thread.appendChild(bubble(m)); });
  }

  // Under the latest answer (or the welcome): follow-ups from the last answer on this page, else this
  // page's chips (page → section → home). Hidden while an answer is streaming.
  function renderChips() {
    var items = [];
    if (state.followups && state.followups.path === currentPath && state.messages.length) items = state.followups.items;
    else if (state.page && state.page.chips) items = state.page.chips.slice(0, 4);
    else if (state.config && state.config.defaultChips) items = state.config.defaultChips.slice(0, 4);
    chipsEl.innerHTML = '<p class="chips-label" aria-hidden="true">Suggested</p>';
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
    var el = thread.lastElementChild;
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
      // Waiting: the tool status if a tool is running, else the thinking phrase. role="status" is
      // announced once; the shimmer is CSS only.
      el.innerHTML = m.status ? '<span class="status" role="status"></span>' : '<span class="thinking" role="status"></span>';
      if (!m.status) el.querySelector(".thinking").textContent = m.thinking || THINKING[0];
    } else {
      el.innerHTML = markdown(m.content);
      if (m.status) el.insertAdjacentHTML("beforeend", '<p class="status" role="status"></p>');
    }
    if (m.status) el.querySelector(".status").textContent = m.status;
    return el;
  }

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, INPUT_MAX) + "px";
  }

  function isPhone() {
    return window.matchMedia("(max-width: 767px)").matches;
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
      // Only what the conversation needs; a tool status line is display-only.
      var saved = state.messages.slice(-30).map(function (m) { return m.error ? { role: m.role, content: m.content, error: true } : { role: m.role, content: m.content }; });
      sessionStorage.setItem(storageKey, JSON.stringify(saved));
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
    if (demoHost && m) return "/" + (SLUG_FOR_SUBDOMAIN[m[1]] || m[1]) + (path === "/" ? "" : path);
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
      minimize: '<path d="M9 5l7 7-7 7"/>',
      send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
      refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    };
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + "</svg>";
  }

  function css() {
    return [
      ":host { --primary: #9e1b32; --accent: #ffc72c; --ink: #1c1c1e; --muted: #5f6368; --line: #e3e3e6; --bg: #ffffff; --soft: #f4f4f6; --navy: #1d3954;",
      "  all: initial; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.45; color: var(--ink); }",
      "*, *::before, *::after { box-sizing: border-box; }",
      "[hidden] { display: none !important; }",
      ".sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }",

      ".launcher { position: fixed; z-index: 2147483000; right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom));",
      "  display: flex; align-items: center; gap: 9px; padding: 13px 21px 13px 16px; border: 2px solid transparent; border-radius: 999px; cursor: pointer;",
      // Soft scarlet-to-gold gradient border (the outer layer shows only through the transparent border).
      "  background: linear-gradient(var(--primary), var(--primary)) padding-box,",
      "    linear-gradient(110deg, var(--primary) 0%, var(--accent) 45%, #fff3c4 50%, var(--accent) 55%, var(--primary) 100%) border-box;",
      "  background-size: 100% 100%, 250% 100%; background-position: 0 0, 100% 0;",
      // Solid red with white text; a crisp soft shadow and a 1px light ring separate it from busy pages.
      "  color: #fff; font-family: inherit; font-size: 17px; font-weight: 700; line-height: 1;",
      "  box-shadow: 0 0 0 1px rgba(255,255,255,.55), 0 2px 4px rgba(0,0,0,.18), 0 10px 24px rgba(0,0,0,.24);",
      // The border shimmers once on page load.
      "  animation: launcher-shimmer 1.6s ease-in-out .6s 1 both; }",
      "@keyframes launcher-shimmer { from { background-position: 0 0, 100% 0; } to { background-position: 0 0, 0% 0; } }",
      ".launcher:hover { filter: brightness(1.08); }",
      ".sparkle { width: 20px; height: 20px; flex: none; fill: var(--accent); }",
      ".launcher .sparkle { width: 25px; height: 25px; filter: drop-shadow(0 0 3px rgba(255,199,44,.45)); }",
      ".launcher:focus-visible, button:focus-visible, textarea:focus-visible, a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }",

      // Compact edge tab: a half-pill flush with the right edge, at the full button's height.
      // Kept small (46 x 56) so it covers little page content and stays clear of the
      // phone's edge swipe-back strip above it. On hover or keyboard focus it slides out to the
      // left to show the label; touch screens have no hover, so a tap just opens the panel.
      ".edge-tab { position: fixed; z-index: 2147483000; right: 0; bottom: max(16px, env(safe-area-inset-bottom));",
      "  display: flex; align-items: center; height: 56px; padding: 0 calc(11px + env(safe-area-inset-right)) 0 12px;",
      "  border: 0; border-radius: 28px 0 0 28px; background: var(--primary); color: #fff; font-family: inherit; font-size: 16px; font-weight: 700; line-height: 1; cursor: pointer;",
      "  box-shadow: 0 0 0 1px rgba(255,255,255,.5), -2px 4px 16px rgba(0,0,0,.28); animation: edge-glow 2.4s ease-in-out infinite; }",
      "@keyframes edge-glow { 0%, 100% { box-shadow: 0 0 0 1px rgba(255,255,255,.5), -2px 4px 16px rgba(0,0,0,.28), 0 0 0 0 rgba(255,199,44,0); }",
      "  50% { box-shadow: 0 0 0 1px rgba(255,255,255,.5), -2px 4px 16px rgba(0,0,0,.28), 0 0 18px 4px rgba(255,199,44,.6); } }",
      ".edge-tab:hover { filter: brightness(1.08); }",
      ".edge-tab .sparkle { width: 23px; height: 23px; filter: drop-shadow(0 0 4px rgba(255,199,44,.75)); }",
      ".edge-label { display: block; max-width: 0; margin-left: 0; overflow: hidden; white-space: nowrap; opacity: 0;",
      "  transition: max-width .2s ease-out, margin-left .2s ease-out, opacity .2s ease-out; }",
      "@media (hover: hover) { .edge-tab:hover .edge-label { max-width: 90px; margin-left: 8px; opacity: 1; } }",
      ".edge-tab:focus-visible .edge-label { max-width: 90px; margin-left: 8px; opacity: 1; }",
      ".edge-tab:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }",

      // Floating window flush with the right edge: below the demo banner (when there is one), 24px
      // from the top and bottom, at most 960px tall and centered in that space. Left corners rounded;
      // the content clips to the shape.
      ".panel { position: fixed; z-index: 2147483001; right: 0; top: calc(var(--top-offset, 0px) + 24px); bottom: 24px; width: 420px; max-width: 100vw;",
      "  max-height: 960px; margin: auto 0; border-radius: 18px 0 0 18px; overflow: hidden;",
      // Hairline, a faint warm glow on the page side, and a slightly stronger floating shadow.
      "  display: flex; flex-direction: column; background: var(--bg); border: 1px solid rgba(17,24,39,.12); border-right: 0;",
      "  box-shadow: -1px 0 10px rgba(255,199,44,.10), -20px 8px 56px -6px rgba(15,23,42,.30), 0 2px 8px rgba(15,23,42,.08); }",
      // Open and minimize motion is in animateOpen / animateClose (Web Animations).
      // Phones: a near-full-screen sheet with rounded top corners and a small gap above it.
      "@media (max-width: 767px) { .panel { top: calc(10px + env(safe-area-inset-top)); bottom: auto; left: 0; width: 100vw; height: calc(100dvh - 10px - env(safe-area-inset-top));",
      "  max-height: none; margin: 0; border: 0; border-radius: 18px 18px 0 0; box-shadow: 0 -8px 32px rgba(15,23,42,.28); }",
      "  .panel .head { padding-top: 8px; } }",

      // Slim header (about 72px): tight padding and line heights; the 44px icon buttons set the floor.
      ".head { flex: none; display: flex; align-items: center; gap: 4px; min-height: 72px; padding: 8px 8px 8px 18px; padding-top: max(8px, env(safe-area-inset-top));",
      "  background: var(--primary); color: #fff; }",
      ".head-text { flex: 1; min-width: 0; }",
      "h2 { margin: 0; display: flex; align-items: center; gap: 7px; font-size: 17px; font-weight: 700; line-height: 1.2; }",
      "h2 .sparkle { width: 18px; height: 18px; }",
      ".subtitle { margin: 2px 0 0; font-size: 13px; line-height: 1.3; opacity: .85; }",
      ".context-line { margin: 0; font-size: 12px; line-height: 1.3; opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
      ".icon-btn { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 10px; background: transparent; color: inherit; cursor: pointer; }",
      ".icon-btn:hover { background: rgba(255,255,255,.15); }",

      ".sample-banner { padding: 8px 18px; background: #fff4cc; color: #5c4400; font-size: 13px; border-bottom: 1px solid #f0dc8c; }",

      ".log { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 16px; background: var(--soft); }",
      ".thread { display: flex; flex-direction: column; gap: 10px; }",
      ".msg { max-width: 88%; padding: 10px 14px; border-radius: 16px; overflow-wrap: anywhere; }",
      ".msg.user { align-self: flex-end; background: var(--primary); color: #fff; border-bottom-right-radius: 4px; white-space: pre-wrap; }",
      ".msg.assistant { align-self: flex-start; background: #fff; border: 1px solid var(--line); border-bottom-left-radius: 4px; }",
      ".msg.error { border-color: #e2a3a3; background: #fff5f5; }",
      ".msg p { margin: 0 0 8px; } .msg p:last-child { margin-bottom: 0; }",
      ".msg ul, .msg ol { margin: 4px 0 8px; padding-left: 20px; } .msg li { margin: 2px 0; }",
      ".msg a { color: var(--primary); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }",

      // Suggested questions under the latest answer: secondary to the answer, compact and wrapping.
      ".chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }",
      ".chips-label { flex-basis: 100%; margin: 0 0 1px 2px; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }",
      ".chip { display: inline-flex; align-items: center; max-width: 100%; min-height: 36px; padding: 6px 12px; border: 0; border-radius: 18px;",
      "  background: #f6e8eb; color: #7a1426; font: inherit; font-size: 14px; line-height: 1.35; text-align: left; white-space: normal; overflow-wrap: anywhere; cursor: pointer; }",
      ".chip:hover, .chip:focus-visible { background: #efd6db; }",
      ".chip:focus-visible { outline: 2px solid var(--navy); outline-offset: 2px; }",
      "@media (pointer: coarse) { .chip { min-height: 44px; } }",
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
      // Thinking phrase until the answer starts: italic, muted, a gentle shimmer sweep.
      ".thinking { display: inline-block; padding: 2px 0; font-size: 14px; font-style: italic; color: var(--muted);",
      "  background: linear-gradient(100deg, var(--muted) 35%, #c3c7ce 50%, var(--muted) 65%) 0 0 / 250% 100%; -webkit-background-clip: text; background-clip: text;",
      "  -webkit-text-fill-color: transparent; animation: thinking-shimmer 1.8s linear infinite; }",
      "@keyframes thinking-shimmer { from { background-position: 100% 0; } to { background-position: 0% 0; } }",
      // Tool status ("Checking Camp Pendleton…") in place of the thinking phrase.
      ".status { display: block; color: var(--muted); font-size: 14px; font-style: italic; animation: status-pulse 1.6s ease-in-out infinite; }",
      ".msg p.status { margin: 8px 0 0; }",
      "@keyframes status-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }",

      // Bottom zone: a faint tint and a hairline above it, the composer, then the disclaimer.
      ".bottom { flex: none; padding: 12px 12px 0; background: #fafafb; border-top: 1px solid var(--line); }",
      // One slim field with the send button inside it; the field shows the focus ring.
      ".field { display: flex; align-items: flex-end; border: 1px solid #d5d7dc; border-radius: 23px; background: #fff; }",
      ".field:focus-within { border-color: var(--navy); box-shadow: 0 0 0 1px var(--navy); }",
      // 16px font stops iOS Safari from zooming in when the field is focused.
      "textarea { flex: 1; min-width: 0; resize: none; max-height: 108px; padding: 11px 4px 11px 16px; border: 0; border-radius: 22px; outline: none;",
      "  font: inherit; font-size: 16px; line-height: 1.35; color: var(--ink); background: transparent; }",
      "textarea:focus-visible { outline: none; }",
      // A 44px tap target drawn as a 34px red circle.
      ".send { flex: none; display: grid; place-items: center; width: 44px; height: 44px; padding: 5px; border: 0; border-radius: 50%;",
      "  background: var(--primary) content-box; color: #fff; cursor: pointer; }",
      ".send svg { width: 17px; height: 17px; margin-left: -1px; }",
      ".send:disabled { opacity: .45; cursor: default; }",
      ".send:focus-visible { outline: 2px solid var(--navy); outline-offset: -1px; }",
      ".disclaimer { margin: 0; padding: 6px 4px 8px; padding-bottom: max(8px, env(safe-area-inset-bottom)); font-size: 11px; line-height: 1.3; color: var(--muted); text-align: center; text-wrap: balance; }",

      "@media (prefers-reduced-motion: reduce) { .typing i, .nudge, .launcher, .edge-tab, .status, .thinking { animation: none; } .thinking { -webkit-text-fill-color: currentColor; background: none; } .edge-label { transition: none; } }",
    ].join("\n");
  }
})();
