#!/usr/bin/env node
/* ============================================================
   ui-probe：用 Chrome DevTools Protocol 開 headless Chrome，逐頁跑 JS。
   usage:
     NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules \
       node tools/ui-probe.js <spec.json>

   spec: { pages: [ { name, url, width?, before?|beforeFile?, after|afterFile } ] }
     before → 先跑一次，然後 reload（讓頁面腳本看得到剛寫入的 localStorage）
     after  → 載入完成後求值，其值即該頁的結果
   回報每頁的 value 與 jsErrors（未捕捉例外）。

   為何不用 --dump-dom：
     本機實測 --dump-dom 的「自行退出」是間歇性的——DOM 每次都完整產出，
     但程序常不自己結束（需外部 kill）。且它無法在頁面內求值、無法量窄屏。
     CDP 逐頁 evaluate 較穩，且不需要 Chrome 自己退出。

   記憶體：8GB 機器上 headless Chrome 很吃緊（實測 swap 已用 1.6G/3G）。
     因此本檔【串行】跑每一頁（不併發開多個 Chrome），且全程只用一個
     browser process，最後一律 SIGKILL 回收。spec 太大時請自行分批。
   ============================================================ */
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const profile = fs.mkdtempSync('/tmp/dshcdp-');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpJson(pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pathname, method }, res => {
      let b = '';
      res.on('data', d => (b += d));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(new Error('bad json: ' + b.slice(0, 200))); } });
    });
    req.on('error', reject);
    req.end();
  });
}
async function waitPort() {
  for (let i = 0; i < 120; i++) {
    try { return await httpJson('/json/version'); } catch (e) { await sleep(250); }
  }
  throw new Error('devtools port never came up');
}

(async () => {
  /* ★★ 啟動參數：勿加 --single-process ★★
     2026-09-21 實測：macOS headless 下加 --single-process 會去初始化
     WindowServer 連線，必 SIGSEGV（崩潰報告 byPid 2883；faulting frames
     為 CGSConnectionsLock / SLSMainConnection / +[NSScreen …]）。
     那不是環境問題，是該 flag 本身不可用——請勿再加回來。

     --crash-dumps-dir 指向本次臨時目錄：
       沙箱拒絕寫 ~/Library/Application Support/Google/Chrome/Crashpad/settings.dat，
       會讓 chrome_crashpad_handler 自己 SIGTRAP 中止（一次探針就累積數十份 .ips 噪音）。
       只改寫入目錄，【不關閉 crash reporter】——保留轉儲能力才好定位問題
       （這次正是靠 .ips 才抓到 --single-process 是真兇）。 */
  const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking', '--disable-sync',
    '--disable-extensions', '--disable-dev-shm-usage', '--allow-file-access-from-files',
    '--mute-audio', '--crash-dumps-dir=' + profile,
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'],
    { stdio: 'ignore' });
  const results = [];
  try {
    await waitPort();
    for (const p of spec.pages) {
      const t = await httpJson('/json/new?' + encodeURIComponent('about:blank'), 'PUT');
      const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
      await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
      let mid = 0; const pending = new Map(); let evs = []; const exceptions = [];
      ws.on('message', raw => {
        const m = JSON.parse(raw);
        if (m.id && pending.has(m.id)) {
          const { res, rej } = pending.get(m.id); pending.delete(m.id);
          if (m.error) rej(new Error(m.method + ' ' + JSON.stringify(m.error))); else res(m.result);
        } else if (m.method === 'Runtime.exceptionThrown') {
          const d = m.params && m.params.exceptionDetails;
          exceptions.push((d && (d.text || (d.exception && d.exception.description))) || 'exception');
        } else if (m.method) evs.push(m.method);
      });
      const send = (method, params = {}) => new Promise((res, rej) => {
        const id = ++mid; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params }));
      });
      const waitEvent = async (name, ms = 20000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { if (evs.includes(name)) return true; await sleep(50); }
        return false;
      };
      const evalJs = async expr => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) {
          const ex = r.exceptionDetails.exception;
          return { EVAL_ERROR: (ex && (ex.description || ex.value)) || r.exceptionDetails.text };
        }
        return r.result.value;
      };
      const entry = { name: p.name || p.url };
      try {
        await send('Page.enable'); await send('Runtime.enable');
        if (p.width) await send('Emulation.setDeviceMetricsOverride',
          { width: p.width, height: 900, deviceScaleFactor: 1, mobile: false });
        await send('Page.navigate', { url: p.url });
        await waitEvent('Page.loadEventFired');
        if (p.before || p.beforeFile) {
          await evalJs(p.beforeFile ? fs.readFileSync(p.beforeFile, 'utf8') : p.before);
          evs = [];
          await send('Page.reload', { ignoreCache: false });
          await waitEvent('Page.loadEventFired');
        }
        await sleep(350);
        entry.value = await evalJs(p.afterFile ? fs.readFileSync(p.afterFile, 'utf8') : p.after);
        entry.jsErrors = exceptions.slice();
      } catch (e) {
        entry.error = String((e && e.message) || e);
      }
      results.push(entry);
      try { ws.close(); } catch (e) {}
    }
  } catch (e) {
    results.push({ name: 'FATAL', error: String((e && e.message) || e) });
  }
  console.log(JSON.stringify(results, null, 2));
  /* 一律 SIGKILL 回收：不依賴 Chrome 自己退出（--dump-dom 的教訓）。
     之後再刪掉本次臨時 profile（含 crash dumps）——否則每跑一次就在
     /tmp 累積一個 dshcdp-* 目錄（每個含一份 profile，數十 MB）。
     留 400ms 讓 Chrome 真的死透再刪，刪不掉也不影響結果。 */
  try { chrome.kill('SIGKILL'); } catch (e) {}
  setTimeout(() => {
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }, 400);
})();
