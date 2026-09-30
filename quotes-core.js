(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YC_CORE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MAX_DAILY_PCT = 40;
  const TZ = "America/Sao_Paulo";

  const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  const round2 = (n) => Math.round(n * 100) / 100;

  // Variação diária acima do teto é erro de leitura, não mercado: vira "sem variação".
  function sanePct(v) {
    const n = num(v);
    return Number.isFinite(n) && Math.abs(n) <= MAX_DAILY_PCT ? n : null;
  }

  function fmtPrice(value, dec) {
    if (!Number.isFinite(value)) return "—";
    return value.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  // Arredonda a magnitude e só depois aplica o sinal: +0,005 e -0,005 tratam igual.
  function pctClass(chg) {
    if (!Number.isFinite(chg) || round2(Math.abs(chg)) === 0) return "flat";
    return chg > 0 ? "up" : "down";
  }

  function fmtPct(chg) {
    if (!Number.isFinite(chg)) return "—";
    const m = round2(Math.abs(chg));
    const body = m.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (m === 0 ? "" : chg > 0 ? "+" : "−") + body + "%";
  }

  // Hoje: HH:MM; outro dia: dd/mm. Sempre no fuso de Brasília.
  function stamp(ts, now) {
    if (!Number.isFinite(ts)) return "";
    const day = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
    const d = new Date(ts);
    if (day(d) === day(new Date(now === undefined ? Date.now() : now))) {
      return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
    }
    return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d);
  }

  function fromEdge(payload) {
    const out = {};
    ((payload && payload.quotes) || []).forEach((row) => {
      const price = num(row && row.value);
      if (!row || !row.symbol || !Number.isFinite(price) || price <= 0) return;
      out[row.symbol] = { price: price, changePct: row.stale ? null : sanePct(row.delta), ts: num(row.ts), stale: !!row.stale };
    });
    return out;
  }

  // AwesomeAPI devolve tudo em texto com ponto decimal ("-0.318"), inclusive pctChange.
  function fromAwesome(payload) {
    const map = { USDBRL: "BRL=X", EURBRL: "EURBRL=X", BTCBRL: "BTC-BRL", BTCUSD: "BTC-USD" };
    const out = {};
    Object.keys(map).forEach((k) => {
      const r = payload && payload[k];
      const price = r ? num(r.bid) : NaN;
      if (!Number.isFinite(price) || price <= 0) return;
      out[map[k]] = { price: price, changePct: sanePct(r.pctChange), ts: num(r.timestamp) * 1000 };
    });
    return out;
  }

  // Ordem de fontes fixa por linha: nunca depende de quem respondeu primeiro.
  // Fonte que falhou (ok[src] === false) só serve se nenhuma seguinte da ordem
  // tiver o símbolo; aí volta marcada como antiga por isOld.
  function pick(row, by, ok) {
    const order = row.src || ["edge"];
    let fallback = null;
    for (let i = 0; i < order.length; i++) {
      const q = by && by[order[i]] && by[order[i]][row.s];
      if (!q || !Number.isFinite(q.price)) continue;
      const item = Object.assign({ src: order[i] }, q);
      if (ok && ok[order[i]] === false) { if (!fallback) fallback = item; continue; }
      return item;
    }
    return fallback;
  }

  // Linha esmaecida: contrato sem negócio recente, fonte fora do ar, ou ativo de
  // 24 h (cripto) com cotação de mais de 1 h.
  function isOld(row, quote, ok, now) {
    if (!quote) return false;
    if (quote.stale || (ok && ok[quote.src] === false)) return true;
    return !!row.h24 && (now === undefined ? Date.now() : now) - quote.ts > 3600000;
  }

  // Único texto que não vem do universo é a busca digitada: entra no HTML escapado.
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
  }

  // Uma linha pode aparecer em mais de uma aba (soja: Grãos e Chicago).
  function inTab(row, tab) {
    return (row.tabs || []).indexOf(tab) !== -1;
  }

  // Sem acento e sem caixa: "algodao" acha "Algodão".
  function fold(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function matches(row, q) {
    return fold(row.show + " " + row.n + " " + row.group).indexOf(fold(q.trim())) !== -1;
  }

  // Seções na ordem do maior `q` de cada grupo; linhas por `q` decrescente.
  // O rótulo do grupo é único no universo, então é a chave.
  function sections(rows) {
    const byGroup = {};
    const out = [];
    rows.slice().sort((a, b) => b.q - a.q).forEach((row) => {
      if (!byGroup[row.group]) {
        byGroup[row.group] = { group: row.group, rows: [] };
        out.push(byGroup[row.group]);
      }
      byGroup[row.group].rows.push(row);
    });
    return out;
  }

  return { sanePct, fmtPrice, fmtPct, pctClass, stamp, fromEdge, fromAwesome, pick, isOld, esc, inTab, fold, matches, sections, MAX_DAILY_PCT };
});
