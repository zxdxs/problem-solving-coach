# 全部網站 · 索引與更新方式

兩個站的倉庫、建置指令、部署方式與文件位置。**這是總表；各站細節見其自身文件。**

---

## 一、兩個站

| 站 | 網址 | 備案 | 狀態 |
|---|---|---|---|
| 問題解決訓練站 | https://solve-lab.cn/ | 蜀ICP备2026055920号-1 | 已上線 |
| 中文聲韻 | https://shenglv.org.cn/ | 蜀ICP备2026055920号-2 | 已上線 |

> **方言站已於 2026-10-03 併入「中文聲韻」**，不再是獨立站點。原 `shenglv.org.cn/fangyan/`
> **從未上線過**（一直 404），故廢除它不產生任何外部死鏈。
> 粵語降為方言切換器中的一個點，與普通話、四川話 6 點、吳語 2 點、閩南語 6 點並列。

> 備案主體為「中文声韵」，服務負責人同一位；同一主體下的多個域名共用主號、以 `-N` 區分。
> **備案號必須顯示在網站底部並連結 https://beian.miit.gov.cn/**（法定義務）。

---

## 二、文件在哪

### 問題解決訓練站（`solve-lab.cn`）
倉庫：`problem-solving-coach/`（GitHub `zxdxs/problem-solving-coach`）

| 文件 | 內容 | 狀態 |
|---|---|---|
| `README.md` | 使用說明、目錄結構、怎麼改內容、**目前部署方式** | ✅ 最新 |
| `DEPLOY.md` | 「今晚 30 分鐘上線清單」 | ⚠️ **過期**：講的是 Vercel，實際已不用 |
| `TENCENT-CLOUD.md` | 騰訊雲 COS 部署清單 | ⚠️ **過期**：講的是 COS 成都，實際已不用 |
| `MIGRATION.md`、`SHENGLV-*.md` | 內部工作文件 | 未納入版控（含真實姓名與備案細節） |

**實際架構**（實測）：EdgeOne（`Server: edgeone makers`）＋ GitHub Pages 雙 origin，同一域名。
`README.md` 已於 `0f9cc48` 更正為此；唯 `DEPLOY.md`／`TENCENT-CLOUD.md` 兩份未同步更新。

### 中文聲韻（`shenglv.org.cn`）
倉庫：`shenglv-site-repo/`（GitHub `zxdxs/shenglv`）

| 文件 | 內容 |
|---|---|
| `tools/README.md` | **產線腳本與自檢**（建置、分工表、precheck、render_test、live_check） |

⚠️ **缺部署文件**：實際部署方式（Caddy 服務於備案雲資源 `123.206.124.48`，站點根目錄待確認）
**未見於任何文件**。另倉庫根目錄無 `README.md`。

### 方言資料產線（已併入「中文聲韻」）
倉庫：`sichuan-pilot/`（產出物寫進 `shenglv-site-repo/`）

| 文件 | 內容 |
|---|---|
| `README.md` | 5 語族 16 點的現況、覆蓋率、入聲四命運 |
| `INTEGRATION.md` | 與主站的整合沿革、線上現況稽核、Caddy 片段 |
| `NOTICE.md` | 各來源的授權與我方改動聲明 |
| `授權說明.md` | 授權摘要 |
| `build.sh` | 全量建置（固定五步順序，逐步檢查 exit code） |
| `build_unified.py` | **單一出站**：寫入主站倉庫（assets／data／shengyun.html 入聲段） |
| `deploy.sh` | 驗證＋提交＋推送（不搬檔案）；含新鮮度與殘留連結閘門 |
| `build_report_rusheng.md` | 入聲歸調的全量實測報告（515 韻、1174 字） |
| `qingzhuo.py` | 中古聲母→清濁、入聲聚合、置換檢定、站上文案（單一實作） |
| `build_sichuan_site.py` | **已退役為零件庫**（`POINTS` ＋ `render_rusheng`）；`main()` 會拒絕執行 |
| `patches/` | 主站導覽補丁（歷史檔，`*.live.patch` 為當時的部署補丁） |

