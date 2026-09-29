(() => {
  const ALL = window.YC_UNIVERSE;
  const API = window.YC_API;
  const CACHE_KEY = "ycf:quotes:v2";
  const state = { tab: "agro", q: "", quotes: {}, source: "" };
  const $ = (id) => document.getElementById(id);

  const parsePct = (value) => {
    if (typeof value === "number") return value;
    const n = Number(String(value || "").replace("%", "").replace(/\./g, "").replace(",", ".").replace(/[^\d.+-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const money = (row, quote) => {
    if (!quote || !Number.isFinite(quote.price)) return "—";
    if (row.fmt === "fx") return quote.price.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 5 });
    if (row.fmt === "brl") return quote.price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return quote.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filtered = () => {
    const q = state.q.trim().toLowerCase();
    return ALL.filter((row) => row.tab === state.tab && (!q || `${row.show} ${row.n} ${row.group}`.toLowerCase().includes(q)))
      .sort((a, b) => b.q - a.q);
  };

  const render = () => {
    $("list").innerHTML = filtered().map((row) => {
      const quote = state.quotes[row.s] || {};
      const chg = quote.changePct;
      const cls = !Number.isFinite(chg) ? "flat" : chg >= 0 ? "up" : "down";
      const label = !Number.isFinite(chg) ? "—" : `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
      return `<article class="row"><div><span class="sym">${row.show}</span><span class="nm">${row.n}</span></div><div class="px">${money(row, quote)}</div><div class="chg ${cls}">${label}</div></article>`;
    }).join("");
  };

  const setTab = (tab) => {
    state.tab = tab;
    document.querySelectorAll("[data-tab]").forEach((btn) => btn.classList.toggle("on", btn.dataset.tab === tab));
    render();
  };

  const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } };
  const writeCache = (quotes, source) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ quotes, source, at: Date.now() })); } catch {} };

  async function getJson(url, timeout = 12000) {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  function applyPirassununga(payload) {
    const market = payload.market || payload;
    const next = { ...state.quotes };
    for (const stock of [...(market.stocks || []), ...(market.swingDesk || [])]) {
      if (!stock.symbol || !Number.isFinite(Number(stock.price))) continue;
      next[stock.symbol] = { price: Number(stock.price), changePct: Number(stock.changeRaw ?? parsePct(stock.change)) };
    }
    for (const row of market.fx || []) {
      const price = Number(String(row.value || "").replace(/[^\d,.-]/g, "").replace(".", "").replace(",", "."));
      const changePct = parsePct(row.change);
      if (row.name === "Dólar mercado" || row.name === "Dólar PTAX") next["BRL=X"] = { price, changePct };
      if (row.name === "Euro") next["EURBRL=X"] = { price, changePct };
    }
    for (const row of market.chicago || []) {
      const price = Number(String(row.value || "").replace(/[^\d,.-]/g, "").replace(",", "."));
      const changePct = parsePct(row.change);
      if (row.name.includes("Soja")) next["ZS=F"] = { price, changePct };
      if (row.name.includes("Milho")) next["ZC=F"] = { price, changePct };
      if (row.name.includes("Algod")) next["CT=F"] = { price, changePct };
    }
    for (const row of market.agroLocal || []) {
      const map = { Soja: "IMEA-SOJA", Milho: "IMEA-MILHO", "Algodão pluma": "IMEA-ALGODAO", "Boi gordo": "IMEA-BOI" };
      const key = map[row.name];
      const price = Number(String(row.value || "").replace(/[^\d,.-]/g, "").replace(".", "").replace(",", "."));
      if (key && Number.isFinite(price)) next[key] = { price, changePct: parsePct(row.change) };
    }
    return next;
  }

  async function yahooOne(symbol) {
    const urls = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`)}
    ];
    for (const url of urls) {
      try {
        const data = await getJson(url, 9000);
        const meta = data?.chart?.result?.[0]?.meta;
        const price = Number(meta?.regularMarketPrice);
        if (!Number.isFinite(price)) continue;
        const prev = Number(meta.chartPreviousClose || meta.previousClose);
        const changePct = Number.isFinite(prev) && prev ? ((price - prev) / prev) * 100 : null;
        return { price, changePct };
      } catch {}
    }
    return null;
  }

  async function fillMissing(quotes) {
    const queue = ALL.filter((row) => !row.s.startsWith("IMEA-") && !quotes[row.s]);
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const row = queue.shift();
        const quote = await yahooOne(row.s);
        if (quote) quotes[row.s] = quote;
      }
    });
    await Promise.all(workers);
    return quotes;
  }

  async function loadQuotes() {
    $("pulse").textContent = "Atualizando mercado";
    const cached = readCache();
    if (cached?.quotes) {
      state.quotes = cached.quotes;
      state.source = "cache";
      render();
    }
    try {
      const mercado = await getJson(`${API}/api/mercado-live`, 14000);
      state.quotes = applyPirassununga(mercado);
      state.source = "Pirassununga";
    } catch {
      state.source = state.source || "Yahoo";
    }
    state.quotes = await fillMissing({ ...state.quotes });
    writeCache(state.quotes, state.source);
    const live = Object.keys(state.quotes).length;
    $("pulse").textContent = live ? `${live} cotações · ${state.source}` : "Offline · lista pronta";
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
  setTimeout(() => document.body.classList.remove("splash-on"), 900);
})();
