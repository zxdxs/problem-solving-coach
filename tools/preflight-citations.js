#!/usr/bin/env node
/* ============================================================
   引用合规 preflight（无依赖，Node 直接跑）
   用法： node tools/preflight-citations.js

   两张引文清单都在 references.html：
     · 表 参-5（id=ledger-lv）   吕思勉引文清单
     · 表 参-6（id=ledger-core） 核心书目引文清单

   规则：
     1) 站上「紧接 吕思勉《篇名》／吕思勉（…）」的带引号引文条数，
        必须等于 ledger-lv 里「逐字」栏的条数，而且每一条都要能查到。
     2) 站上「紧接（原书印刷页 N）」或「紧接 原书原话」的带引号引文条数，
        必须等于 ledger-core 里标 class="chk" 的「逐字」行数，而且每一条都要能查到。
        核心书其余逐字标注（无引号的原话、转写表、结构化台账）由页面标注兜底，不在此校验。

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

/* ---------- 工具 ---------- */
/* 引文两侧做同态归一：去掉 <b>/</b> 等标签、空白，便于站上与清单互查。 */
function norm(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
}
function tableBlock(html, id) {
  const i = html.indexOf('<table id="' + id + '">');
  const j = html.indexOf('</table>', i);
  if (i < 0 || j < 0) throw new Error('找不到清单表 id=' + id);
  return html.slice(i, j);
}

const files = walk(ROOT, []).filter(f => path.relative(ROOT, f) !== LEDGER);
const ledger = fs.readFileSync(path.join(ROOT, LEDGER), 'utf8');

/* ============================================================
   规则 1：吕思勉（站上紧接「吕思勉《篇名》」的引文）
   ============================================================ */
const RE_LV = /吕思勉(?:《[^》]+》|（[^）]+）)[^「]{0,12}「([^」]{1,60})」/g;
const lvHits = new Map(); // 引文(norm) -> Set(文件)
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  RE_LV.lastIndex = 0;
  let m;
  while ((m = RE_LV.exec(text)) !== null) {
    const q = norm(m[1]);
    if (!lvHits.has(q)) lvHits.set(q, new Set());
    lvHits.get(q).add(path.relative(ROOT, f));
  }
}

const lvBlock = tableBlock(ledger, 'ledger-lv');
const lvVerbatim = (lvBlock.match(/<td><b>逐字<\/b><\/td>/g) || []).length;
const lvQuotes = [...lvBlock.matchAll(/<td>「([^」]+)」<\/td>/g)].map(m => norm(m[1]));
const lvNotInLedger = [...lvHits.keys()].filter(q => lvQuotes.indexOf(q) < 0);

console.log('== 规则 1：站上（排除 ' + LEDGER + '）紧接「吕思勉《篇名》」的带引号引文 ==');
[...lvHits.keys()].sort().forEach(q => console.log('  「' + q + '」\n      ← ' + [...lvHits.get(q)].sort().join(', ')));
console.log('  去重小计：' + lvHits.size + ' 条\n');
console.log('== 清单（表 参-5）==');
console.log('  「逐字」栏行数：' + lvVerbatim + ' 条');
lvQuotes.forEach(q => console.log('    · 「' + q + '」'));

/* ============================================================
   规则 2：核心书目（站上紧接「原书印刷页」或「原书原话」的引文）
   ============================================================ */
/* 只扫 .html：data.js 里错误池的「原书依据」是结构化台账（表 参-6 已单列一行），
   其引文位于「原书印刷页 N：」之后，与本规则的方向相反，不会被误收。 */
const coreFiles = files.filter(f => path.extname(f) === '.html');
/* A 形：引文在前、出处紧随： 「…」（原书印刷页 N）
   B 形：标记在前、引文紧随： 原书原话…「…」 */
const RE_CORE_A = /「([^」]{1,60})」[^<]{0,30}原书印刷页/g;
const RE_CORE_B = /原书原话[^「]{0,45}「([^」]{1,60})」/g;
const coreHits = new Map(); // 引文(norm) -> Set(文件)
for (const f of coreFiles) {
  const text = fs.readFileSync(f, 'utf8');
  for (const re of [RE_CORE_A, RE_CORE_B]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const q = norm(m[1]);
      if (q.length < 2) continue;
      if (!coreHits.has(q)) coreHits.set(q, new Set());
      coreHits.get(q).add(path.relative(ROOT, f));
    }
  }
}

const coreBlock = tableBlock(ledger, 'ledger-core');
const coreChk = (coreBlock.match(/<td class="chk"><b>逐字<\/b>/g) || []).length;
const coreQuotes = [...coreBlock.matchAll(/<td>「([^」]+)」<\/td>/g)].map(m => norm(m[1]));
const coreNotInLedger = [...coreHits.keys()].filter(q => coreQuotes.indexOf(q) < 0);

console.log('\n== 规则 2：站上紧接「原书印刷页／原书原话」的带引号引文（.html） ==');
[...coreHits.keys()].sort().forEach(q => console.log('  「' + q + '」\n      ← ' + [...coreHits.get(q)].sort().join(', ')));
console.log('  去重小计：' + coreHits.size + ' 条\n');
console.log('== 清单（表 参-6）==');
console.log('  「自动校验」行数：' + coreChk + ' 条');
coreQuotes.forEach(q => console.log('    · 「' + q + '」'));

/* ============================================================
   判定
   ============================================================ */
console.log('');
let failed = false;
if (lvHits.size !== lvVerbatim) {
  failed = true;
  console.log('FAIL 规则1：吕思勉条数不一致——站上 ' + lvHits.size + ' 条，清单「逐字」' + lvVerbatim + ' 条。');
}
if (lvNotInLedger.length) {
  failed = true;
  console.log('FAIL 规则1：站上引了、清单（参-5）查不到的吕思勉引文：');
  lvNotInLedger.forEach(q => console.log('    「' + q + '」'));
}
if (coreHits.size !== coreChk) {
  failed = true;
  console.log('FAIL 规则2：核心书条数不一致——站上 ' + coreHits.size + ' 条，清单「自动校验」' + coreChk + ' 条。');
}
if (coreNotInLedger.length) {
  failed = true;
  console.log('FAIL 规则2：站上引了、清单（参-6）查不到的核心书引文：');
  coreNotInLedger.forEach(q => console.log('    「' + q + '」'));
}
if (failed) process.exit(1);
console.log('PASS：吕思勉条数一致（' + lvHits.size + ' = ' + lvVerbatim + '）且每条可查；');
console.log('      核心书条数一致（' + coreHits.size + ' = ' + coreChk + '）且每条可查。');
process.exit(0);
