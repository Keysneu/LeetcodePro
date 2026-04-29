# LeetCodePro

LeetCodePro 是一个算法训练平台 MVP，已打通题库、做题、判题、AI 诊断、AI 题解、个人笔记和进度可视化主链路。

更新时间：2026-04-29（Asia/Shanghai）

## 功能范围

已完成：
- Hot 100 中文题库，支持题目搜索、标签展示、题目详情和后台判题数据查看。
- `core` 与 `acm` 双模式提交，支持 C++ / Python 判题。
- API 写库、RabbitMQ 入队、Judge Dispatcher 消费、Docker 沙箱执行、结果回写。
- 题目页支持编辑器、运行自定义测试、正式提交、提交记录回放和失败样例对比。
- AI 找 Bug 与 AI 题解，支持 OpenAI-compatible provider、SSE 流式输出、RAG 和用户 Markdown 笔记增强。
- 进度页支持 90 天打卡热力图、标签雷达图、掌握度与待复习列表。

未完成：
- 推荐系统 V2 仍未进入 MVP。
- RAG 当前为 V1，本地知识和用户笔记可用，题库级离线向量库尚未接入。

临时验证方式：
- 推荐使用页面验证：`/problems`、`/problems/two-sum`、`/progress`、`/admin/problems`。
- 也可使用下方 `curl` 和 E2E 脚本验证核心链路。

## 技术栈

- 前端：Next.js、React、TypeScript、Tailwind CSS、Monaco Editor。
- API：NestJS、PostgreSQL、RabbitMQ。
- AI Tutor：Python、FastAPI、LangChain、LlamaIndex、OpenAI-compatible 模型接口。
- 判题：Node.js Dispatcher、Docker 沙箱、C++17 / Python 运行环境。

## 环境检查

```bash
node -v
npm -v
python3 --version
g++ --version
docker --version
docker compose version
```

要求：
- Node.js `>=20`。
- Docker Desktop 已启动。
- 任一命令显示 `command not found` 时，先安装对应工具。

## 快速启动

### 1. 进入项目

```bash
cd /Users/moem/Desktop/vibecoding/LeetcodePro
```

### 2. 初始化配置

```bash
cp .env.example .env
```

默认 `.env.example` 已包含本地开发配置。真实 AI Key 只写入本地 `.env`，不要提交。

常用 AI 配置项：

```bash
LLM_PROVIDER=vllm
AI_TUTOR_PORT=8001
AI_TUTOR_BASE_URL=http://localhost:8001
VLLM_BASE_URL=http://127.0.0.1:18100/v1
VLLM_API_KEY=your_vllm_api_key
VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
AI_CONFIG_ENCRYPTION_KEY=leetcodepro-dev-ai-config-key!!!
AI_TUTOR_RAG_ENABLED=true
ADMIN_API_KEY=leetcodepro-admin-key
```

### 3. 安装依赖

```bash
npm install
npm run setup:python
```

### 4. 启动基础设施

```bash
docker compose up -d
docker compose ps
```

### 5. 初始化数据库

```bash
npm run db:setup -w @leetcodepro/api
```

预期输出包含：

```text
database migration completed.
seed completed: 100 problems
```

### 6. 启动服务

```bash
npm run dev
```

服务地址：
- Web: `http://localhost:3000`
- API: `http://localhost:3001/api/health`
- AI Tutor: `http://localhost:8001/health`
- Judge Dispatcher: `http://localhost:8080/health`

## 功能验证

保持 `npm run dev` 运行，另开终端执行下面命令。

### 1. 健康检查

```bash
curl http://localhost:3001/api/health
curl http://localhost:8001/health
curl http://localhost:8080/health
```

预期：
- API 返回健康状态。
- AI Tutor 返回 `status=ok`、`providerKind=openai_compatible`、`ragEnabled=true`。
- Judge 返回 `status=ok`、`executionMode=docker`、`queueName=judge.submissions.v1`。

### 2. 题库接口

```bash
curl http://localhost:3001/api/problems
curl "http://localhost:3001/api/problems?q=两数"
curl http://localhost:3001/api/problems/two-sum
```

预期：
- 题库列表包含 `100` 道题。
- 搜索 `两数` 能命中 `two-sum`。
- 题目详情包含 `description`、`sampleInput`、`sampleOutput`、`acmInputSpec`、`acmSampleInput`。

### 3. 运行自定义测试

该接口同步返回结果，不写入提交记录。

```bash
curl -X POST http://localhost:3001/api/submissions/run-tests \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","language":"python","mode":"core","code":"def twoSum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        y = target - x\n        if y in seen:\n            return [seen[y], i]\n        seen[x] = i\n    return []","testCases":[{"title":"Case 1","input":"nums = [2,7,11,15], target = 9","output":"[0,1]"}]}'
```

预期：
- 返回 `item.status=AC`。
- `item.caseResults` 包含输入、期望输出、实际输出、运行时间和内存。

### 4. 正式提交

```bash
curl -X POST http://localhost:3001/api/submissions \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","language":"python","mode":"core","code":"def twoSum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        y = target - x\n        if y in seen:\n            return [seen[y], i]\n        seen[x] = i\n    return []"}'
```

复制返回的 `id`，轮询结果：

```bash
curl http://localhost:3001/api/submissions/<submission-id>
```

