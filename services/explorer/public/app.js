/**
 * T402 Explorer client-side behavior.
 * Uses DOM APIs (no innerHTML) for XSS safety.
 */

(function () {
  "use strict";

  var PAGE_SIZE = 20;
  var currentCursor = null;
  var cursorStack = [null];
  var page = 0;

  // --- DOM helpers (no innerHTML) ---

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "textContent") node.textContent = attrs[k];
        else if (k === "className") node.className = attrs[k];
        else if (k === "dataset") Object.assign(node.dataset, attrs[k]);
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      children.forEach(function (c) {
        if (typeof c === "string") node.appendChild(document.createTextNode(c));
        else if (c) node.appendChild(c);
      });
    }
    return node;
  }

  function truncateHash(h) {
    if (!h || h.length <= 20) return h || "";
    return h.slice(0, 10) + "\u2026" + h.slice(-6);
  }

  function truncateAddr(a) {
    if (!a || a.length <= 16) return a || "";
    return a.slice(0, 8) + "\u2026" + a.slice(-6);
  }

  function formatTime(iso) {
    if (!iso) return "";
    var ms = Date.now() - new Date(iso).getTime();
    var s = Math.floor(ms / 1000);
    if (s < 60) return s + "s ago";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  }

  function formatAmount(raw, token, network) {
    if (!raw) return "0.00";
    var decimals = 6;
    if (network && network.indexOf("stellar:") === 0 && token === "USDC") decimals = 7;
    var n = Number(raw) / Math.pow(10, decimals);
    return n.toFixed(2);
  }

  // --- Row rendering with DOM ---

  function renderRow(tx) {
    var tr = el("tr", { dataset: { hash: tx.txHash } });

    tr.appendChild(el("td", {}, [el("code", { textContent: truncateHash(tx.txHash) })]));
    tr.appendChild(el("td", {}, [el("span", { className: "badge", textContent: tx.network })]));
    tr.appendChild(el("td", {}, [el("span", { className: "badge badge-token", textContent: tx.token })]));
    tr.appendChild(el("td", { className: "amount", textContent: "$" + formatAmount(tx.amount, tx.token, tx.network) }));
    tr.appendChild(el("td", {}, [el("code", { textContent: truncateAddr(tx.from) })]));
    tr.appendChild(el("td", {}, [el("code", { textContent: truncateAddr(tx.to) })]));
    tr.appendChild(el("td", { textContent: tx.scheme }));
    tr.appendChild(el("td", { className: "time", title: tx.settledAt, textContent: formatTime(tx.settledAt) }));

    tr.addEventListener("click", function () {
      window.location.href = "/tx/" + encodeURIComponent(tx.txHash);
    });

    return tr;
  }

  function renderRows(txs) {
    var tbody = document.getElementById("txBody");
    if (!tbody) return;
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    txs.forEach(function (tx) {
      tbody.appendChild(renderRow(tx));
    });
  }

  // --- API ---

  function buildUrl(cursor) {
    var net = document.getElementById("networkFilter");
    var tok = document.getElementById("tokenFilter");
    var url = "/api/v1/transactions?limit=" + PAGE_SIZE;
    if (net && net.value) url += "&network=" + encodeURIComponent(net.value);
    if (tok && tok.value) url += "&token=" + encodeURIComponent(tok.value);
    if (cursor) url += "&cursor=" + encodeURIComponent(cursor);
    return url;
  }

  function setLoading(show) {
    var loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.style.display = show ? "block" : "none";
  }

  function loadPage(cursor) {
    setLoading(true);
    fetch(buildUrl(cursor))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        renderRows(data.transactions);
        currentCursor = data.nextCursor;
        var nextBtn = document.getElementById("nextBtn");
        var prevBtn = document.getElementById("prevBtn");
        var info = document.getElementById("pageInfo");
        if (nextBtn) nextBtn.disabled = !data.hasMore;
        if (prevBtn) prevBtn.disabled = page === 0;
        if (info) info.textContent = "Page " + (page + 1) + " (" + data.total + " total)";
        setLoading(false);
      })
      .catch(function () { setLoading(false); });
  }

  function nextPage() {
    page++;
    cursorStack.push(currentCursor);
    loadPage(currentCursor);
  }

  function prevPage() {
    if (page > 0) {
      page--;
      cursorStack.pop();
      loadPage(cursorStack[cursorStack.length - 1]);
    }
  }

  function applyFilters() {
    page = 0;
    cursorStack = [null];
    loadPage(null);
  }

  function resetFilters() {
    var net = document.getElementById("networkFilter");
    var tok = document.getElementById("tokenFilter");
    var searchEl = document.getElementById("searchInput");
    if (net) net.value = "";
    if (tok) tok.value = "";
    if (searchEl) searchEl.value = "";
    applyFilters();
  }

  function doSearch() {
    var input = document.getElementById("searchInput");
    var q = input ? input.value.trim() : "";
    if (!q) { applyFilters(); return; }
    setLoading(true);
    fetch("/api/v1/search?q=" + encodeURIComponent(q))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        renderRows(data.results);
        var nextBtn = document.getElementById("nextBtn");
        var prevBtn = document.getElementById("prevBtn");
        var info = document.getElementById("pageInfo");
        if (nextBtn) nextBtn.disabled = true;
        if (prevBtn) prevBtn.disabled = true;
        if (info) info.textContent = data.total + " results";
        setLoading(false);
      })
      .catch(function () { setLoading(false); });
  }

  // --- Copy to clipboard ---

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy-btn");
    if (!btn) return;
    var text = btn.getAttribute("data-copy");
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = orig; }, 1500);
    });
  });

  // --- Event listeners (no inline handlers) ---

  document.addEventListener("DOMContentLoaded", function () {
    var networkFilter = document.getElementById("networkFilter");
    var tokenFilter = document.getElementById("tokenFilter");
    var searchBtn = document.getElementById("searchBtn");
    var resetBtn = document.getElementById("resetBtn");
    var searchInput = document.getElementById("searchInput");
    var nextBtn = document.getElementById("nextBtn");
    var prevBtn = document.getElementById("prevBtn");

    if (networkFilter) networkFilter.addEventListener("change", applyFilters);
    if (tokenFilter) tokenFilter.addEventListener("change", applyFilters);
    if (searchBtn) searchBtn.addEventListener("click", doSearch);
    if (resetBtn) resetBtn.addEventListener("click", resetFilters);
    if (searchInput) searchInput.addEventListener("keyup", function (e) {
      if (e.key === "Enter") doSearch();
    });
    if (nextBtn) nextBtn.addEventListener("click", nextPage);
    if (prevBtn) prevBtn.addEventListener("click", prevPage);
  });
})();
