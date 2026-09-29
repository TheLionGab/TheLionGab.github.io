(() => {
  const ALL = window.YC_UNIVERSE;
  const API = window.YC_API;
  const CACHE_KEY = "ycf:quotes:v4";
  const state = { tab: "agro", q: "", quotes: {}, source: "" };
  const $ = (id) => document.getElementById(id);
  const parsePct = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const n = Number(String(value || "").replace("%", "").replace(/\./g, "").replace(",", ".").replace(/[^\d.+-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const parseMoney = (value) => {
    if (typeof value === "number") return value;
    const raw = String(value || "").replace(/[^\d,.-]/g, "");
    if (!raw) return NaN;
    if (raw.includes(",") && raw.includes(".")) return Number(raw.replace(/\./g, "").replace(",", "."));
    return Number(raw.replace(",", "."));
  };
  const money = (row, quote) => {
    if (!quote || !Number.isFinite(quote.price)) return "—";
    if (row.fmt === "fx") return quote.price.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    if (row.fmt === "brl") return quote.price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return quote.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const filtered = () => {
    const q = state.q.trim().toLowerCase();
    return ALL.filter((row) => row.tab === state.tab && (!q || (row.show + " " + row.n).toLowerCase().includes(q))).sort((a, b) => b.q - a.q);
  };
  const render = () => {
    $("list").innerHTML = filtered().map((row) => {
      const quote = state.quotes[row.s] || {};
      const chg = quote.changePct;
      const cls = !Number.isFinite(chg) ? "flat" : chg >= 0 ? "up" : "down";
      const label = !Number.isFinite(chg) ? "—" : (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%";
      const hint = quote.ref ? " · ref. à vista" : "";
      return "<article class=\"row\"><div><span class=\"sym\">" + row.show + "</span><span class=\"nm\">" + row.n + hint + "</span></div><div class=\"px\">" + money(row, quote) + "</div><div class=\"chg " + cls + "\">" + label + "</div></article>";
    }).join("");
  };
  const setTab = (tab) => {
    state.tab = tab;
    document.querySelectorAll("[data-tab]").forEach((btn) => btn.classList.toggle("on", btn.dataset.tab === tab));
    render();
  };
  const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } };
  const writeCache = (quotes, source) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ quotes: quotes, source: source, at: Date.now() })); } catch {} };
  async function getJson(url, timeout) {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeout || 12000) });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }
  function put(next, symbol, price, changePct, extra) {
    const px = Number(price);
    if (!symbol || !Number.isFinite(px)) return;
    next[symbol] = Object.assign({ price: px, changePct: parsePct(changePct) }, extra || {});
  }
  function applyMercado(payload, next) {
    const market = payload.market || payload;
    [].concat(market.stocks || [], market.swingDesk || []).forEach((stock) => put(next, stock.symbol, stock.price, stock.changeRaw != null ? stock.changeRaw : stock.change));
    (market.fx || []).forEach((row) => {
      if (row.name.indexOf("Dólar") >= 0) put(next, "BRL=X", parseMoney(row.value), row.change);
      if (row.name === "Euro") put(next, "EURBRL=X", parseMoney(row.value), row.change);
    });
    (market.chicago || []).forEach((row) => {
      if (row.name.indexOf("Soja") >= 0) put(next, "ZS=F", parseMoney(row.value), row.change);
      if (row.name.indexOf("Milho") >= 0) put(next, "ZC=F", parseMoney(row.value), row.change);
      if (row.name.indexOf("Algod") >= 0) put(next, "CT=F", parseMoney(row.value), row.change);
    });
    const local = { Soja: "IMEA-SOJA", Milho: "IMEA-MILHO", "Algodão pluma": "IMEA-ALGODAO", "Boi gordo": "IMEA-BOI" };
    (market.agroLocal || []).forEach((row) => { if (local[row.name]) put(next, local[row.name], parseMoney(row.value), row.change); });
    (market.commodities || []).forEach((row) => {
      if (row.name && row.name.indexOf("Brent") >= 0) put(next, "BZ=F", parseMoney(row.value), row.change);
      if (row.name && row.name.indexOf("Ouro") >= 0) put(next, "GC=F", parseMoney(row.value), row.change);
    });
  }
  function applyCotacoes(payload, next) {
    const map = {
      "Soja IMEA · Campo Verde": "IMEA-SOJA",
      "Milho IMEA · Campo Verde": "IMEA-MILHO",
      "Algodão pluma IMEA · Campo Verde": "IMEA-ALGODAO",
      "Boi gordo IMEA · Campo Verde": "IMEA-BOI",
      "Dólar PTAX": "BRL=X",
      "Dólar mercado": "BRL=X",
      Euro: "EURBRL=X",
      "Soja Chicago": "ZS=F",
      "Milho Chicago": "ZC=F",
      "Algodão Chicago": "CT=F",
      "Petróleo Brent": "BZ=F",
      "Ouro spot": "GC=F"
    };
    (payload.quotes || []).forEach((row) => { if (map[row.name]) put(next, map[row.name], row.value, row.change); });
  }
  function fillFrontMonth(next) {
    ["CTZ26.NYB", "CTZ27.NYB", "CTZ28.NYB"].forEach((s) => { if (!next[s] && next["CT=F"]) next[s] = Object.assign({}, next["CT=F"], { ref: true }); });
    ["ZSH26.CBT", "ZSH27.CBT", "ZSH28.CBT"].forEach((s) => { if (!next[s] && next["ZS=F"]) next[s] = Object.assign({}, next["ZS=F"], { ref: true }); });
  }
  async function yahooOne(symbol) {
    const urls = [
      "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=1d&range=5d",
      "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://query1.finance.yahoo.com/v8/finance/chart/" + symbol + "?interval=1d&range=5d")
    ];
    for (let i = 0; i < urls.length; i++) {
      try {
        const data = await getJson(urls[i], 8000);
        const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
        const price = Number(meta && meta.regularMarketPrice);
        if (!Number.isFinite(price)) continue;
        const prev = Number(meta.chartPreviousClose || meta.previousClose);
        return { price: price, changePct: Number.isFinite(prev) && prev ? ((price - prev) / prev) * 100 : null };
      } catch (e) {}
    }
    return null;
  }
  async function fillMissing(next) {
    const queue = ALL.filter((row) => !String(row.s).startsWith("IMEA-") && !next[row.s]);
    const workers = Array.from({ length: 3 }, async function () {
      while (queue.length) {
        const row = queue.shift();
        const quote = await yahooOne(row.s);
        if (quote) next[row.s] = quote;
      }
    });
    await Promise.all(workers);
    fillFrontMonth(next);
  }
  async function loadQuotes() {
    $("pulse").textContent = "Atualizando mercado";
    const cached = readCache();
    if (cached && cached.quotes) { state.quotes = cached.quotes; state.source = "cache"; render(); }
    const next = Object.assign({}, state.quotes);
    const sources = [];
    try { applyMercado(await getJson(API + "/api/mercado-live", 14000), next); sources.push("Pirassununga"); } catch (e) {}
    try { applyCotacoes(await getJson(API + "/api/cotacoes-live", 12000), next); if (sources.indexOf("Pirassununga") < 0) sources.push("Cotações"); } catch (e) {}
    try {
      const fx = await getJson("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL", 8000);
      if (fx.USDBRL) put(next, "BRL=X", fx.USDBRL.bid, fx.USDBRL.pctChange);
      if (fx.EURBRL) put(next, "EURBRL=X", fx.EURBRL.bid, fx.EURBRL.pctChange);
      sources.push("AwesomeAPI");
    } catch (e) {}
    try {
      const gold = await getJson("https://api.gold-api.com/price/XAU", 8000);
      if (gold && gold.price) put(next, "GC=F", gold.price, null);
      sources.push("Gold-API");
    } catch (e) {}
    await fillMissing(next);
    state.quotes = next;
    state.source = sources[0] || "cache";
    writeCache(state.quotes, state.source);
    const live = Object.keys(state.quotes).length;
    $("pulse").textContent = live ? live + " cotações · " + sources.join(" + ") : "Offline · lista pronta";
    render();
  }
  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) setTab(tab.dataset.tab);
  });
  $("q").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  $("refresh").addEventListener("click", loadQuotes);
  render();
  loadQuotes();
  setTimeout(() => document.body.classList.remove("splash-on"), 1100);
})();
