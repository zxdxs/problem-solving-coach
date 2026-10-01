# 全部網站 · 索引與更新方式

三個站的倉庫、建置指令、部署方式與文件位置。**這是總表；各站細節見其自身文件。**

---

## 一、三個站

| 站 | 網址 | 備案 | 狀態 |
|---|---|---|---|
| 問題解決訓練站 | https://solve-lab.cn/ | 蜀ICP备2026055920号-1 | 已上線 |
| 中文聲韻 | https://shenglv.org.cn/ | 蜀ICP备2026055920号-2 | 已上線 |
| 聲律發蒙 · 方言導讀（試作） | 待部署至 `shenglv.org.cn/fangyan/` | 同上（同域名） | 未上線 |

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

### 聲律發蒙 · 方言導讀（試作）
倉庫：`sichuan-pilot/`

| 文件 | 內容 |
|---|---|
| `README.md` | 四語族 15 點的現況、覆蓋率、入聲四命運、產線三步 |
| `INTEGRATION.md` | 與主站的整合、線上現況稽核、NAV 補丁、部署方案、Caddy 片段 |
| `NOTICE.md` | 各來源的授權與我方改動聲明 |
| `授權說明.md` | 授權摘要 |
| `deploy.sh` | 部署腳本（預設 dry-run） |
| `patches/` | 主站導覽補丁（`*.live.patch` 為部署用） |

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

### 方言導讀（試作）
```bash
cd sichuan-pilot
python3 build_sichuan.py        # 四川話 6 點（字典＋方案規則）
python3 build_dialects.py       # 吳語 2 點、閩南語 6 點
python3 build_mandarin.py       # 普通話（基準線）
python3 build_sichuan_site.py   # 產生 site/assets/*
# 預覽
python3 -m http.server 8794 --directory site
# 部署（先方言站、驗證 200、才動主站導覽）
SSH_TARGET=<user@host> WEB_ROOT=<站點根> ./deploy.sh --go
```

---

## 四、通則（三站共用的硬規矩）

1. **備案號必須顯示**：頁腳顯示完整號碼（含 `-N`）並連結工信部。
2. **提交前指定路徑，不用 `git add -A`**：三個目錄都有未納入版控的內部文件，
   一律 `git add <file>`，並在推送前核對 `git show --stat`。
3. **不散布無明確授權的資料**；隨附上游來源與授權全文（GPL-3.0 之要求）。
4. **對外宣稱要有實測依據**；自檢門檻不得放空（空集合不得冒充通過）。
5. **雙 origin 要同時更新**（適用 psc）：頁腳版本號為判據。

---

## 五、待補的文件缺口

- [ ] `DEPLOY.md`／`TENCENT-CLOUD.md` 已過期（Vercel／COS），應改寫或標為歷史文件
- [ ] `shenglv` 缺部署文件（Caddy 站點根目錄、更新流程、回退方式）
- [ ] `shenglv` 倉庫無根目錄 `README.md`
- [ ] 本表的「站點根目錄」等值待補（需伺服器存取權）
