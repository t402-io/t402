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
    return res.json();
  }

  function buildTxRow(tx) {
    const tr = createElement("tr", { "data-hash": tx.txHash });
    tr.addEventListener("click", function () {
      window.location.href = "/tx/" + encodeURIComponent(tx.txHash);
    });
    tr.appendChild(createElement("td", {}, createElement("code", { textContent: formatHash(tx.txHash) })));
    tr.appendChild(createElement("td", {}, createElement("span", { className: "badge", textContent: tx.network })));
    tr.appendChild(createElement("td", {}, createElement("span", { className: "badge badge-token", textContent: tx.token })));
    tr.appendChild(createElement("td", { className: "amount", textContent: "$" + tx.amount }));
    tr.appendChild(createElement("td", {}, createElement("code", { textContent: formatAddress(tx.from) })));
    tr.appendChild(createElement("td", {}, createElement("code", { textContent: formatAddress(tx.to) })));
    tr.appendChild(createElement("td", { textContent: tx.scheme }));
    tr.appendChild(createElement("td", { className: "time", textContent: tx.settledAt }));
    return tr;
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  async function loadTransactions(opts) {
    const params = new URLSearchParams();
    if (opts.network) params.set("network", opts.network);
    if (opts.token) params.set("token", opts.token);
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.cursor) params.set("cursor", opts.cursor);

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
      if (pageInfo) pageInfo.textContent = "Page " + currentPage;
      currentCursor = data.nextCursor;
    } finally {
      if (loading) loading.style.display = "none";
    }
  }

  function init() {
    const networkFilter = document.getElementById("networkFilter");
    const tokenFilter = document.getElementById("tokenFilter");
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const resetBtn = document.getElementById("resetBtn");
    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");

    function getFilters() {
      return {
        network: networkFilter ? networkFilter.value : "",
        token: tokenFilter ? tokenFilter.value : "",
        limit: 20,
      };
    }

    function reload() {
      currentPage = 1;
      currentCursor = null;
      cursorStack.length = 0;
      loadTransactions(getFilters());
    }

    if (networkFilter) networkFilter.addEventListener("change", reload);
    if (tokenFilter) tokenFilter.addEventListener("change", reload);

    if (searchBtn) {
      searchBtn.addEventListener("click", async function () {
        const q = searchInput ? searchInput.value.trim() : "";
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
        if (searchInput) searchInput.value = "";
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
