#!/usr/bin/env bash
# psc-sync.sh —— 在**伺服器上**執行：把 solve-lab.cn 的站點內容對齊倉庫，並移除不該公開的內部文件
#
# 為什麼要有這支
#   本站沒有 CI：推送 GitHub 不會自動部署，每次都要人工上傳。人工上傳就會漏——
#   實測線上 assets/app.js 停在 10-03 的舊版（19,933 B），本地已是含公安備案號的新版
#   （20,538 B），而 data.js 的 gongan 仍是空字串、ghs.png 直接 404。
#   這支把「該上傳的、該刪掉的」寫成一條指令，且**預設只印計畫、不動任何檔案**。
#
# 用法（在伺服器的終端機，OrcaTerm 即可）
#   curl -fsSL <本檔的 raw 網址> | bash              # 只印計畫（dry-run）
#   curl -fsSL <本檔的 raw 網址> | bash -s -- --apply # 真的執行
#
# 安全設計
#   · 只碰白名單裡的檔案（3 個下載、3 個刪除），不做整目錄同步、不用 --delete
#   · 找不到站點根目錄就停手，不會猜
#   · 下載後先比對大小，再放進站點；大小不符就放棄該檔
#   · 不修改 Caddy 設定、不重啟服務
set -uo pipefail

RAW="${RAW:-https://raw.githubusercontent.com/zxdxs/problem-solving-coach/main}"
FILES="assets/data.js assets/app.js assets/ghs.png"   # 要更新的站點檔案
DROP="MIGRATION.md DEPLOY.md TENCENT-CLOUD.md"        # 要自網站移除的內部文件
APPLY=0
# ★ 不要寫 for a in "$@"：macOS 內建 bash 3.2 在 set -u 下，空 "$@" 會報 unbound variable（實測踩到）。
[ "${1:-}" = "--apply" ] && APPLY=1

say() { printf '%s\n' "${1:-}"; }   # 空行也要能印：set -u 下 ${1} 沒給會報 unbound

# ── 一、找站點根目錄 ──────────────────────────────────────────────
# 判準：同時具備 ① 首頁寫著「解决问题训练站」 ② assets/data.js 寫著本站 ICP 號。
# 兩個都對才認，避免誤認中文聲韻站（同機、同目錄結構、ICP 號只差尾碼）。
looks_like_psc() {
  local d="${1}"
  [ -f "${d}/index.html" ] || return 1
  grep -q '解决问题训练站' "${d}/index.html" 2>/dev/null || return 1
  grep -q '蜀ICP备2026055920号-1' "${d}/assets/data.js" 2>/dev/null || return 1
  return 0
}

