import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
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
  assert.equal(C.fmtPct(0.005), "+0,01%");
  assert.equal(C.fmtPct(-0.005), "−0,01%");
  assert.equal(C.pctClass(-0.005), "down");
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
      { symbol: "CTZ28.NYB", value: 77.09, delta: 1.17, stale: true, ts: 1 },
      { symbol: "ZSH26.CBT", value: null, delta: null, error: "falha" },
      { symbol: "X", value: 0, delta: 1 }
    ]
  });
  assert.deepEqual(Object.keys(q), ["AAPL", "CTZ28.NYB"]);
  assert.equal(q.AAPL.changePct, -2.66);
  assert.equal(q["CTZ28.NYB"].changePct, null);
  assert.equal(q["CTZ28.NYB"].stale, true);
  assert.equal(q.AAPL.stale, false);
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

test("pick: fonte que falhou não tapa uma seguinte que está boa; sem alternativa, volta marcada", () => {
  const row = { s: "BRL=X", src: ["awesome", "edge"] };
  const by = { awesome: { "BRL=X": { price: 5.2 } }, edge: { "BRL=X": { price: 5.2031 } } };
  assert.equal(C.pick(row, by, { awesome: false, edge: true }).src, "edge");
  assert.equal(C.pick(row, by, { awesome: true, edge: true }).src, "awesome");
  const so = C.pick(row, { awesome: by.awesome, edge: {} }, { awesome: false, edge: true });
  assert.equal(so.src, "awesome");
  assert.equal(C.isOld(row, so, { awesome: false, edge: true }), true);
});

test("isOld: contrato parado, fonte fora do ar e cripto com cotação de mais de 1 h", () => {
  const now = Date.UTC(2026, 8, 30, 1, 0);
  assert.equal(C.isOld({}, null, {}), false);
  assert.equal(C.isOld({}, { src: "edge", stale: true, ts: now }, { edge: true }, now), true);
  assert.equal(C.isOld({}, { src: "edge", ts: now }, { edge: false }, now), true);
  assert.equal(C.isOld({}, { src: "edge", ts: now }, { edge: true }, now), false);
  assert.equal(C.isOld({ h24: true }, { src: "awesome", ts: now - 3600001 }, { awesome: true }, now), true);
  assert.equal(C.isOld({ h24: true }, { src: "awesome", ts: now - 3599000 }, { awesome: true }, now), false);
  assert.equal(C.isOld({}, { src: "edge", ts: now - 86400000 * 3 }, { edge: true }, now), false);
});

const TABS = ["graos", "acoes", "fx", "chicago"];

test("universo: símbolos únicos, abas válidas, fontes só edge/awesome", () => {
  const u = win.YC_UNIVERSE;
  assert.equal(new Set(u.map((r) => r.s)).size, u.length);
  for (const r of u) {
    assert.ok(r.tabs.length > 0 && r.tabs.every((t) => TABS.includes(t)), r.s);
    assert.ok(r.group, r.s);
    assert.ok(Number.isInteger(r.dec) && r.dec >= 0 && r.dec <= 4, r.s);
    assert.ok(r.u && r.n && r.show, r.s);
    for (const s of r.src || ["edge"]) assert.ok(["edge", "awesome"].includes(s), r.s);
  }
  assert.match(win.YC_EDGE, /^https:\/\/yc-finance-api\.vercel\.app$/);
});

test("universo: um rótulo de grupo pertence a um só conjunto de abas", () => {
  const tabsOf = {};
  for (const r of win.YC_UNIVERSE) {
    const key = Array.from(r.tabs).sort().join("+");
    assert.equal(tabsOf[r.group] || key, key, "grupo '" + r.group + "' aparece em abas diferentes (" + r.s + ")");
    tabsOf[r.group] = key;
  }
});

test("universo: contratos vencidos e linhas sem fonte própria ficaram de fora", () => {
  const syms = win.YC_UNIVERSE.map((r) => r.s);
  assert.ok(!syms.includes("ZSH26.CBT"));
  assert.ok(!syms.some((s) => s.startsWith("IMEA")));
  assert.ok(!syms.includes("CT=F") && !syms.includes("ZS=F") && !syms.includes("ZC=F"));
});

test("universo: câmbio segue o dia brasileiro (AwesomeAPI primeiro); soja e milho em ¢/bu", () => {
  const by = Object.fromEntries(win.YC_UNIVERSE.map((r) => [r.s, r]));
  assert.deepEqual(Array.from(by["BRL=X"].src), ["awesome", "edge"]);
  assert.deepEqual(Array.from(by["EURBRL=X"].src), ["awesome", "edge"]);
  for (const s of ["ZSX26.CBT", "ZSH27.CBT", "ZSH28.CBT", "ZCZ26.CBT"]) assert.equal(by[s].u, "¢/bu", s);
  for (const s of ["CTZ26.NYB", "CTZ27.NYB", "CTZ28.NYB"]) assert.equal(by[s].u, "¢/lb", s);
});

test("universo: Nasdaq Composite com rótulo certo e cripto marcada como 24 h", () => {
  const by = Object.fromEntries(win.YC_UNIVERSE.map((r) => [r.s, r]));
  assert.equal(by["^IXIC"].show, "IXIC");
  assert.equal(by["BTC-BRL"].h24, true);
  assert.equal(by["BTC-USD"].h24, true);
});

const inTab = (tab) => win.YC_UNIVERSE.filter((r) => C.inTab(r, tab));