预期：
- 初始状态可能是 `QUEUED` 或 `RUNNING`。
- 约 0.5 到 3 秒后变为 `AC`。
- 返回体包含 `runtimeMs`、`memoryKb`、`passedCount`、`totalCount`、`caseResults`。

### 5. AI 找 Bug SSE

将 `<submission-id>` 替换为一次提交 ID。

```bash
curl -N -X POST http://localhost:3001/api/ai/bug-find/stream \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","submissionId":"<submission-id>","provider":"vllm","language":"python","mode":"core","status":"WA","runtimeMs":5,"memoryKb":1024,"passedCount":2,"totalCount":15,"errorMessage":"Expected [0,1], got []"}'
```

预期：
- 流式事件包含 `meta`、`phase`、`response.output_text.delta`、`response.completed`、`done`。
- `done` 中包含 `sessionId`、`source`、`providerKind`、`model`、`guidance`。
- 诊断文本应结合题目、代码、状态和失败样例给出建议。

### 6. AI 题解 SSE

```bash
curl -N -X POST http://localhost:3001/api/ai/solution/stream \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","problemTitle":"两数之和","modeSupport":"BOTH","preferredLanguage":"cpp","description":"给定整数数组 nums 和目标值 target，请返回两数下标。","sampleInput":"nums = [2,7,11,15], target = 9","sampleOutput":"[0,1]","provider":"vllm"}'
```

预期：
- 流式事件包含 `meta`、`phase`、`response.output_text.delta`、`response.completed`、`done`。
- `done` 中包含 `editorial`，正文按“题意 / 思路 / 复杂度 / Core 代码 / ACM 代码 / 易错点 / 验证用例”组织。
- 如果模型服务未启动，会返回明确错误，例如 `vllm 模型服务不可达`；如果端口跑错服务，会提示 `AI Tutor 题解接口不存在`。

### 7. 页面验证

1. 打开 `http://localhost:3000/problems`，确认题库总数为 `100`。
2. 搜索 `两数` 或 `hash`，确认列表按关键词过滤，刷新后搜索状态保留。
3. 打开 `http://localhost:3000/problems/two-sum`。
4. 在题目页切换 `core/acm` 与 `C++/Python`，确认编辑器模板随模式变化。
5. 点击 `运行测试`，确认右侧直接展示终态和逐条 Case 结果。
6. 点击 `提交`，确认状态从 `QUEUED/RUNNING` 变为终态。
7. 切到 `AI判题`，确认可基于提交或运行测试结果生成诊断。
8. 切到 `AI题解`，确认可流式生成结构化题解。
9. 打开 `http://localhost:3000/progress`，确认热力图、雷达图、掌握度和待复习列表可见。
10. 打开 `http://localhost:3000/admin/problems`，确认能查看每题公开/隐藏测试用例。

## 测试与验收

```bash
npm run check --workspaces
npm run test -w @leetcodepro/web
npm run test -w @leetcodepro/api
npm run test -w @leetcodepro/judge-dispatcher
```

端到端验证：

```bash
npm run e2e:minimal
npm run e2e:stability
npm run e2e:ai-quality
npm run e2e:prompt-injection
```

Hot100 双模式判题巡检：

```bash
npm run verify:judge-modes
```

预期：
- `e2e:minimal` 输出 `Minimal E2E flow passed`。
- `e2e:prompt-injection` 输出 `prompt injection security gate passed`。
- `verify:judge-modes` 输出 `All 100 problems passed mode-isolation checks`，并生成 `artifacts/judge-mode-isolation-report.json`。

## 停止服务

停止前台开发服务：

```bash
Ctrl+C
```

停止 Docker 基础设施：

```bash
docker compose down
```

如果需要清空数据库卷后重建：

```bash
docker compose down -v
docker compose up -d
npm run db:setup -w @leetcodepro/api
```

## 常见问题

### Docker 未启动

现象：`docker compose up -d` 失败。

处理：

```bash
open -a Docker
docker compose up -d
```

### 题库不是 100 题

处理：

```bash
npm run db:setup -w @leetcodepro/api
```

### Judge 报 Docker 镜像不存在

首次判题可能需要拉取镜像：

```bash
docker pull gcc:13-bookworm
docker pull python:3.12-slim
```

### AI 请求超时或无模型响应

检查 `.env` 中的 provider、Base URL、API Key 和模型名：

```bash
curl http://localhost:8001/health
```

DeepSeek V4 推荐配置：

```bash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

如果在首页新增自定义 OpenAI 兼容配置，Base URL 可以填 `https://api.deepseek.com`；系统会兼容误填 `/v1` 或完整 `/chat/completions` 的情况，但推荐只填服务根地址。

如果 `curl http://localhost:8000/openapi.json` 显示 `Grading Service`，说明 8000 端口被旧服务占用。当前 AI Tutor 默认使用 8001，请确认 `.env` 中：

```bash
AI_TUTOR_PORT=8001
AI_TUTOR_BASE_URL=http://localhost:8001
```

修改后重启：

```bash
npm run dev:ai
npm run dev:api
```

如果只想验证非 AI 主链路，可先使用页面提交、`run-tests` 或 `npm run e2e:minimal -- --health-check-deps false`。

### 端口占用

默认端口：
- Web: `3000`
- API: `3001`
- AI Tutor: `8001`
- Judge: `8080`
- PostgreSQL: `5432`
- RabbitMQ: `5672`

用下面命令检查：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:8001 -sTCP:LISTEN
lsof -nP -iTCP:8080 -sTCP:LISTEN
```
