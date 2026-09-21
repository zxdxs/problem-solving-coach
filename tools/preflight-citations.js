#!/usr/bin/env node
/* ============================================================
   引用合规 preflight（无依赖，Node 直接跑）
   用法： node tools/preflight-citations.js

   规则：站上「紧接 吕思勉《篇名》／吕思勉（…）」的带引号引文条数，
        必须等于 references.html 引文清单里「逐字」栏的条数，
        而且每一条都要能在清单里查到。
   不一致 → exit 1，并列出是哪几条对不上。

   这样将来任何一处加了引号却没进清单、或清单里多标了「逐字」，
   都会立刻亮红，而不是悄悄错下去。
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEDGER = 'references.html';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'tools']);
const SCAN_EXT = new Set(['.html', '.js', '.md']);

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(p, out);
    } else if (SCAN_EXT.has(path.extname(name))) {
      out.push(p);
    }
  }
  return out;
}

/* 只认「紧接」形式：吕思勉《篇名》…「引文」 或 吕思勉（…）…「引文」，
   中间最多 12 个非「字符（例如「：」「里说」「说的」）。
   于是「并非吕思勉原话……有「标题系编者所加」」这类反例不会被误收。 */
const RE = /吕思勉(?:《[^》]+》|（[^）]+）)[^「]{0,12}「([^」]{1,60})」/g;

const files = walk(ROOT, []).filter(f => path.relative(ROOT, f) !== LEDGER);
const hits = new Map(); // 引文 -> Set(文件)
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  RE.lastIndex = 0;
  let m;
  while ((m = RE.exec(text)) !== null) {
    const q = m[1];
    if (!hits.has(q)) hits.set(q, new Set());
    hits.get(q).add(path.relative(ROOT, f));
  }
}

/* 清单约定：逐字栏一律写作 <td><b>逐字</b></td>；
   「逐字但非原创」等保留为纯文本，因此不会被算进逐字条数。 */
const ledger = fs.readFileSync(path.join(ROOT, LEDGER), 'utf8');
const verbatimCount = (ledger.match(/<td><b>逐字<\/b><\/td>/g) || []).length;
const ledgerQuotes = [...ledger.matchAll(/<td>「([^」]+)」<\/td>/g)].map(m => m[1]);
const notInLedger = [...hits.keys()].filter(q => ledgerQuotes.indexOf(q) < 0);

console.log('== 站上（排除 ' + LEDGER + '）紧接「吕思勉《篇名》」的带引号引文 ==');
[...hits.keys()].sort().forEach(q => console.log('  「' + q + '」\n      ← ' + [...hits.get(q)].sort().join(', ')));
console.log('  去重小计：' + hits.size + ' 条\n');

console.log('== 引文清单（' + LEDGER + '）==');
console.log('  「逐字」栏行数：' + verbatimCount + ' 条');
ledgerQuotes.forEach(q => console.log('    · 「' + q + '」'));

console.log('');
let failed = false;
if (hits.size !== verbatimCount) {
  failed = true;
  console.log('FAIL：条数不一致——站上 ' + hits.size + ' 条，清单「逐字」' + verbatimCount + ' 条。');
}
if (notInLedger.length) {
  failed = true;
  console.log('FAIL：站上引了、清单里查不到的引文：');
  notInLedger.forEach(q => console.log('    「' + q + '」'));
}
if (failed) process.exit(1);
console.log('PASS：条数一致（' + hits.size + ' = ' + verbatimCount + '），且每条都在清单里查得到。');
process.exit(0);
