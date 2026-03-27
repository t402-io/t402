/* T402 Explorer Client — DOM-only, no innerHTML */
(function () {
  "use strict";

  const API_BASE = "/api/v1";
  let currentPage = 1;
  let currentCursor = null;
  const cursorStack = [];

  function createElement(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "textContent") el.textContent = v;
        else if (k === "className") el.className = v;
        else if (k.startsWith("data-")) el.setAttribute(k, v);
        else el.setAttribute(k, v);
      }
    }
    if (children) {
      for (const child of Array.isArray(children) ? children : [children]) {
        if (typeof child === "string") el.appendChild(document.createTextNode(child));
        else if (child) el.appendChild(child);
      }
    }
    return el;
  }

  function formatAddress(addr) {
    if (!addr || addr.length <= 16) return addr || "";
    return addr.slice(0, 8) + "\u2026" + addr.slice(-6);
  }

  function formatHash(hash) {
    if (!hash || hash.length <= 20) return hash || "";
    return hash.slice(0, 10) + "\u2026" + hash.slice(-6);
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  var FACILITATOR_ADDRESS = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";

  var NETWORK_NAMES = { "eip155:1": "Ethereum", "eip155:8453": "Base", "eip155:42161": "Arbitrum", "eip155:137": "Polygon", "eip155:10": "Optimism", "eip155:56": "BNB Chain", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "Solana", "ton:mainnet": "TON", "tron:mainnet": "TRON", "stellar:pubnet": "Stellar" };

  function getNetworkName(caip2) {
    if (!caip2) return "";
    if (NETWORK_NAMES[caip2]) return NETWORK_NAMES[caip2];
    var parts = caip2.split(":");
    if (parts[0] === "eip155") return "EVM (" + parts[1] + ")";
    return caip2;
  }

  function getDecimals(token, network) {
    if (network && network.startsWith("stellar:") && token === "USDC") return 7;
    if (network === "eip155:56" || network === "eip155:42220") return 18;
    return 6;
  }

  function formatAmount(amountStr, token, network) {
    if (!amountStr) return "0.00";
    var decimals = getDecimals(token, network);
    try {
      var raw = BigInt(amountStr);
      var divisor = BigInt(Math.pow(10, decimals));
      var whole = raw / divisor;
      var frac = raw % divisor;
      return whole.toString() + "." + frac.toString().padStart(decimals, "0").slice(0, 2);
    } catch (e) { return amountStr; }
  }

  function formatTime(isoStr) {
    if (!isoStr) return "";
    var ms = Date.now() - new Date(isoStr).getTime();
    var s = Math.floor(ms / 1000);
    if (s < 60) return s + "s ago";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  }

  function buildTxRow(tx) {
    const tr = createElement("tr", { "data-hash": tx.txHash });
    tr.addEventListener("click", function () {
      window.location.href = "/tx/" + encodeURIComponent(tx.txHash);
    });
    tr.appendChild(createElement("td", {}, createElement("code", { textContent: formatHash(tx.txHash) })));
    tr.appendChild(createElement("td", {}, createElement("span", { className: "badge", textContent: getNetworkName(tx.network) })));
    tr.appendChild(createElement("td", {}, createElement("span", { className: "badge badge-token", textContent: tx.token })));
    tr.appendChild(createElement("td", { className: "amount", textContent: "$" + formatAmount(tx.amount, tx.token, tx.network) })));
    tr.appendChild(createElement("td", {}, createElement("code", { textContent: formatAddress(tx.from) })));
    var toEl;
    if (tx.to && tx.to.toLowerCase() === FACILITATOR_ADDRESS.toLowerCase()) {
      toEl = createElement("span", { className: "badge badge-facilitator", title: tx.to, textContent: "Facilitator" });
    } else {
      toEl = createElement("code", { textContent: formatAddress(tx.to) });
    }
    tr.appendChild(createElement("td", {}, toEl));
    var schemeClass = tx.scheme === "exact" ? "scheme-exact" : "scheme-legacy";
    var isEvm = tx.network && tx.network.startsWith("eip155:");
    var schemeTitle = tx.scheme === "exact" ? (isEvm ? "EIP-3009 gasless transfer" : "Direct transfer") : "approve + transferFrom";
    tr.appendChild(createElement("td", {}, createElement("span", { className: "badge " + schemeClass, title: schemeTitle, textContent: tx.scheme })));
    tr.appendChild(createElement("td", { className: "time", title: tx.settledAt || "", textContent: formatTime(tx.settledAt) }));
    return tr;
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  async function loadTransactions(opts) {
    const params = new URLSearchParams();
    if (opts.network) params.set("network", opts.network);
    if (opts.token) params.set("token", opts.token);
    if (opts.status) params.set("status", opts.status);
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.cursor) params.set("cursor", opts.cursor);
    if (opts.dateFrom) params.set("dateFrom", opts.dateFrom);
    if (opts.dateTo) params.set("dateTo", opts.dateTo);
    if (opts.sortBy) params.set("sortBy", opts.sortBy);
    if (opts.sortDir) params.set("sortDir", opts.sortDir);

    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "block";

    try {
      const data = await fetchJSON(API_BASE + "/transactions?" + params.toString());
      const tbody = document.getElementById("txBody");
      if (tbody) {
        clearChildren(tbody);
        for (const tx of data.transactions) {
          tbody.appendChild(buildTxRow(tx));
        }
      }
      const nextBtn = document.getElementById("nextBtn");
      const prevBtn = document.getElementById("prevBtn");
      const pageInfo = document.getElementById("pageInfo");
      if (nextBtn) nextBtn.disabled = !data.hasMore;
      if (prevBtn) prevBtn.disabled = currentPage <= 1;
      if (pageInfo) {
        var total = data.total || pageInfo.getAttribute("data-total") || 0;
        var totalFormatted = Number(total).toLocaleString("en-US");
        pageInfo.textContent = "Page " + currentPage + " \u00b7 " + totalFormatted + " settlements";
      }
      currentCursor = data.nextCursor;
    } finally {
      if (loading) loading.style.display = "none";
    }
  }

  function updateUrlParams(filters) {
    var params = new URLSearchParams();
    if (filters.network) params.set("network", filters.network);
    if (filters.token) params.set("token", filters.token);
    if (filters.search) params.set("q", filters.search);
    var qs = params.toString();
    var newUrl = window.location.pathname + (qs ? "?" + qs : "");
    window.history.replaceState(null, "", newUrl);
  }

  function readUrlParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      network: params.get("network") || "",
      token: params.get("token") || "",
      search: params.get("q") || "",
    };
  }

  function initThemeToggle() {
    var toggle = document.getElementById("themeToggle");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      var root = document.documentElement;
      var isLight = root.classList.toggle("light");
      localStorage.setItem("t402-theme", isLight ? "light" : "dark");
    });
  }

  function init() {
    initThemeToggle();

    const networkFilter = document.getElementById("networkFilter");
    const tokenFilter = document.getElementById("tokenFilter");
    const statusFilter = document.getElementById("statusFilter");
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const resetBtn = document.getElementById("resetBtn");
    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");
    const dateFrom = document.getElementById("dateFrom");
    const dateTo = document.getElementById("dateTo");
    const sortByEl = document.getElementById("sortBy");

    // Restore filters from URL on page load
    var urlFilters = readUrlParams();
    if (networkFilter && urlFilters.network) networkFilter.value = urlFilters.network;
    if (tokenFilter && urlFilters.token) tokenFilter.value = urlFilters.token;
    if (searchInput && urlFilters.search) searchInput.value = urlFilters.search;

    function getFilters() {
      var filters = {
        network: networkFilter ? networkFilter.value : "",
        token: tokenFilter ? tokenFilter.value : "",
        status: statusFilter ? statusFilter.value : "",
        limit: 20,
      };
      if (dateFrom && dateFrom.value) {
        filters.dateFrom = new Date(dateFrom.value).toISOString();
      }
      if (dateTo && dateTo.value) {
        var d = new Date(dateTo.value);
        d.setHours(23, 59, 59, 999);
        filters.dateTo = d.toISOString();
      }
      if (sortByEl && sortByEl.value) {
        var parts = sortByEl.value.split("|");
        filters.sortBy = parts[0];
        filters.sortDir = parts[1] || "DESC";
      }
      return filters;
    }

    function reload() {
      currentPage = 1;
      currentCursor = null;
      cursorStack.length = 0;
      var filters = getFilters();
      updateUrlParams({ network: filters.network, token: filters.token, search: searchInput ? searchInput.value.trim() : "" });
      loadTransactions(filters);
    }

    // Apply URL filters on load if any are set
    if (urlFilters.network || urlFilters.token) {
      reload();
    }
    if (urlFilters.search && searchBtn) {
      searchBtn.click();
    }

    if (networkFilter) networkFilter.addEventListener("change", reload);
    if (tokenFilter) tokenFilter.addEventListener("change", reload);
    if (statusFilter) statusFilter.addEventListener("change", reload);
    if (dateFrom) dateFrom.addEventListener("change", reload);
    if (dateTo) dateTo.addEventListener("change", reload);
    if (sortByEl) sortByEl.addEventListener("change", reload);

    if (searchBtn) {
      searchBtn.addEventListener("click", async function () {
        const q = searchInput ? searchInput.value.trim() : "";
        updateUrlParams({ network: networkFilter ? networkFilter.value : "", token: tokenFilter ? tokenFilter.value : "", search: q });
        if (!q) return reload();
        const data = await fetchJSON(API_BASE + "/search?q=" + encodeURIComponent(q));
        const tbody = document.getElementById("txBody");
        if (tbody) {
          clearChildren(tbody);
          for (const tx of data.results) {
            tbody.appendChild(buildTxRow(tx));
          }
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (networkFilter) networkFilter.value = "";
        if (tokenFilter) tokenFilter.value = "";
        if (statusFilter) statusFilter.value = "";
        if (searchInput) searchInput.value = "";
        if (dateFrom) dateFrom.value = "";
        if (dateTo) dateTo.value = "";
        if (sortByEl) sortByEl.value = "";
        updateUrlParams({});
        reload();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        if (!currentCursor) return;
        cursorStack.push(currentCursor);
        currentPage++;
        const filters = getFilters();
        filters.cursor = currentCursor;
        loadTransactions(filters);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        if (currentPage <= 1) return;
        currentPage--;
        cursorStack.pop();
        const filters = getFilters();
        if (cursorStack.length > 0) filters.cursor = cursorStack[cursorStack.length - 1];
        loadTransactions(filters);
      });
    }

    // Copy buttons on detail page
    document.addEventListener("click", function (e) {
      if (e.target.classList.contains("copy-btn")) {
        const text = e.target.getAttribute("data-copy");
        if (text && navigator.clipboard) {
          navigator.clipboard.writeText(text);
          var orig = e.target.textContent;
          e.target.textContent = "Copied!";
          setTimeout(function () { e.target.textContent = orig; }, 1500);
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
