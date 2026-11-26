/* 响应式验证：横向溢出 / 日历触达 / 筛选栏换行 / 列表单列 */
const http = require("http");
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
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "--window-size=1280,1500", "about:blank"], { stdio: "ignore" });
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
    const wait = async (expr, label, timeoutMs = 25000) => {
      const t0 = Date.now();
      for (;;) {
        try { if (await evalJS(expr)) return; } catch {}
        if (Date.now() - t0 > timeoutMs) throw new Error("timeout: " + label);
        await sleep(150);
      }
    };
    const setViewport = async (w, h) => {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    };
    const overflowCheck = () => evalJS(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);

    const audits = [];

    // 桌面 1280
    await setViewport(1280, 900);
    await cdp.send("Page.navigate", { url: BASE + "#entries" });
    await wait(`!!document.querySelector(".card--list")`, "entries desktop");
    audits.push(["桌面 1280px 无横向溢出", await overflowCheck()]);
    audits.push(["桌面 日历格 ≥ 26px 触达", await evalJS(`document.querySelector(".cal-day-btn").getBoundingClientRect().width >= 26`)]);

    // 平板 768
    await setViewport(768, 1024);
    await sleep(500);
    audits.push(["平板 768px 无横向溢出", await overflowCheck()]);

    // 手机 375
    await setViewport(375, 812);
    await sleep(600);
    audits.push(["手机 375px 无横向溢出", await overflowCheck()]);
    audits.push(["手机 日历格 ≥ 30px 触达", await evalJS(`document.querySelector(".cal-day-btn").getBoundingClientRect().width >= 30`)]);
    const mobileList = await evalJS(`(() => {
      const card = document.querySelector(".card--list");
      const cols = getComputedStyle(card).gridTemplateColumns.split(" ").length;
      const side = card.querySelector(".card__list-side");
      const dir = side ? getComputedStyle(side).flexDirection : null;
      const hero = document.querySelector(".site-nav");
      const heroSticky = hero ? getComputedStyle(hero).position : null;
      return { cols, dir, heroSticky };
    })()`);
    audits.push(["手机 列表单列布局", mobileList.cols === 1 ? 0 : 1]);
    audits.push(["手机 侧栏转横排", mobileList.dir === "row" ? 0 : 1]);
    audits.push(["手机 hero 保持 sticky", mobileList.heroSticky === "sticky" ? 0 : 1]);

    // 手机筛选栏换行可用
    audits.push(["手机 筛选栏可见", await evalJS(`(() => { const fb = document.querySelector(".filter-bar"); const r = fb.getBoundingClientRect(); return r.height > 40 && r.width > 200; })()`)]);

    // 落地页手机
    await cdp.send("Page.navigate", { url: BASE });
    await wait(`document.body.innerText.includes("进入数据站")`, "landing mobile");
    audits.push(["手机 落地页无横向溢出", await overflowCheck()]);

    const shot = async (name) => {
      const s = await cdp.send("Page.captureScreenshot", { format: "png" });
      const fs = require("fs");
      fs.writeFileSync(__dirname + "/" + name + ".png", Buffer.from(s.data, "base64"));
    };

    await cdp.send("Page.navigate", { url: BASE + "#entries" });
    await wait(`!!document.querySelector(".card--list")`, "entries mobile again");
    await sleep(400);
    await shot("verify-6-mobile-entries");
    await cdp.send("Page.navigate", { url: BASE });
    await wait(`document.body.innerText.includes("进入数据站")`, "landing mobile 2");
    await sleep(400);
    await shot("verify-7-mobile-landing");

    for (const [name, val] of audits) {
      const ok = val === 0 || val === true;
      check(`${name}${typeof val === "number" && val > 0 ? ` (超出 ${val}px)` : ""}`, ok, String(val));
    }
    console.log("DONE mobile screenshots -> verify-6/7 .png");
    ws.close();
  } catch (e) {
    console.error("SMOKE ERROR:", e.message);
    failures++;
  } finally {
    chrome.kill();
    await sleep(800);
    rmSafe(PROFILE);
  }
  console.log(failures === 0 ? "\nALL RESPONSIVE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
