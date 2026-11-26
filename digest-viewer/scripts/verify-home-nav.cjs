/* 首页导航专项回归：四个视图 → 首页 全链路 + 品牌链接 + 同页回顶 */
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

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (m) => { const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) { const [ok, err] = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? err(new Error(msg.error.message)) : ok(msg.result); } }); }
  send(method, params = {}) { return new Promise((ok, err) => { const id = ++this.id; this.pending.set(id, [ok, err]); this.ws.send(JSON.stringify({ id, method, params })); }); }
}

(async () => {
  rmSafe(PROFILE);
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "--window-size=1280,1200", "about:blank"], { stdio: "ignore" });
  let failures = 0;
  const check = (name, ok, detail = "") => { console.log((ok ? "PASS" : "FAIL") + "  " + name + (ok ? "" : "  [" + detail + "]")); if (!ok) failures++; };

  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { try { await getJSON(`http://127.0.0.1:${PORT}/json/version`); up = true; } catch { await sleep(250); } }
    const targets = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
    const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((ok, err) => { ws.onopen = ok; ws.onerror = err; });
    const cdp = new CDP(ws);
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");

    const evalJS = async (expr) => {
      const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true });
      if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception?.description || "").slice(0, 200));
      return r.result.value;
    };
    const wait = async (expr, label, timeoutMs = 20000) => {
      const t0 = Date.now();
      for (;;) {
        try { if (await evalJS(expr)) return true; } catch {}
        if (Date.now() - t0 > timeoutMs) throw new Error("timeout: " + label);
        await sleep(120);
      }
    };
    const clickTab = async (label) => {
      await evalJS(`[...document.querySelectorAll(".view-tabs__btn")].find(b => b.textContent.trim().includes("${label}"))?.click()`);
      await sleep(450);
    };
    const state = () => evalJS(`(() => ({
      hash: location.hash || "(empty)",
      landing: document.body.innerText.includes("把散落的技术情报"),
      entries: !!document.querySelector(".filter-bar"),
      md: location.hash.startsWith("#markdown"),
      about: location.hash === "#about",
      activeTab: document.querySelector(".view-tabs__btn--active")?.textContent.trim() || "(none)",
      scrollTop: Math.round(window.scrollY),
      tabs: [...document.querySelectorAll(".view-tabs__btn")].map(b => b.textContent.trim()).join("/"),
    }))()`);

    // ① 落地页初始态：四 tab 齐全，首页高亮
    await cdp.send("Page.navigate", { url: BASE });
    await wait(`document.body.innerText.includes("把散落的技术情报") && !!document.querySelector(".site-nav .view-tabs__btn")`, "landing");
    let s = await state();
    check(`① 落地页含四项导航（${s.tabs}）`, s.tabs === "首页/条目浏览/Markdown 原文/关于", s.tabs);
    check("① 落地页「首页」tab 高亮", s.activeTab === "首页", s.activeTab);

    // ② 落地页点「首页」→ 保持落地页 + 平滑回顶（不允许无反应，也不允许报错）
    await evalJS(`window.scrollTo(0, 900)`);
    await sleep(300);
    await clickTab("首页");
    s = await state();
    check(`② 落地页点「首页」仍为落地页（hash=${s.hash}）`, s.landing && !s.entries, JSON.stringify(s));
    // 平滑滚动需要时间，轮询等待回顶完成
    const tabScrolled = await wait(`Math.round(window.scrollY) < 120`, "tab smooth scroll top", 3000);
    const tabScrollY = await evalJS(`Math.round(window.scrollY)`);
    check(`② 点「首页」后平滑回顶（scrollY=${tabScrollY}）`, tabScrolled, String(tabScrollY));
    // Ⅱb 落地页滚下去点品牌 logo → 同样应回顶（修复「视觉无反应」）
    await evalJS(`window.scrollTo(0, 900)`);
    await sleep(300);
    await evalJS(`document.querySelector(".site-nav .hero__brand")?.click()`);
    await sleep(900);
    const brandScroll = await evalJS(`Math.round(window.scrollY)`);
    check(`②b 落地页点品牌 logo 回顶（scrollY=${brandScroll}）`, brandScroll < 120, String(brandScroll));

    // ③ 落地页 → 条目浏览 → 点「首页」→ 回落地页（用户报告的核心场景）
    await clickTab("条目浏览");
    await wait(`!!document.querySelector(".filter-bar")`, "entries");
    await evalJS(`window.scrollTo(0, 1200)`);
    await sleep(300);
    await clickTab("首页");
    await wait(`document.body.innerText.includes("把散落的技术情报")`, "back to landing from entries");
    s = await state();
    check("③ 数据站点「首页」回落地页", s.landing && s.activeTab === "首页", JSON.stringify(s));
    check(`③ 回落后滚回顶部（scrollY=${s.scrollTop}）`, s.scrollTop < 50, String(s.scrollTop));

    // ④ 数据站品牌 logo 点击 = 首页
    await clickTab("条目浏览");
    await wait(`!!document.querySelector(".filter-bar")`, "entries again");
    await evalJS(`document.querySelector(".site-nav .hero__brand")?.click()`);
    await wait(`document.body.innerText.includes("把散落的技术情报")`, "brand -> landing");
    check("④ 品牌 logo 点击回首页", await evalJS(`document.body.innerText.includes("把散落的技术情报")`));

    // ⑤ about / markdown 视图点「首页」
    await clickTab("关于");
    await wait(`location.hash === "#about"`, "about");
    await clickTab("首页");
    await wait(`document.body.innerText.includes("把散落的技术情报")`, "about -> landing");
    check("⑤ 关于页点「首页」回落地页", await evalJS(`document.body.innerText.includes("把散落的技术情报")`));

    await clickTab("Markdown 原文");
    await wait(`location.hash.startsWith("#markdown")`, "markdown");
    await clickTab("首页");
    await wait(`document.body.innerText.includes("把散落的技术情报")`, "markdown -> landing");
    check("⑤ Markdown 页点「首页」回落地页", await evalJS(`document.body.innerText.includes("把散落的技术情报")`));

    // ⑥ 直达 URL hash=#/ 
    await cdp.send("Page.navigate", { url: BASE + "#/" });
    await sleep(600);
    s = await state();
    check(`⑥ 直开 #/ 为落地页（active=${s.activeTab}）`, s.landing && s.activeTab === "首页", JSON.stringify(s));

    // ⑦ 浏览器后退键（#entries → #/）也回首页
    await clickTab("条目浏览");
    await wait(`!!document.querySelector(".filter-bar")`, "entries 3rd");
    await cdp.send("Page.navigate", { url: BASE + "#/" });
    await sleep(500);
    check("⑦ hash 直变 #/ 回落地页", await evalJS(`document.body.innerText.includes("把散落的技术情报")`));

    console.log(failures === 0 ? "\nALL HOME-NAV CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
    ws.close();
  } catch (e) {
    console.error("SMOKE ERROR:", e.message);
    failures++;
  } finally {
    chrome.kill();
    await sleep(800);
    rmSafe(PROFILE);
  }
  process.exit(failures === 0 ? 0 : 1);
})();
