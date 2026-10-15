#!/usr/bin/env bash
# verify_live.sh —— 部署後驗收：確認 solve-lab.cn 線上的內容就是這個倉庫的內容
#
# 為什麼要有這支
#   本站的部署模型是「倉庫根目錄 = 網站根目錄」（與中文聲韻站相同），
#   但推送 GitHub **不會**自動部署，要在伺服器端同步。同步很容易只做一半：
#   頁面更新了、assets/ 忘了；或改了 app.js 卻沒上 data.js。
#   這支把「有沒有同步」變成一條可重複執行的指令。
#
#   ★ 關鍵設計：**逐位元比對**，不是看 200。
#     舊版檔案一樣回 200，只看狀態碼無法分辨新舊——實測線上 assets/app.js
#     是舊版（19,933 B）而本地是新版（20,538 B），兩者皆 200。
#     因此第三節用 md5 比對「所有受版控的站點檔案」。
#
# 用法
#   ./tools/verify_live.sh                              # 驗正式站
#   BASE=http://127.0.0.1:8080 ./tools/verify_live.sh   # 驗本機預覽
#
# ★ 排版注意：變數一律寫成 ${var}。訊息裡緊接著全形標點時，`$c（` 會被 bash
#   當成變數名 `c（` 而報 unbound variable——在同一專案上實際踩過。
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BASE:-https://solve-lab.cn}"
PASS=0; FAIL=0

# ★ case 的樣式是 glob，不是正則——`^(a|b)$` 在這裡不成立（^ $ 會被當字面字元），
#   必須用真正的 glob 寫法。排除兩類：① 版控雜項與開發工具，② 不該公開的內部文件
#   （② 改由第六節正面檢查它們「必須 404」，否則排除就等於放行）。
INTERNAL_DOCS="SITES.md MIGRATION.md DEPLOY.md TENCENT-CLOUD.md"

