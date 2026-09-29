(() => {
  const ALL = window.YC_UNIVERSE;
  const state = { tab: "agro", q: "", quotes: {} };
  const $ = (id) => document.getElementById(id);
  const money = (row, quote) => {
    if (!quote || quote.price == null || Number.isNaN(quote.price)) return "—";
    if (row.show === "USDBRL") return quote.price.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 5 });
    return quote.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const filtered = () => ALL.filter((row) => {
    if (row.tab !== state.tab) return false;
    const q = state.q.trim().toLowerCase();
    if (!q) return true;
    return `${row.show} ${row.n} ${row.group}`.toLowerCase().includes(q);
  }).sort((a, b) => b.q - a.q);
  const render = () => {
    const rows = filtered();
    $("list").innerHTML = rows.map((row) => {
      const quote = state.quotes[row.s] || {};
      const chg = quote.changePct;
      const cls = chg == null ? "flat" : chg >= 0 ? "up" : "down";
      const label = chg == null ? "—" : `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
      return `<article class="row"><div><span class="sym">${row.show}</span><span class="nm">${row.n}</span></div><div class="px">${money(row, quote)}</div><div class="chg ${cls}">${label}</div></article>`;
    }).join("") || `<p class="pulse">Nenhum ativo neste recorte.</p>`;
  };
  const setTab = (tab) => {
    state.tab = tab;
    document.querySelectorAll("[data-tab]").forEach((btn) => btn.classList.toggle("on", btn.dataset.tab === tab));
    render();
  };
  async function loadQuotes() {
    $("pulse").textContent = "Atualizando";
    let quotes = {};
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ALL.map((x) => x.s).join(","))}`);
      const json = await res.json();
      for (const row of json.quoteResponse?.result || []) {
        quotes[row.symbol] = { price: Number(row.regularMarketPrice), changePct: Number(row.regularMarketChangePercent) };
      }
    } catch {}
    state.quotes = quotes;
    $("pulse").textContent = Object.keys(quotes).length ? `${Object.keys(quotes).length} cotações` : "Offline · lista agro pronta";
    render();
  }
  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) setTab(tab.dataset.tab);
  });
  $("q").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  $("refresh").addEventListener("click", loadQuotes);
  render(); loadQuotes();
  setTimeout(() => document.body.classList.remove("splash-on"), 1200);
})();
