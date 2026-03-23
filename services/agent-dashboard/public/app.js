/**
 * T402 Agent Dashboard — Client-side application.
 *
 * Reads the agent address from [data-address] attribute on <main>.
 * Handles auto-refresh, pagination, network filter, sorting, sparkline, and theme toggle.
 */
(function () {
  "use strict";

  // ── Theme toggle (runs on all pages) ─────────────────────────────
  var theme = localStorage.getItem("t402-theme") || "dark";
  if (theme === "light") document.documentElement.classList.add("light");
  var themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.textContent = theme === "light" ? "\u263E Dark" : "\u2600 Light";
    themeBtn.addEventListener("click", function () {
      var isLight = document.documentElement.classList.toggle("light");
      localStorage.setItem("t402-theme", isLight ? "light" : "dark");
      themeBtn.textContent = isLight ? "\u263E Dark" : "\u2600 Light";
    });
  }

  // ── Agent-specific dashboard (requires data-address) ────────────
  var main = document.querySelector("[data-address]");
  if (!main) return; // overview page — theme toggle is enough
  var addr = main.getAttribute("data-address");
  if (!addr) return;

  var currentDays = 7;
  var currentOffset = 0;
  var currentNetwork = "";
  var currentTotal = 0;
  var PAGE_SIZE = 15;
  var sortCol = -1;
  var sortAsc = true;

  // ── Explorer URLs ───────────────────────────────────────────────
  var explorers = window.__EXPLORERS__ || {};

  function explorerLink(network, txHash) {
    var base = explorers[network];
    if (base && txHash)
      return (
        '<a href="' + esc(base + txHash) + '" target="_blank" rel="noopener">' + esc(txHash.slice(0, 10)) + "\u2026</a>"
      );
    return esc(txHash || "");
  }

  // ── SVG sparkline ───────────────────────────────────────────────
  function renderSparkline(trend) {
    var container = document.getElementById("sparkline-chart");
    if (!container || !trend || trend.length === 0) return;
    var w = 600, h = 80, pad = 20;
    var amounts = trend.map(function (d) { return parseFloat(d.amountUsd) || 0; });
    var maxVal = Math.max.apply(null, amounts) || 1;
    var step = (w - pad * 2) / Math.max(amounts.length - 1, 1);
    var points = amounts.map(function (v, i) {
      return (pad + i * step).toFixed(1) + "," + (h - pad - (v / maxVal) * (h - pad * 2)).toFixed(1);
    }).join(" ");
    var areaPoints = points + " " + (pad + (amounts.length - 1) * step).toFixed(1) + "," + (h - pad) + " " + pad + "," + (h - pad);
    var labels = "";
    if (trend.length > 2) {
      labels = '<text x="' + pad + '" y="' + h + '">' + esc(trend[0].date.slice(5)) + "</text>";
      var mid = Math.floor(trend.length / 2);
      labels += '<text x="' + (pad + mid * step) + '" y="' + h + '" text-anchor="middle">' + esc(trend[mid].date.slice(5)) + "</text>";
      labels += '<text x="' + (w - pad) + '" y="' + h + '" text-anchor="end">' + esc(trend[trend.length - 1].date.slice(5)) + "</text>";
    }
    labels += '<text x="' + (w - pad) + '" y="12" text-anchor="end">$' + maxVal.toFixed(2) + "</text>";
    container.innerHTML =
      '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent, #50AF95)" stop-opacity="0.3"/><stop offset="100%" stop-color="var(--accent, #50AF95)" stop-opacity="0"/></linearGradient></defs>' +
      '<polygon class="area" points="' + areaPoints + '"/>' +
      '<polyline points="' + points + '"/>' +
      labels + "</svg>";
  }

  function refreshTrend() {
    fetch("/api/v1/stats/" + encodeURIComponent(addr) + "/trend?days=" + Math.max(currentDays, 7))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { renderSparkline(data.trend); })
      .catch(function () {});
  }

  // ── Error banner ────────────────────────────────────────────────
  function showError(msg) {
    var banner = document.getElementById("error-banner");
    if (!banner) return;
    banner.textContent = msg || "Data refresh failed \u2014 showing last known data";
    banner.classList.add("visible");
    setTimeout(function () { banner.classList.remove("visible"); }, 10000);
  }

  // ── SSE real-time updates (fallback to polling) ────────────────
  var sseActive = false;
  function connectSSE() {
    if (!window.EventSource) return; // Fallback to polling
    var es = new EventSource("/api/v1/events/" + encodeURIComponent(addr) + "?days=" + currentDays);
    es.addEventListener("snapshot", function (e) {
      try {
        var d = JSON.parse(e.data);
        sseActive = true;
        applySnapshot(d);
      } catch (err) { /* ignore parse errors */ }
    });
    es.addEventListener("error", function () {
      sseActive = false;
      // EventSource auto-reconnects
    });
    // Close SSE on page unload
    window.addEventListener("beforeunload", function () { es.close(); });
  }

  function applySnapshot(d) {
    var balData = d.balances, stats = d.stats;
    var eb = document.getElementById("error-banner");
    if (eb) eb.classList.remove("visible");
    document.querySelectorAll("[data-card]").forEach(function (el) {
      var key = el.getAttribute("data-card");
      if (key === "balance") el.textContent = "$" + (balData.totalUsd || "--");
      if (key === "payments") el.textContent = stats.totalPayments != null ? stats.totalPayments : "--";
      if (key === "spent") el.textContent = "$" + (stats.totalSpentUsd || "--");
      if (key === "avg") el.textContent = "$" + (stats.avgPaymentUsd || "--");
    });
    if (d.payments && d.payments.items) {
      currentTotal = d.payments.total || 0;
      updatePagination();
      var tbody = document.getElementById("payments-tbody");
      if (tbody) {
        tbody.innerHTML = d.payments.items.map(function (p) {
          var label = esc(p.networkLabel || p.network);
          var si = p.status === "settled" ? "\u2713 " : p.status === "pending" ? "\u231B " : p.status === "failed" ? "\u2717 " : "";
          var txLink = explorerLink(p.network, p.txHash);
          return "<tr><td>" + esc(p.service) + "</td><td>$" + esc(p.amountFormatted) + " " + esc(p.token) + "</td><td>" + label + '</td><td class="status-' + esc(p.status) + '">' + esc(si + p.status) + "</td><td>" + txLink + "</td><td>" + esc(timeAgoClient(p.timestamp)) + "</td></tr>";
        }).join("");
      }
    }
    refreshTrend();
  }

  connectSSE();
  // Polling fallback — only used when SSE is not active
  setInterval(function () { if (!sseActive) refreshData(); }, 60000);

  function refreshData() {
    var spinner = document.getElementById("refresh-spinner");
    if (spinner) spinner.classList.remove("hidden");
    var netParam = currentNetwork ? "&network=" + encodeURIComponent(currentNetwork) : "";
    function jsonOk(r) { if (!r.ok) throw new Error(r.status); return r.json(); }
    Promise.all([
      fetch("/api/v1/stats/" + encodeURIComponent(addr) + "?days=" + currentDays).then(jsonOk),
      fetch("/api/v1/payments?address=" + encodeURIComponent(addr) + "&days=" + currentDays + "&limit=" + PAGE_SIZE + "&offset=" + currentOffset + netParam).then(jsonOk),
      fetch("/api/v1/balances/" + encodeURIComponent(addr)).then(jsonOk),
      fetch("/api/v1/budget/" + encodeURIComponent(addr)).then(jsonOk),
      fetch("/api/v1/alerts/" + encodeURIComponent(addr)).then(jsonOk),
    ])
      .then(function (results) {
        var stats = results[0], payData = results[1], balData = results[2];
        var eb = document.getElementById("error-banner");
        if (eb) eb.classList.remove("visible");
        // Summary cards
        document.querySelectorAll("[data-card]").forEach(function (el) {
          var key = el.getAttribute("data-card");
          if (key === "balance") el.textContent = "$" + (balData.totalUsd || "--");
          if (key === "payments") el.textContent = stats.totalPayments != null ? stats.totalPayments : "--";
          if (key === "spent") el.textContent = "$" + (stats.totalSpentUsd || "--");
          if (key === "avg") el.textContent = "$" + (stats.avgPaymentUsd || "--");
        });
        // Dynamic period labels
        document.querySelectorAll("[data-period-label]").forEach(function (el) {
          el.textContent = el.getAttribute("data-period-label").replace("7d", currentDays + "d");
        });
        // Pagination
        currentTotal = payData.total || 0;
        updatePagination();
        // Payments table
        var tbody = document.getElementById("payments-tbody");
        if (tbody && payData.payments) {
          tbody.innerHTML = payData.payments
            .map(function (p) {
              var label = esc(p.networkLabel || p.network);
              var si = p.status === "settled" ? "\u2713 " : p.status === "pending" ? "\u231B " : p.status === "failed" ? "\u2717 " : "";
              var txLink = explorerLink(p.network, p.txHash);
              return "<tr><td>" + esc(p.service) + "</td><td>$" + esc(p.amountFormatted) + " " + esc(p.token) + "</td><td>" + label + '</td><td class="status-' + esc(p.status) + '">' + esc(si + p.status) + "</td><td>" + txLink + "</td><td>" + esc(timeAgoClient(p.timestamp)) + "</td></tr>";
            })
            .join("");
        }
        if (spinner) spinner.classList.add("hidden");
        refreshTrend();
      })
      .catch(function () {
        if (spinner) spinner.classList.add("hidden");
        showError();
      });
  }

  // ── Date range ──────────────────────────────────────────────────
  document.querySelectorAll(".range-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".range-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      currentDays = parseInt(btn.getAttribute("data-days"), 10);
      currentOffset = 0;
      refreshData();
    });
  });

  // ── Manual refresh ──────────────────────────────────────────────
  var refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) refreshBtn.addEventListener("click", function (e) { e.preventDefault(); refreshData(); });

  // ── Table sorting ───────────────────────────────────────────────
  document.querySelectorAll(".sort-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var col = parseInt(btn.getAttribute("data-col"), 10);
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = true; }
      document.querySelectorAll(".sort-btn .sort-arrow").forEach(function (a) { a.textContent = ""; });
      var arrow = btn.querySelector(".sort-arrow");
      if (arrow) arrow.textContent = sortAsc ? "\u25B2" : "\u25BC";
      var tbody = document.getElementById("payments-tbody");
      if (!tbody) return;
      var rows = Array.from(tbody.querySelectorAll("tr"));
      rows.sort(function (a, b) {
        var aText = a.children[col] ? a.children[col].textContent.trim() : "";
        var bText = b.children[col] ? b.children[col].textContent.trim() : "";
        var cmp = aText.localeCompare(bText, undefined, { numeric: true });
        return sortAsc ? cmp : -cmp;
      });
      rows.forEach(function (r) { tbody.appendChild(r); });
    });
  });

  // ── Pagination ──────────────────────────────────────────────────
  function updatePagination() {
    var pageInfo = document.getElementById("page-info");
    var prevBtn = document.getElementById("prev-btn");
    var nextBtn = document.getElementById("next-btn");
    if (!pageInfo) return;
    var page = Math.floor(currentOffset / PAGE_SIZE) + 1;
    var totalPages = Math.max(1, Math.ceil(currentTotal / PAGE_SIZE));
    pageInfo.textContent = "Page " + page + " of " + totalPages;
    if (prevBtn) prevBtn.disabled = currentOffset === 0;
    if (nextBtn) nextBtn.disabled = currentOffset + PAGE_SIZE >= currentTotal;
  }

  var prevBtnEl = document.getElementById("prev-btn");
  if (prevBtnEl) prevBtnEl.addEventListener("click", function () { currentOffset = Math.max(0, currentOffset - PAGE_SIZE); refreshData(); });
  var nextBtnEl = document.getElementById("next-btn");
  if (nextBtnEl) nextBtnEl.addEventListener("click", function () { if (currentOffset + PAGE_SIZE < currentTotal) { currentOffset += PAGE_SIZE; refreshData(); } });

  // ── Network filter ──────────────────────────────────────────────
  var netFilter = document.getElementById("network-filter");
  if (netFilter) netFilter.addEventListener("change", function () { currentNetwork = netFilter.value; currentOffset = 0; refreshData(); });

  // ── Utilities ───────────────────────────────────────────────────
  function esc(s) {
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(s || ""));
    return d.innerHTML;
  }
  function timeAgoClient(iso) {
    var sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 0) return "just now";
    if (sec < 60) return sec + "s ago";
    var min = Math.floor(sec / 60);
    if (min < 60) return min + "m ago";
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + "h ago";
    return Math.floor(hr / 24) + "d ago";
  }

  // Initial load
  refreshTrend();
})();
