# tech-digest

多源技术情报抓取 + AI 汇总，并发布为 GitHub Pages 周报站与 RSS 订阅源。

**线上站点**：<https://yjmm10.github.io/tech-digest/> · **RSS**：<https://yjmm10.github.io/tech-digest/feed.xml>

## 产品预览

每周五定时抓取 arXiv / Semantic Scholar / OpenAlex / GitHub Trending / GitHub 检索 / RSS 六类公开信息源，GLM 生成中文摘要与相关性评分，三级去重后按 Schema v1 归档；前端提供落地页、条目检索、日历回溯、瀑布流浏览与 Markdown 周报阅读，支持深浅双主题。

**落地页（开源项目介绍 + 动态视觉，深色 / 浅色双主题）**

![落地页 · 深色](docs/screenshots/landing-dark.png)

![落地页 · 浅色](docs/screenshots/landing-light.png)

**数据站：日历回溯 + 多维筛选（来源 / 评分 / 时间窗 / 关键词）**

![数据站](docs/screenshots/entries-dark.png)

**瀑布流布局（纯 CSS 多列，客户端增量渲染）**

![瀑布流布局](docs/screenshots/waterfall-dark.png)

**Markdown 周报原文阅读**

![Markdown 周报](docs/screenshots/markdown-dark.png)

**关于页**

![关于页](docs/screenshots/about-dark.png)

## 产品能力

| 能力 | 说明 |
| --- | --- |
| 六源统一调度 | arXiv、Semantic Scholar、OpenAlex、GitHub Trending / 检索与 RSS 订阅源共用关键词与时间窗配置，一次运行全量覆盖 |
| AI 摘要与评分 | GLM 大模型生成中文摘要与 0–10 相关性评分，主模型异常自动切换备用网关 |
| 三级去重清洗 | 同期次、单期内、跨期按链接三级去重，跨期保留最早记录，归档条目唯一可溯 |
| 多维检索回溯 | 关键词、来源、评分、时间窗与日历组合筛选，数据一次加载、全量客户端完成 |
| Schema v1 结构化归档 | 每期独立 JSON 落盘（含 Markdown 原文与元数据），历史可恢复、可迁移 |
| 自动发布与订阅 | CI 自动构建 GitHub Pages 档案站并生成 RSS 源，抓取完成即上线 |

## 项目结构

| 路径 | 职责 |
| --- | --- |
| `main.py` | 主入口：拉取各信息源、调用 AI 生成周报、写归档、可选通知 |
| `digest_config.yaml` | 业务配置：关键词、时间窗、各信息源、AI 模型与回退模型 |
| `digest_sources/` | 信息源实现：arXiv、Semantic Scholar、OpenAlex、RSS、GitHub Trending / 检索 |
| `digest_export/` | 数据模型与落盘：`data/runs/*.json`（Schema v1）、`data/index.json` |
| `digest-viewer/` | React + Vite 前端：一次加载 JSON，客户端筛选 / 日历 / Markdown 阅读 / RSS |
| `.github/workflows/` | `weekly-digest.yml` 定时抓取发布；`digest-site.yml` 仅前端变更时重建站点 |

## 分支与发布流程

- `master`：`python -m digest_export.migrate` 生成归档，前端从 `data/runs/*.json` 构建 `public/viewer-data.json` 与 `public/feed.xml`。
- `gh-pages`：站点静态文件 + 历史周报 JSON 归档，由 CI 自动发布（历史数据从此分支恢复）。
- 线上地址：<https://yjmm10.github.io/tech-digest/>
- RSS 订阅：<https://yjmm10.github.io/tech-digest/feed.xml>

## 配置与密钥

业务配置改 `digest_config.yaml`；密钥只走环境变量或 GitHub Repository Secrets，切勿写入仓库：

| 变量 | 用途 |
| --- | --- |
| `ZHIPU_API_KEY` / `OPENAI_API_KEY` | 主网关密钥（智谱 Coding Plan 用前者） |
| `OPENAI_API_BASE` | OpenAI 兼容网关地址 |
| `MINIMAX_API_KEY` / `MINIMAX_API_BASE` | 主模型失败时的备用网关 |
| `SEMANTIC_SCHOLAR_API_KEY` / `OPENALEX_API_KEY` | 学术检索配额提升（可选） |
| `ARXIV_API_BASE` / `ARXIV_PROXY_TOKEN` | arXiv 反代地址与令牌（可选，Actions 被限流时必配，见下文） |
| `GITHUB_TOKEN` / `GH_TOKEN` | GitHub 检索 enrich（CI 内置） |
| `SMTP_SERVER` / `EMAIL_USER` / `EMAIL_PASS` / `RECIPIENT_EMAIL` | 邮件通知（可选） |
| `WEBHOOK_URL` | 群机器人通知（可选） |

完整样例见 [`.env.example`](.env.example)。CI 中密钥通过 `${{ secrets.* }}` 注入 `env`，不会进入源代码或构建产物。

## arXiv 被 429 限流怎么办

`export.arxiv.org` 对 GitHub Actions 等云平台共享出口 IP 实施严格限流（HTTP 429），
表现为 CI 里 arXiv 环节稳定失败或返回 0 条，本地却正常。解决办法是给 arXiv 请求换出口 IP：

1. 用 Cloudflare Worker 部署官方 API 反代：源码见 [`deploy/arxiv-proxy.worker.js`](deploy/arxiv-proxy.worker.js)，
   文件头注释含部署步骤（Dashboard 粘贴或 `npx wrangler deploy` 均可，免费额度足够）。
2. 仓库 Settings → Secrets and variables → Actions → **Variables** 新增
   `ARXIV_API_BASE = https://<worker 地址>`；若 worker 开启了 `PROXY_TOKEN` 校验，
   再在 **Secrets** 新增 `ARXIV_PROXY_TOKEN`。
3. 无需改代码：`digest_sources/arxiv.py` 会自动读取 `ARXIV_API_BASE`，
   api / library 双后端都会走代理；未配置时仍直连官方地址。

代码侧已附带三重保护：可识别的 User-Agent、429/5xx 指数退避重试、
首选后端返回 0 条时自动用备用后端交叉验证，避免静默空结果。

## 本地运行

```bash
pip install -r requirements.txt
cp .env.example .env   # 填入密钥，.env 已被 .gitignore 忽略
python main.py

cd digest-viewer
npm ci
npm run dev
```

前端构建时由 `VITE_BASE` 决定站点子路径，CI 固定为 `/tech-digest/`；本地覆盖见 [`digest-viewer/.env.example`](digest-viewer/.env.example)。

更多前端细节见 [`digest-viewer/README.md`](digest-viewer/README.md)。
