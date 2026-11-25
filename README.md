# tech-digest

多源技术情报抓取 + AI 汇总，并发布为 GitHub Pages 周报站与 RSS 订阅源。

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
