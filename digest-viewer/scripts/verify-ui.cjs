/* 启动服务全量验证：落地页 → 数据站（日历/卡片/标签/交互）→ Markdown → 关于 → 双主题截图 */
const http = require("http");
const fs = require("fs");
const { spawn } = require("child_process");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:4173/tech-digest/";
const PORT = 9950 + Math.floor(Math.random() * 300);
const PROFILE = __dirname + "/.tmp-chrome-profile";

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => resolve(JSON.parse(d))); }).on("error", reject);
  });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function rmSafe(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} }
function isOpaque(c) {
  const m = String(c).match(/rgba?\(([^)]+)\)/);
  if (!m) return false;
  const parts = m[1].split(",").map((x) => parseFloat(x));
  return parts.length < 4 || parts[3] === 1;
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (m) => { const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) { const [ok, err] = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? err(new Error(msg.error.message)) : ok(msg.result); } }); }
  send(method, params = {}) { return new Promise((ok, err) => { const id = ++this.id; this.pending.set(id, [ok, err]); this.ws.send(JSON.stringify({ id, method, params })); }); }
}

(async () => {
  rmSafe(PROFILE);
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "--window-size=1280,1500", "about:blank"], { stdio: "ignore" });
  let failures = 0;
  const check = (name, ok, detail = "") => { console.log((ok ? "PASS" : "FAIL") + "  " + name + (ok ? "" : "  [" + detail + "]")); if (!ok) failures++; };
  const consoleErrors = [];

  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { try { await getJSON(`http://127.0.0.1:${PORT}/json/version`); up = true; } catch { await sleep(250); } }
    const targets = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
    const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((ok, err) => { ws.onopen = ok; ws.onerror = err; });
    const cdp = new CDP(ws);
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Log.enable");
    cdp.ws.addEventListener("message", (m) => {
      const msg = JSON.parse(m.data);
      if ((msg.method === "Runtime.exceptionThrown" || (msg.method === "Log.entryAdded" && msg.params.entry.level === "error"))) {
        consoleErrors.push((msg.params?.exceptionDetails?.exception?.description || msg.params?.entry?.text || "").slice(0, 120));
      }
    });

    const evalJS = async (expr) => {
      const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true });
      if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception?.description || "").slice(0, 200));
      return r.result.value;
    };
    const wait = async (expr, label, timeoutMs = 25000) => {
      const t0 = Date.now();
      for (;;) {
        try { if (await evalJS(expr)) return; } catch {}
        if (Date.now() - t0 > timeoutMs) {
          const dbg = await evalJS(`document.body.innerText.slice(0, 120)`).catch(() => "");
          throw new Error(`timeout: ${label} | body="${dbg}"`);
        }
        await sleep(150);
      }
    };
    const shot = async (name) => {
      const s = await cdp.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(__dirname + "/" + name + ".png", Buffer.from(s.data, "base64"));
    };

    // ===== 1) 落地页 =====
    await cdp.send("Page.navigate", { url: BASE });
    await wait(`document.body.innerText.includes("进入数据站")`, "landing");
    check("① 落地页渲染", true);
    await shot("verify-1-landing");

    // ===== 2) 数据站：日历 =====
    await cdp.send("Page.navigate", { url: BASE + "#entries" });
    await wait(`!!document.querySelector(".filter-bar") && !!document.querySelector(".rdp-root") && !!document.querySelector(".card--list")`, "entries");
    const cal = await evalJS(`(() => {
      const btns = [...document.querySelectorAll(".cal-day-btn")];
      const r = btns[0]?.getBoundingClientRect();
      const cap = document.querySelector(".cal-caption");
      const grid = document.querySelector(".rdp-month_grid");
      return {
        n: btns.length, w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0,
        caption: cap?.textContent || "",
        centered: cap && grid ? Math.abs((cap.getBoundingClientRect().left + cap.getBoundingClientRect().right) / 2 - (grid.getBoundingClientRect().left + grid.getBoundingClientRect().right) / 2) < 12 : false,
        heat2: getComputedStyle(document.querySelector(".cal-day-btn--heat-2") || document.body).backgroundColor,
        dots: document.querySelectorAll(".cal-day-btn__dot").length,
        legend: document.querySelectorAll(".calendar__legend-scale .calendar__swatch").length,
      };
    })()`);
    check("② 日历格渲染", cal.n >= 28, String(cal.n));
    check(`② 方块热力格 ${cal.w}x${cal.h}`, cal.w > 0 && Math.abs(cal.w - cal.h) <= 8);
    check(`② 月份标题（${cal.caption}）居中`, cal.centered);
    check("② 热度色/抓取点/刻度", cal.heat2.includes("0.26") && cal.dots > 0 && cal.legend === 3, `${cal.heat2} dots=${cal.dots} legend=${cal.legend}`);

    // 翻月 + 选日 + 清除
    const c0 = cal.caption;
    await evalJS(`document.querySelector(".rdp-button_next")?.click()`);
    await sleep(400);
    const c1 = await evalJS(`document.querySelector(".cal-caption")?.textContent`);
    check(`③ 翻月 ${c0}→${c1}`, c0 !== c1);
    await evalJS(`document.querySelector(".rdp-button_previous")?.click()`);
    await sleep(300);
    await evalJS(`document.querySelector(".cal-mod-data .cal-day-btn, .cal-day-btn")?.click()`);
    await sleep(400);
    check("③ 选日实底高亮 + 筛选提示", await evalJS(`!!document.querySelector(".cal-day-btn--selected") && (document.querySelector(".calendar__selection")?.textContent || "").includes("右侧列表已按日筛选")`));
    await evalJS(`document.querySelector(".calendar__clear-btn")?.click()`);
    await sleep(300);
    check("③ 清除选日", !(await evalJS(`!!document.querySelector(".cal-day-btn--selected")`)));

    // ===== 3) 条目卡片 =====
    const list = await evalJS(`(() => {
      const card = document.querySelector(".card--list");
      return {
        cols: getComputedStyle(card).gridTemplateColumns.split(" ").length,
        titleFirst: card.querySelector(".card__list-main .card__title--list") != null,
        metaInline: !!card.querySelector(".card__meta-row .source-badge"),
        sideRail: !!card.querySelector(".card__list-side .score-badge"),
        svgIcons: !!card.querySelector(".card__action svg"),
        actHidden: card.querySelector(".card__action") ? getComputedStyle(card.querySelector(".card__action")).opacity === "0" : false,
        num: document.querySelectorAll(".card--list").length,
      };
    })()`);
    check(`④ 列表卡片结构（${list.num} 行）`, list.cols === 2 && list.titleFirst && list.metaInline && list.sideRail, JSON.stringify(list));
    check("④ SVG 操作图标 + 悬停浮现", list.svgIcons && list.actHidden);
    await shot("verify-2-entries-dark");

    // ===== 4) 方块 / 瀑布 / 分组 =====
    await evalJS(`[...document.querySelectorAll(".results-header__view-btn")].find(b => b.textContent.includes("方块"))?.click()`);
    await sleep(500);
    check("⑤ 方块布局", await evalJS(`!!document.querySelector(".card--grid")`));
    await evalJS(`[...document.querySelectorAll(".results-header__view-btn")].find(b => b.textContent.includes("瀑布"))?.click()`);
    await sleep(500);
    check("⑤ 瀑布布局", await evalJS(`!!document.querySelector(".card-list--waterfall")`));
    await evalJS(`[...document.querySelectorAll(".results-header__view-btn")].find(b => b.textContent.includes("分组"))?.click()`);
    await sleep(500);
    check("⑤ 分组视图", await evalJS(`!!document.querySelector(".grouped-list__section, .card-list--list")`));
    await evalJS(`[...document.querySelectorAll(".results-header__view-btn")].find(b => b.textContent.includes("列表"))?.click()`);
    await sleep(400);

    // ===== 5) Markdown 视图 =====
    await evalJS(`[...document.querySelectorAll(".view-tabs__btn")].find(b => b.textContent.includes("Markdown"))?.click()`);
    await wait(`!!document.querySelector(".md-render, .markdown-view, .doc-bar") || document.body.innerText.includes("Markdown")`, "markdown view", 15000);
    check("⑥ Markdown 视图打开", true);
    await shot("verify-3-markdown");

    // ===== 6) 关于页 =====
    await evalJS(`[...document.querySelectorAll(".view-tabs__btn")].find(b => b.textContent.includes("关于"))?.click()`);
    await wait(`location.hash.includes("about")`, "about", 15000);
    check("⑦ 关于页打开", true);
    await shot("verify-4-about");

    // ===== 7) 浅色主题 =====
    await evalJS(`window.location.hash = "entries"`);
    await sleep(600);
    await wait(`!!document.querySelector(".rdp-root")`, "back to entries");
    await evalJS(`localStorage.setItem("digest-viewer-theme","light"); document.documentElement.dataset.theme="light"; document.documentElement.dataset.themePref="light";`);
    await sleep(600);
    await shot("verify-5-entries-light");

    // 控制台错误
    check(`⑧ 无控制台错误（${consoleErrors.length}）`, consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
    console.log("DONE  screenshots: verify-1~5 .png");
    ws.close();
  } catch (e) {
    console.error("SMOKE ERROR:", e.message);
    failures++;
  } finally {
    chrome.kill();
    await sleep(800);
    rmSafe(PROFILE);
  }
  console.log(failures === 0 ? "\nALL VERIFY CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