candidates=""
# ① Caddyfile 裡寫的 root（最權威）
for cf in /etc/caddy/Caddyfile /etc/caddy/*.caddy /etc/caddy/conf.d/*; do
  [ -f "${cf}" ] || continue
  while IFS= read -r r; do
    r=$(printf '%s' "${r}" | sed -E 's/^[[:space:]]*root[[:space:]]*\*?[[:space:]]*//; s/[[:space:]]*\{[[:space:]]*$//; s/^"//; s/"$//')
    case "${r}" in /*) candidates="${candidates} ${r}" ;; esac
  done < <(grep -hE '^[[:space:]]*root[[:space:]]' "${cf}" 2>/dev/null)
done
# ② 常見站點目錄（萬一 Caddyfile 讀不到）
for b in /var/www /srv /home /root /opt /data /usr/share/caddy; do
  [ -d "${b}" ] || continue
  while IFS= read -r d; do candidates="${candidates} ${d}"; done < <(find "${b}" -maxdepth 4 -type d -name assets 2>/dev/null | sed 's#/assets$##')
done

ROOT=""
if [ -n "${SITE_ROOT:-}" ]; then
  ROOT="${SITE_ROOT}"          # 明確指定時跳過搜尋（主機目錄結構特殊時用）
else
  for d in ${candidates}; do
    if looks_like_psc "${d}"; then ROOT="${d}"; break; fi
  done
fi

say "══ solve-lab.cn 站點同步 ══"
say "倉庫來源：${RAW}"
if [ -z "${ROOT}" ]; then
  say "✗ 找不到 solve-lab.cn 的站點根目錄（已試 Caddyfile 的 root 與常見目錄）。"
  say "  請先確認這台機器是不是本站的主機，或把下面這行的輸出貼回來："
  say "    grep -nE 'root|solve-lab' /etc/caddy/Caddyfile"
  exit 1
fi
say "站點根目錄：${ROOT}"
say "模式：$([ "${APPLY}" = 1 ] && echo '實際執行' || echo '只印計畫（要真的做，加 --apply）')"
say

# ── 二、下載並比對 ────────────────────────────────────────────────
TMP=$(mktemp -d)
trap 'rm -rf "${TMP}"' EXIT
say "── 要更新的檔案"
NEED=""
for f in ${FILES}; do
  if ! curl -fsS -m 60 -o "${TMP}/$(basename "${f}")" "${RAW}/${f}"; then
    say "  ✗ ${f} —— 下載失敗，跳過"
    continue
  fi
  new=$(wc -c < "${TMP}/$(basename "${f}")" | tr -d ' ')
  cur=0
  [ -f "${ROOT}/${f}" ] && cur=$(wc -c < "${ROOT}/${f}" | tr -d ' ')
  if [ "${new}" = "${cur}" ]; then
    say "  = ${f} —— 已是新版（${cur} bytes）"
  else
    say "  ↑ ${f} —— 線上 ${cur} bytes → 新版 ${new} bytes"
    NEED="${NEED} ${f}"
  fi
done
[ -z "${NEED}" ] && say "（沒有需要更新的檔案）"

say
say "── 要自網站移除的內部文件（寫給自己看的：主機、桶名、備案過程）"
GONE=""
for d in ${DROP}; do
  if [ -f "${ROOT}/${d}" ]; then say "  ✗ ${d} —— 線上存在，將刪除"; GONE="${GONE} ${d}"; else say "  = ${d} —— 線上沒有，無需處理"; fi
done

if [ "${APPLY}" != 1 ]; then
  say
  say "以上是計畫。確定要執行就重跑同一條指令並加上 --apply。"
  exit 0
fi

# ── 三、備份後執行 ────────────────────────────────────────────────
BAK="${ROOT}/../psc-sync-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BAK}"
say
say "── 執行（原檔備份到 ${BAK}）"
for f in ${NEED}; do
  mkdir -p "${ROOT}/$(dirname "${f}")"
  [ -f "${ROOT}/${f}" ] && cp -p "${ROOT}/${f}" "${BAK}/$(basename "${f}").old"
  cp -p "${TMP}/$(basename "${f}")" "${ROOT}/${f}"
  say "  ✓ 已更新 ${f}"
done
for d in ${GONE}; do
  cp -p "${ROOT}/${d}" "${BAK}/${d}.removed" 2>/dev/null || true
  rm -f "${ROOT}/${d}"
  say "  ✓ 已移除 ${d}"
done

# ── 四、就地驗收 ──────────────────────────────────────────────────
say
say "── 就地驗收（直接讀伺服器上的檔案，不經 CDN）"
fail=0
chk_has() {  # <檔案> <關鍵字> <說明>
  if grep -q "${2}" "${ROOT}/${1}" 2>/dev/null; then say "  ✓ ${3}"; else say "  ✗ ${3}"; fail=$((fail + 1)); fi
}
chk_has assets/data.js '蜀ICP备2026055920号-1' 'ICP 備案號'
chk_has assets/data.js '川公网安备51018102000885号' '公安聯網備案號'
chk_has assets/app.js  'beian.mps.gov.cn/#/query/webSearch?code=' '公安備案查詢連結'
if [ -s "${ROOT}/assets/ghs.png" ]; then say "  ✓ 公安備案圖標（$(wc -c < "${ROOT}/assets/ghs.png" | tr -d ' ') bytes）"; else say "  ✗ 公安備案圖標"; fail=$((fail + 1)); fi
for d in ${DROP}; do
  if [ -f "${ROOT}/${d}" ]; then say "  ✗ ${d} 仍在線上"; fail=$((fail + 1)); else say "  ✓ ${d} 已不在線上"; fi
done

say
if [ "${fail}" = 0 ]; then
  say "結果：伺服器端全部就緒。回報後會再從外部跑一次 tools/verify_live.sh 驗收。"
else
  say "結果：仍有 ${fail} 項未過，請把上面輸出貼回來。"
fi
exit 0