is_internal() {
  case "${1}" in
    .git|.git/*|.github|.github/*) return 0 ;;
    .gitignore|.gitattributes) return 0 ;;   # 版控雜項，非站點內容
    tools|tools/*) return 0 ;;               # 開發工具（驗收腳本本身也在內），非站點內容
    SITES.md|MIGRATION.md|DEPLOY.md|TENCENT-CLOUD.md) return 0 ;;
    *) return 1 ;;
  esac
}

# 取狀態碼。★ 不要寫成 `curl … || echo 000`：curl 失敗時 -w 已經印了 000，
#   `||` 再接一個 000 ⇒ 變成「000000」，訊息會出現「線上回 000000」這種鬼東西（實測踩到）。
code() {
  local c
  c=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "${1}" 2>/dev/null) || true
  case "${c}" in ''|000) printf '000' ;; *) printf '%s' "${c}" ;; esac
}
body()   { curl -s -m 20 "${1}" 2>/dev/null || true; }
md5f()   { local s; if command -v md5 >/dev/null 2>&1; then md5 -q "${1}"; else s=$(md5sum "${1}"); echo "${s%% *}"; fi; }
md5url() { local t; t=$(mktemp); if curl -s -m 30 -o "${t}" "${1}" 2>/dev/null; then md5f "${t}"; fi; rm -f "${t}"; }

# 逐位元比對「倉庫檔 vs 線上檔」。不同就重抓一次再判——
# 實測遇過一次單檔誤報：首次抓取拿回不完整內容，重跑即恢復一致。
# 沒有這個重試，閘門會偶發假警報，久了就沒人相信它。
same_file() {  # <倉庫相對路徑>；0 = 相同
  local f="${1}" want got i
  want=$(md5f "${ROOT}/${f}")
  for i in 1 2; do
    got=$(md5url "${BASE}/${f}")
    if [ -n "${got}" ] && [ "${got}" = "${want}" ]; then return 0; fi
  done
  return 1
}

ok() { PASS=$((PASS + 1)); printf '  \033[32m✓\033[0m %s\n' "${1}"; }
no() { FAIL=$((FAIL + 1)); printf '  \033[31m✗\033[0m %s\n' "${1}"; }

expect_code() {  # <路徑> <期望碼> <說明>
  local c; c=$(code "${BASE}${1}")
  if [ "${c}" = "${2}" ]; then ok "${3} —— ${1} → ${c}"; else no "${3} —— ${1} → ${c}，期望 ${2}"; fi
}

expect_has() {   # <路徑> <關鍵字> <說明>
  # ★ 不要寫成 printf … | grep -q：命中即關閉管線，仍在寫入的 printf 收 SIGPIPE(141)，
  #   pipefail 讓整條管線判為失敗 ⇒ 明明找到卻報找不到。改用 bash 內建字面比對。
  local b; b=$(body "${BASE}${1}")
  case "${b}" in
    *"${2}"*) ok "${3}" ;;
    *)        no "${3} —— ${1} 找不到「${2}」" ;;
  esac
}

echo "驗收目標：${BASE}"
echo "倉庫根目錄：${ROOT}"
echo
echo "── 一、站點與主要頁面完好"
expect_code / 200 "首頁"
expect_has  / "解决问题训练站" "首頁品牌正確"
expect_code /lessons.html 200 "課件索引"
expect_code /chapters.html 200 "章節索引"
expect_code /drills.html 200 "練習"
expect_code /quiz.html 200 "自測"
expect_code /progress.html 200 "進度"
expect_code /partner.html 200 "找陪練"
expect_code /contributors.html 200 "共建者"
expect_code /contact.html 200 "聯絡"
expect_code /practice.html 200 "實踐"
expect_code /references.html 200 "延伸閱讀"
expect_code /errors.html 200 "糾錯"
expect_code /inquiry.html 200 "提問"
expect_code /assets/style.css 200 "樣式表"
expect_code /sitemap.xml 200 "站點地圖"
expect_code /favicon.ico 200 "網站圖標"

echo
echo "── 二、備案號（法定必須顯示：ICP 號 + 公安號 + 公安圖標）"
expect_has  /assets/data.js "蜀ICP备2026055920号-1" "ICP 備案號（工信部）"
expect_has  /assets/data.js "川公网安备51018102000885号" "公安聯網備案號"
expect_has  /assets/app.js "beian.miit.gov.cn" "工信部查詢連結"
expect_has  /assets/app.js "beian.mps.gov.cn/#/query/webSearch?code=" "公安備案查詢連結"
expect_code /assets/ghs.png 200 "公安備案圖標"

echo
echo "── 三、本地與線上逐位元一致（同步判定的核心）"
SAME=0; BAD=0; BADLIST=""
while IFS= read -r f; do
  if is_internal "${f}"; then continue; fi
  # 直接用 same_file（不同會重抓一次）判斷，避免一次網路抖動就誤報未同步
  if same_file "${f}"; then
    SAME=$((SAME + 1)); continue
  fi
  c=$(code "${BASE}/${f}")
  if [ "${c}" != "200" ]; then
    no "${f} —— 線上回 ${c}（本地有、線上取不到）"
  else
    no "${f} —— 線上與本地不同（此檔未同步）"
  fi
  BAD=$((BAD + 1)); BADLIST="${BADLIST} ${f}"
done < <(cd "${ROOT}" && git ls-files)
if [ "${BAD}" = 0 ]; then ok "全部 ${SAME} 個站點檔案與線上逐位元一致"; fi

echo
echo "── 四、GitHub 四條共建入口仍在（改版時最容易被弄丟）"
for t in 01-find-partner.yml 02-be-coach.yml 03-duel.yml 04-submit-sheet.yml; do
  expect_has /partner.html "${t}" "入口範本 ${t}"
done

echo
echo "── 五、另一站未受影響"
c=$(code https://shenglv.org.cn/)
if [ "${c}" = "200" ]; then ok "中文聲韻站 —— shenglv.org.cn → ${c}"; else no "中文聲韻站 —— shenglv.org.cn → ${c}"; fi

echo
echo "── 六、內部文件不得出現在網站上（留在本機與倉庫即可）"
# 起因：倉庫根目錄 = 網站根目錄，任何放在根目錄的檔案都會被公開。
# 2026-09 曾因此把暨南大學外聯材料公開在 GitHub；同一個坑在網站端也存在——
# 這幾份是寫給自己看的（主機、桶名、帳號 ID、備案過程），不是給訪客看的。
LEAK=0
for d in ${INTERNAL_DOCS}; do
  c=$(code "${BASE}/${d}")
  if [ "${c}" = "200" ]; then
    no "${d} —— 線上仍可讀取（HTTP 200），應自伺服器刪除"; LEAK=$((LEAK + 1))
  else
    ok "${d} —— 線上 → ${c}（未公開）"
  fi
done

echo
echo "════════════════════════════════"
if [ "${FAIL}" = 0 ]; then
  echo "結果：${PASS} 項全數通過 —— 線上就是本倉庫的內容。"
  exit 0
fi
echo "結果：${PASS} 項通過 / ${FAIL} 項未過。"
if [ "${BAD}" != 0 ]; then
  echo
  echo "第三節有 ${BAD} 個檔案未同步。要上傳的就是這些（倉庫根目錄 → 網站根目錄，相對路徑不變）："
  for f in ${BADLIST}; do echo "  ${f}"; done
fi
if [ "${LEAK}" != 0 ]; then
  echo
  echo "第六節：有 ${LEAK} 份內部文件仍掛在網站上，請自伺服器刪除（它們不是站點內容，刪掉不影響任何頁面，"
  echo "        站內沒有任何連結指向它們，sitemap 也沒收錄）。"
fi
echo "若是 git checkout 型主機：cd 站點根目錄 && git pull"
exit 1