test("abas: as quatro têm linhas; Chicago é o painel CBOT, contido em Grãos", () => {
  for (const t of TABS) assert.ok(inTab(t).length > 0, t);
  const chicago = inTab("chicago");
  assert.deepEqual(Array.from(chicago.map((r) => r.s).sort()), ["ZCZ26.CBT", "ZSH27.CBT", "ZSH28.CBT", "ZSX26.CBT"]);
  for (const r of chicago) assert.ok(C.inTab(r, "graos"), r.s);
  assert.ok(win.YC_UNIVERSE.filter((r) => r.tabs.length > 1).every((r) => r.s.endsWith(".CBT")));
});

test("index.html: um só menu, com as mesmas abas do universo e na ordem combinada", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.deepEqual([...html.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1]), TABS);
  assert.equal((html.match(/<nav/g) || []).length, 1);
  assert.equal((html.match(/aria-current="true"/g) || []).length, 1);
  assert.equal((html.match(/<h1>/g) || []).length, 1);
});

test("index.html: assets com a mesma versão, para o cache não misturar arquivos", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const versions = [...html.matchAll(/(?:href|src)="(?:styles\.css|universe\.js|quotes-core\.js|app\.js)\?v=(\d+)"/g)].map((m) => m[1]);
  assert.equal(versions.length, 4);
  assert.equal(new Set(versions).size, 1);
});

test("sections: grupos na ordem do maior q, linhas por q, sem grupo repetido", () => {
  const secs = C.sections(inTab("graos"));
  assert.deepEqual(Array.from(secs.map((s) => s.group)), ["Algodão", "Soja", "Milho", "Energia"]);
  assert.deepEqual(Array.from(secs[1].rows.map((r) => r.show)), ["ZSX26", "ZSH27", "ZSH28"]);
  const all = C.sections(win.YC_UNIVERSE);
  assert.equal(new Set(all.map((s) => s.group)).size, all.length);
  assert.equal(all.reduce((n, s) => n + s.rows.length, 0), win.YC_UNIVERSE.length);
  assert.deepEqual(C.sections([]), []);
});

test("sections: Ações separa B3, EUA e índices; PRIO3 fica junto de PETR4", () => {
  const secs = C.sections(inTab("acoes"));
  assert.equal(secs[0].group, "Índices");
  const energia = secs.find((s) => s.group === "B3 · Energia e mineração");
  assert.deepEqual(Array.from(energia.rows.map((r) => r.show)), ["PETR4", "VALE3", "PRIO3"]);
  for (const s of secs) assert.ok(s.group === "Índices" || /^(B3|EUA) · /.test(s.group), s.group);
  assert.ok(secs.every((s) => s.rows.length >= 2), "grupo de uma linha só vira título solto");
});

test("matches: sem acento e sem caixa, vale para ticker, nome e grupo", () => {
  const by = Object.fromEntries(win.YC_UNIVERSE.map((r) => [r.s, r]));
  assert.equal(C.matches(by["CTZ26.NYB"], "algodao"), true);
  assert.equal(C.matches(by["CTZ26.NYB"], "  ALGODÃO "), true);
  assert.equal(C.matches(by["PETR4.SA"], "petr"), true);
  assert.equal(C.matches(by["PETR4.SA"], "energia"), true);
  assert.equal(C.matches(by["PETR4.SA"], "soja"), false);
  const b3 = win.YC_UNIVERSE.filter((r) => C.matches(r, "b3"));
  assert.ok(b3.length >= 11 && b3.every((r) => r.tabs.includes("acoes")));
});

test("esc: a busca digitada não vira HTML", () => {
  assert.equal(C.esc("<img src=x onerror=alert(1)>"), "&#60;img src=x onerror=alert(1)&#62;");
  assert.equal(C.esc("a&b\"c'd"), "a&#38;b&#34;c&#39;d");
  assert.equal(C.esc(123), "123");
});

const here = (p) => new URL("../" + p, import.meta.url);

// Largura e altura no cabeçalho IHDR do PNG; barra arquivo que não é PNG.
function pngSize(path) {
  const b = readFileSync(here(path));
  assert.equal(b.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", path + " não é PNG");
  return b.readUInt32BE(16) + "x" + b.readUInt32BE(20);
}

test("index.html: todo arquivo local citado existe, sem link quebrado", () => {
  const html = readFileSync(here("index.html"), "utf8");
  const local = [...html.matchAll(/(?:href|src)="([^"#?]+)(?:\?[^"]*)?"/g)].map((m) => m[1]).filter((p) => !/^(https?:)?\/\//.test(p));
  assert.ok(local.length >= 7, "esperava ao menos 7 arquivos locais, achei " + local.length);
  for (const p of local) assert.ok(existsSync(here(p)), "falta o arquivo: " + p);
});

test("ícones e prévia: tamanhos declarados batem com o PNG real", () => {
  assert.equal(pngSize("apple-touch-icon.png"), "180x180");
  assert.equal(pngSize("og.png"), "1200x630");
  const manifest = JSON.parse(readFileSync(here("manifest.webmanifest"), "utf8"));
  assert.ok(manifest.icons.length >= 3);
  for (const icon of manifest.icons) assert.equal(pngSize(icon.src), icon.sizes, icon.src);
  assert.ok(manifest.icons.some((i) => i.purpose === "maskable"));
  const html = readFileSync(here("index.html"), "utf8");
  assert.match(html, /og:image:width" content="1200"/);
  assert.match(html, /og:image:height" content="630"/);
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="apple-touch-icon\.png"/);
});
