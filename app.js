(() => {
  const C = window.YC_CORE;
  const ALL = window.YC_UNIVERSE;
  const EDGE = window.YC_EDGE;
  const AWESOME = "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL,BTC-USD";
  const CACHE_KEY = "ycf:quotes:v8";
  const state = { tab: "graos", q: "", by: { edge: {}, awesome: {} }, at: 0, ok: { edge: false, awesome: false }, loading: false };
  const $ = (id) => document.getElementById(id);
  const esc = C.esc;

  // Com busca, vale o universo inteiro (cada ativo uma vez); sem busca, a aba ativa.
  const visible = () => {
    const q = state.q.trim();
    return ALL.filter((row) => (q ? C.matches(row, q) : C.inTab(row, state.tab)));
  };

  const rowHtml = (row) => {
    const quote = C.pick(row, state.by, state.ok);
    const chg = quote ? quote.changePct : null;
    const price = quote ? C.fmtPrice(quote.price, row.dec) : "—";
    const when = quote ? C.stamp(quote.ts) : "";
    // Fonte fora do ar (dado guardado), contrato sem negócio recente ou cripto com cotação velha: esmaecida.
    const old = C.isOld(row, quote, state.ok) ? " old" : "";
    return "<article class=\"row" + old + "\"><div><span class=\"sym\">" + row.show + "</span><span class=\"nm\">" + row.n + " · " + row.u + "</span></div>" +
      "<div class=\"px\">" + price + (when ? "<small>" + when + "</small>" : "") + "</div>" +
      "<div class=\"chg " + C.pctClass(chg) + "\">" + C.fmtPct(chg) + "</div></article>";
  };

  const render = () => {
    const q = state.q.trim();
    document.body.classList.toggle("searching", !!q);
    // Com busca a lista é global: nenhuma aba está "atual", nem para leitor de tela.
    document.querySelectorAll("[data-tab]").forEach((btn) => {
      const on = btn.dataset.tab === state.tab;
      btn.classList.toggle("on", on);
      if (on && !q) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
    const secs = C.sections(visible());
    $("list").innerHTML = secs.length
      ? secs.map((s) => "<section class=\"grp\"><h2>" + esc(s.group) + "</h2>" + s.rows.map(rowHtml).join("") + "</section>").join("")
      : "<p class=\"empty\">Nenhum ativo para “" + esc(q) + "”.</p>";
  };

  const pulse = (text) => { $("pulse").textContent = text; };

  const summary = () => {
    const live = ALL.filter((row) => C.pick(row, state.by, state.ok)).length;
    const at = state.at ? C.stamp(state.at) : "";
    const srcs = [];
    if (state.ok.edge) srcs.push("Yahoo Finance");
    if (state.ok.awesome) srcs.push("AwesomeAPI");
    if (!state.ok.edge && !state.ok.awesome) return live ? "Sem conexão · dados de " + at : "Sem conexão com as cotações";
    return live + " de " + ALL.length + " cotações · " + srcs.join(" + ") + " · " + at + (state.ok.edge ? "" : " · Yahoo indisponível");
  };

  // Trocar de aba limpa a busca e volta ao topo: cada aba tem um tamanho.
  const setTab = (tab) => {
    state.tab = tab;
    state.q = "";
    $("q").value = "";
    render();
    window.scrollTo(0, 0);
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
      getJson(EDGE + "/api/quotes?group=all", 25000),
      getJson(AWESOME, 8000)
    ]);
    // Fonte que respondeu substitui o mapa inteiro: símbolo que ela não trouxe
    // fica "—" em vez de guardar preço antigo. Fonte fora do ar mantém o último mapa.
    // Resposta sem nenhuma cotação válida (API de pé, Yahoo fora) conta como falha.
    const maps = {
      edge: edge.status === "fulfilled" ? C.fromEdge(edge.value) : null,
      awesome: awesome.status === "fulfilled" ? C.fromAwesome(awesome.value) : null
    };
    state.ok = {};
    Object.keys(maps).forEach((src) => {
      state.ok[src] = !!maps[src] && Object.keys(maps[src]).length > 0;
      if (state.ok[src]) state.by[src] = maps[src];
    });
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
