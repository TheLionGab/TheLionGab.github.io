(() => {
  const C = window.YC_CORE;
  const ALL = window.YC_UNIVERSE;
  const EDGE = window.YC_EDGE;
  const AWESOME = "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL,BTC-USD";
  const CACHE_KEY = "ycf:quotes:v8";
  const state = { tab: "agro", q: "", by: { edge: {}, awesome: {} }, at: 0, ok: { edge: false, awesome: false }, loading: false };
  const $ = (id) => document.getElementById(id);

  const filtered = () => {
    const q = state.q.trim().toLowerCase();
    return ALL.filter((row) => row.tab === state.tab && (!q || (row.show + " " + row.n).toLowerCase().includes(q))).sort((a, b) => b.q - a.q);
  };

  const render = () => {
    $("list").innerHTML = filtered().map((row) => {
      const quote = C.pick(row, state.by);
      const chg = quote ? quote.changePct : null;
      const price = quote ? C.fmtPrice(quote.price, row.dec) : "—";
      const when = quote ? C.stamp(quote.ts) : "";
      return "<article class=\"row\"><div><span class=\"sym\">" + row.show + "</span><span class=\"nm\">" + row.n + " · " + row.u + "</span></div>" +
        "<div class=\"px\">" + price + (when ? "<small>" + when + "</small>" : "") + "</div>" +
        "<div class=\"chg " + C.pctClass(chg) + "\">" + C.fmtPct(chg) + "</div></article>";
    }).join("");
  };

  const pulse = (text) => { $("pulse").textContent = text; };

  const summary = () => {
    const live = ALL.filter((row) => C.pick(row, state.by)).length;
    const at = state.at ? C.stamp(state.at) : "";
    const srcs = [];
    if (state.ok.edge) srcs.push("Yahoo Finance");
    if (state.ok.awesome) srcs.push("AwesomeAPI");
    if (!state.ok.edge && !state.ok.awesome) return live ? "Sem conexão · dados de " + at : "Sem conexão com as cotações";
    return live + " de " + ALL.length + " cotações · " + srcs.join(" + ") + " · " + at + (state.ok.edge ? "" : " · Yahoo indisponível");
  };

  const setTab = (tab) => {
    state.tab = tab;
    document.querySelectorAll("[data-tab]").forEach((btn) => btn.classList.toggle("on", btn.dataset.tab === tab));
    render();
  };

  async function getJson(url, timeout) {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function loadQuotes() {
    if (state.loading) return;
    state.loading = true;
    pulse("Atualizando mercado");
    const [edge, awesome] = await Promise.allSettled([
      getJson(EDGE + "/api/quotes?group=all", 15000),
      getJson(AWESOME, 8000)
    ]);
    // Fonte que respondeu substitui o mapa inteiro: símbolo que ela não trouxe
    // fica "—" em vez de guardar preço antigo. Fonte fora do ar mantém o último mapa.
    if (edge.status === "fulfilled") state.by.edge = C.fromEdge(edge.value);
    if (awesome.status === "fulfilled") state.by.awesome = C.fromAwesome(awesome.value);
    state.ok = { edge: edge.status === "fulfilled", awesome: awesome.status === "fulfilled" };
    if (state.ok.edge || state.ok.awesome) {
      state.at = Date.now();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ by: state.by, at: state.at })); } catch (e) {}
    }
    state.loading = false;
    render();
    pulse(summary());
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) setTab(tab.dataset.tab);
  });
  $("q").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  $("refresh").addEventListener("click", loadQuotes);
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached && cached.by) { state.by = cached.by; state.at = cached.at || 0; }
  } catch (e) {}
  render();
  loadQuotes();
  setInterval(() => { if (!document.hidden) loadQuotes(); }, 60000);
  setTimeout(() => document.body.classList.remove("splash-on"), 900);
})();
