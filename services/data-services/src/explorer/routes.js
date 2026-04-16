/**
 * Explorer routes — extracted from explorer/server.js into an Express Router.
 *
 * Factory: createExplorerRouter({ db, indexer, templates, middleware, log, resolvedMode })
 */

import { Router } from "express";

function csvEscape(value) {
  if (value == null) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function createExplorerRouter({ db, templates, requireExplorerAuth, getResolvedMode }) {
  const router = Router();

  router.get("/api/v1/transactions", async (req, res) => {
    res.set("Cache-Control", "public, max-age=30");
    const { network, token, scheme, limit = "20", cursor, dateFrom, dateTo, amountMin, amountMax, status, sortBy, sortDir } = req.query;
    const result = await db.getTransactions({
      network, token, scheme, status,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      amountMin: amountMin || undefined,
      amountMax: amountMax || undefined,
      sortBy: sortBy || undefined,
      sortDir: sortDir || undefined,
      limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
      cursor: cursor || undefined,
    });
    res.json({ mode: getResolvedMode(), ...result });
  });

  router.get("/api/v1/transactions/:hash", async (req, res) => {
    res.set("Cache-Control", "public, max-age=30");
    const tx = await db.getTransaction(req.params.hash);
    if (!tx) return res.status(404).json({ mode: getResolvedMode(), error: "Transaction not found" });
    res.json({ mode: getResolvedMode(), ...tx });
  });

  router.get("/api/v1/search", async (req, res) => {
    res.set("Cache-Control", "public, max-age=30");
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ mode: getResolvedMode(), results: [], query: q, total: 0 });
    const results = await db.search(q);
    res.json({ mode: getResolvedMode(), results, query: q, total: results.length });
  });

  router.get("/api/v1/stats", async (req, res) => {
    res.set("Cache-Control", "public, max-age=30");
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    res.json({ mode: getResolvedMode(), ...(await db.getStats(days)) });
  });

  router.get("/api/v1/networks", async (_req, res) => {
    res.set("Cache-Control", "public, max-age=30");
    const networks = await db.getNetworks();
    res.json({ mode: getResolvedMode(), networks, total: networks.length });
  });

  router.get("/api/v1/tokens", async (_req, res) => {
    res.set("Cache-Control", "public, max-age=30");
    const tokens = await db.getTokens();
    res.json({ mode: getResolvedMode(), tokens, total: tokens.length });
  });

  router.get("/api/v1/export", requireExplorerAuth, async (req, res) => {
    const { format, network, token } = req.query;
    if (format !== "csv") {
      return res.status(400).json({ error: "Unsupported format. Use ?format=csv" });
    }
    res.set("Content-Type", "text/csv");
    res.set("Content-Disposition", 'attachment; filename="t402-transactions.csv"');
    res.set("Cache-Control", "no-cache");

    res.write("tx_hash,network,scheme,token,amount,from,to,status,settled_at\n");

    const rows = await db.getAllTransactionsForExport({ network, token });
    for (const row of rows) {
      const line = [
        csvEscape(row.tx_hash),
        csvEscape(row.network),
        csvEscape(row.scheme),
        csvEscape(row.asset),
        csvEscape(row.amount),
        csvEscape(row.from_address),
        csvEscape(row.to_address),
        csvEscape(row.status),
        csvEscape(row.confirmed_at || row.created_at || ""),
      ].join(",");
      res.write(line + "\n");
    }
    res.end();
  });

  router.get("/api/v1/address/:address", async (req, res) => {
    res.set("Cache-Control", "public, max-age=30");
    const { limit = "20", cursor } = req.query;
    const result = await db.getTransactionsByAddress(
      req.params.address,
      Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
      cursor || undefined,
    );
    res.json({ mode: getResolvedMode(), address: req.params.address, ...result });
  });

  // ── HTML routes ─────────────────────────────────────────────────────

  router.get("/address/:address", async (req, res) => {
    const result = await db.getTransactionsByAddress(req.params.address, 20);
    res.type("html").send(templates.renderAddressPage(req.params.address, result.transactions, { total: result.total, totalVolume: result.totalVolume }));
  });

  router.get("/network/:networkId", async (req, res) => {
    const networkId = req.params.networkId;
    const stats = await db.getNetworkStats(networkId);
    if (!stats) return res.status(404).type("html").send(templates.renderNetworkPage(networkId, null, []));
    const txResult = await db.getTransactions({ network: networkId, limit: 20 });
    res.type("html").send(templates.renderNetworkPage(networkId, stats, txResult.transactions));
  });

  router.get("/token/:tokenSymbol", async (req, res) => {
    const tokenSymbol = req.params.tokenSymbol;
    const stats = await db.getTokenStats(tokenSymbol);
    if (!stats) return res.status(404).type("html").send(templates.renderTokenPage(tokenSymbol, null, []));
    const txResult = await db.getTransactions({ token: tokenSymbol, limit: 20 });
    res.type("html").send(templates.renderTokenPage(tokenSymbol, stats, txResult.transactions));
  });

  router.get("/", async (_req, res) => {
    res.set("Cache-Control", "public, max-age=10");
    const [stats, txResult, networks, tokens] = await Promise.all([
      db.getStats(7), db.getTransactions({ limit: 20 }), db.getNetworks(), db.getTokens(),
    ]);
    res.type("html").send(templates.renderIndex({
      stats, transactions: txResult.transactions, networks, tokens, totalAll: txResult.total,
    }));
  });

  router.get("/tx/:hash", async (req, res) => {
    const tx = await db.getTransaction(req.params.hash);
    const status = tx ? 200 : 404;
    res.status(status).type("html").send(templates.renderDetail(tx));
  });

  return router;
}
