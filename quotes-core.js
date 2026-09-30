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

  function pctClass(chg) {
    if (!Number.isFinite(chg) || round2(chg) === 0) return "flat";
    return chg > 0 ? "up" : "down";
  }

  function fmtPct(chg) {
    if (!Number.isFinite(chg)) return "—";
    const r = round2(chg);
    const body = Math.abs(r).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (r > 0 ? "+" : r < 0 ? "−" : "") + body + "%";
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
      out[row.symbol] = { price: price, changePct: sanePct(row.delta), ts: num(row.ts) };
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
  function pick(row, by) {
    const order = row.src || ["edge"];
    for (let i = 0; i < order.length; i++) {
      const q = by && by[order[i]] && by[order[i]][row.s];
      if (q && Number.isFinite(q.price)) return Object.assign({ src: order[i] }, q);
    }
    return null;
  }

  return { sanePct, fmtPrice, fmtPct, pctClass, stamp, fromEdge, fromAwesome, pick, MAX_DAILY_PCT };
});
