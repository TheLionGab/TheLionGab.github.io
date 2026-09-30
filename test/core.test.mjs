import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const C = require("../quotes-core.js");

const win = {};
vm.runInNewContext(readFileSync(new URL("../universe.js", import.meta.url), "utf8"), { window: win });

test("sanePct: texto com ponto decimal, lixo e valor fora do teto", () => {
  assert.equal(C.sanePct("-0.318"), -0.318);
  assert.equal(C.sanePct(1.53), 1.53);
  assert.equal(C.sanePct("-234"), null);
  assert.equal(C.sanePct("abc"), null);
  assert.equal(C.sanePct(""), null);
  assert.equal(C.sanePct(null), null);
  assert.equal(C.sanePct(undefined), null);
});

test("fmtPrice e fmtPct em pt-BR", () => {
  assert.equal(C.fmtPrice(1296.25, 2), "1.296,25");
  assert.equal(C.fmtPrice(5.2031, 4), "5,2031");
  assert.equal(C.fmtPrice(435608, 0), "435.608");
  assert.equal(C.fmtPrice(NaN, 2), "—");
  assert.equal(C.fmtPct(0.24), "+0,24%");
  assert.equal(C.fmtPct(-4.834), "−4,83%");
  assert.equal(C.fmtPct(-0.004), "0,00%");
  assert.equal(C.fmtPct(null), "—");
  assert.equal(C.pctClass(0.004), "flat");
  assert.equal(C.pctClass(1), "up");
  assert.equal(C.pctClass(-1), "down");
  assert.equal(C.pctClass(null), "flat");
});

test("stamp: hoje mostra hora de Brasília, outro dia mostra dia/mês", () => {
  const ts = Date.UTC(2026, 8, 29, 21, 38);
  assert.equal(C.stamp(ts, Date.UTC(2026, 8, 29, 23, 0)), "18:38");
  assert.equal(C.stamp(ts, Date.UTC(2026, 8, 30, 15, 0)), "29/09");
  assert.equal(C.stamp(NaN), "");
});

test("fromAwesome: pctChange em texto com ponto não vira ×1000", () => {
  const q = C.fromAwesome({
    USDBRL: { bid: "5.2031", pctChange: "-0.381008", timestamp: "1790717142" },
    BTCBRL: { bid: "435608", pctChange: "-0.318", timestamp: "1790728747" },
    EURBRL: { bid: "0", pctChange: "1", timestamp: "1" }
  });
  assert.equal(q["BRL=X"].price, 5.2031);
  assert.equal(q["BRL=X"].changePct, -0.381008);
  assert.equal(q["BTC-BRL"].price, 435608);
  assert.equal(q["BTC-BRL"].changePct, -0.318);
  assert.equal(q["BTC-BRL"].ts, 1790728747000);
  assert.equal(q["EURBRL=X"], undefined);
});

test("fromEdge: ignora linha com erro e delta nulo vira sem variação", () => {
  const q = C.fromEdge({
    quotes: [
      { symbol: "AAPL", value: 329.4, delta: -2.66, ts: 1790712000000 },
      { symbol: "CTZ28.NYB", value: 77.09, delta: null, ts: 1 },
      { symbol: "ZSH26.CBT", value: null, delta: null, error: "falha" },
      { symbol: "X", value: 0, delta: 1 }
    ]
  });
  assert.deepEqual(Object.keys(q), ["AAPL", "CTZ28.NYB"]);
  assert.equal(q.AAPL.changePct, -2.66);
  assert.equal(q["CTZ28.NYB"].changePct, null);
});

test("pick: ordem fixa de fontes, sem depender de quem respondeu antes", () => {
  const row = { s: "BRL=X", src: ["edge", "awesome"] };
  const both = { edge: { "BRL=X": { price: 5.2031 } }, awesome: { "BRL=X": { price: 5.2033 } } };
  assert.equal(C.pick(row, both).price, 5.2031);
  assert.equal(C.pick(row, both).src, "edge");
  assert.equal(C.pick(row, { edge: {}, awesome: both.awesome }).src, "awesome");
  assert.equal(C.pick({ s: "AAPL" }, { awesome: { AAPL: { price: 1 } } }), null);
  assert.equal(C.pick({ s: "AAPL" }, { edge: {} }), null);
});

test("universo: símbolos únicos, abas válidas, fontes só edge/awesome", () => {
  const u = win.YC_UNIVERSE;
  assert.equal(new Set(u.map((r) => r.s)).size, u.length);
  for (const r of u) {
    assert.ok(["agro", "b3", "global", "fx"].includes(r.tab), r.s);
    assert.ok(Number.isInteger(r.dec) && r.dec >= 0 && r.dec <= 4, r.s);
    assert.ok(r.u && r.n && r.show, r.s);
    for (const s of r.src || ["edge"]) assert.ok(["edge", "awesome"].includes(s), r.s);
  }
  assert.match(win.YC_EDGE, /^https:\/\/yc-finance-api\.vercel\.app$/);
});

test("universo: contratos vencidos e linhas sem fonte própria ficaram de fora", () => {
  const syms = win.YC_UNIVERSE.map((r) => r.s);
  assert.ok(!syms.includes("ZSH26.CBT"));
  assert.ok(!syms.some((s) => s.startsWith("IMEA")));
  assert.ok(!syms.includes("CT=F") && !syms.includes("ZS=F") && !syms.includes("ZC=F"));
});
