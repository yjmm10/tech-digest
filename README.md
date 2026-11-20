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
| `GITHUB_TOKEN` / `GH_TOKEN` | GitHub 检索 enrich（CI 内置） |
| `SMTP_SERVER` / `EMAIL_USER` / `EMAIL_PASS` / `RECIPIENT_EMAIL` | 邮件通知（可选） |
| `WEBHOOK_URL` | 群机器人通知（可选） |

完整样例见 [`.env.example`](.env.example)。CI 中密钥通过 `${{ secrets.* }}` 注入 `env`，不会进入源代码或构建产物。

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