---

## 三、怎麼更新

### 問題解決訓練站
```bash
cd problem-solving-coach
# 內容改動直接改 HTML / assets；題庫由 JSON 重建：
python3 <產線目錄>/build_data.py --check --site . --json . --blocks <blocks 目錄>
# 上站：push 到 GitHub，EdgeOne 與 GitHub Pages 兩邊都要更新
git add <明確檔案> && git commit && git push
```
⚠️ 切勿 `git add -A`——本目錄含未納入版控的內部文件。

### 中文聲韻
```bash
cd shenglv-site-repo
python3 tools/build_shenglv.py --site . --gd <語料目錄> --dict <dict.yaml>
python3 tools/build_registry.py          # 分工表
python3 tools/precheck.py                # 上站前自檢
node tools/render_test.js                # 無瀏覽器渲染測試
# 上站：Caddy 服務的目錄（部署方式待補文件）
```

### 方言資料（併入「中文聲韻」的那一份）
```bash
cd sichuan-pilot
./build.sh                      # 全量建置（順序固定，見腳本註解）
# 預覽就用主站倉庫本身：
python3 -m http.server 8794 --directory ../shenglv-site-repo
./deploy.sh                     # 驗證（dry-run）
./deploy.sh --go                # 提交並推送
```

`build.sh` 的五步順序不可調換：
`build_sichuan`（產 `_work/meta.json`）→ `build_dialects` → `build_mandarin`
→ `analyze_rusheng`（產 `_work/rusheng.json`）→ `build_unified`（寫入主站倉庫）。

**產出直接寫進 `shenglv-site-repo/` 根目錄**（不再有 pilot 自己的 `site/`）：
`assets/fangyan-meta.js`、`assets/fangyan.js`、`data/upstream*/`，以及
`shengyun.html` 的入聲段。

`deploy.sh` 不搬檔案，只驗證與提交；它會擋下三種情況：
產生檔缺失／比 `rusheng.json` 舊、`fangyan/` 目錄或連結殘留、
`shengyun.html` 缺 RUSHENG 標記。

### 方言切換器的三處程式碼（都在主站倉庫，人工維護）
| 檔案 | 角色 |
|---|---|
| `assets/app.js` | 兩級切換器、`readOf/readAt` 逐點讀音、`renderShengyun`、`renderFamGrid` |
| `quanben.html` | 全本頁，含 `<div id="ptBar">` 與 `assets/fangyan-meta.js` |
| `shengyun.html` | 聲韻入門；**唯一**預載 `assets/fangyan.js` 的頁面 |
| `tools/render_test.js` | 依頁面自己的 `<script src>` 載入，並跑 `?pt=chengdu` 換音閘門 |

---

## 四、通則（兩站共用的硬規矩）

1. **備案號必須顯示**：頁腳顯示完整號碼（含 `-N`）並連結工信部。
2. **提交前指定路徑，不用 `git add -A`**：各目錄都有未納入版控的內部文件，
   一律 `git add <file>`，並在推送前核對 `git show --stat`。
3. **不散布無明確授權的資料**；隨附上游來源與授權全文（GPL-3.0 之要求）。
4. **對外宣稱要有實測依據**；自檢門檻不得放空（空集合不得冒充通過）。
5. **雙 origin 要同時更新**（適用 psc）：頁腳版本號為判據。

---

## 五、待補的文件缺口

- [ ] `DEPLOY.md`／`TENCENT-CLOUD.md` 已過期（Vercel／COS），應改寫或標為歷史文件
- [ ] `shenglv` 缺部署文件（Caddy 站點根目錄、更新流程、回退方式）
- [ ] `shenglv` 倉庫無根目錄 `README.md`
- [x] 部署模型已釐清：`shenglv-site-repo/` 即線上內容；方言站**已併入主站**（`f807d15`）
- [ ] `/fangyan/` 從未上線，之後也不必再做 404 轉址
- [ ] 線上仍待同步：GitHub 推送不會自動部署，需在 CVM 上更新站點根目錄
