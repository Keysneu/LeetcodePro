# LeetCodePro（MVP 第一阶段）运行与验证指南

更新时间：2026-03-30（Asia/Shanghai）

## 1. 说明（请先看）

本项目当前默认且推荐使用 **Docker** 提供数据库与中间件。  
如果不使用 Docker，你需要自行保证 PostgreSQL/Redis/RabbitMQ 全部可用，否则流程会失败。

**本文主流程只写 Docker 路径。**

当前已完成范围：
- API 已接通 `提交写库 -> RabbitMQ 入队 -> Judge Dispatcher 消费 -> 判题结果回写`
- 判题链路已升级为 **真实编译执行最小版**：支持 C++/Python 的 `core + acm` 提交，并基于数据库测试用例逐条判定 `AC/WA/TLE/RE/CE`
- 判题结果会写入 `submissions` 与 `submission_case_results`
- 当前题目适配范围：`two-sum`、`valid-parentheses`、`container-with-most-water`
- 前端题目页已打通真实交互：支持题目列表 API 拉取、题面详情展示、提交判题、结果轮询、AI 点评
- Judge 默认运行在 `docker` 沙箱模式：禁网、只读根文件系统、非 root 用户、`memory/cpu/pids` 限制（cgroups）
- C++ 判题依赖镜像 `gcc:13-bookworm`，Python 判题依赖镜像 `python:3.12-slim`

当前未完成范围：
- 自定义 seccomp profile 仍为可选项（当前默认使用 Docker 自带 seccomp）
- AI 点评链路尚未完成 SSE 流式与会话消息落库（当前是最小可用同步调用）

临时验证方式（当前阶段）：
- 方式 A：使用前端题目页进行真实提交流程验证
- 方式 B：使用 `curl` 调用 API 创建提交，再轮询提交状态，验证状态流转 `QUEUED -> RUNNING -> AC/WA/CE`

---

## 2. 环境前置检查

在终端执行：

```bash
node -v
npm -v
python3 --version
g++ --version
docker --version
docker compose version
```

判定标准：

- 上面任一命令报 `command not found`，先安装对应工具再继续。
- `docker` 命令可用但 Docker Desktop 未启动时，`docker compose up -d` 会失败。

---

## 3. 从 0 到 1 完整启动流程（Docker 推荐路径）

### 3.1 安装并启动 Docker Desktop（首次）

```bash
brew install --cask docker
open -a Docker
```

等待 Docker 完全启动（通常 10-60 秒），再执行：

```bash
docker --version
docker compose version
```

### 3.2 进入项目目录

```bash
cd /Users/moem/Desktop/vibecoding/LeetcodePro
```

### 3.3 初始化环境变量

```bash
cp .env.example .env
```

### 3.4 安装依赖

```bash
npm install
npm run setup:python
```

### 3.5 启动基础依赖（PostgreSQL/Redis/RabbitMQ）

```bash
docker compose up -d
```

检查容器状态：

```bash
docker compose ps
```

检查 PostgreSQL 端口监听：

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
```

### 3.6 执行数据库迁移与最小题库导入

```bash
npm run db:setup -w @leetcodepro/api
```

成功日志关键字：

- `applied migration: 001_init_core_tables.sql`
- `database migration completed.`
- `seed completed: 3 problems, demo user demo@leetcodepro.local`

### 3.7 启动全部服务

```bash
npm run dev
```

预期服务地址：

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api/health`
- AI Tutor: `http://localhost:8000/health`
- Judge Dispatcher: `http://localhost:8080/health`

---

## 4. 功能验证（可直接复制）

保持 `npm run dev` 终端运行，另开一个终端执行。

### 4.1 健康检查

```bash
curl http://localhost:3001/api/health
curl http://localhost:8000/health
curl http://localhost:8080/health
```

`judge-dispatcher` 预期示例：
- `status` 为 `ok`
- `executionMode` 为 `docker`
- `queueName` 为 `judge.submissions.v1`

### 4.2 题库接口验证

```bash
curl http://localhost:3001/api/problems
curl http://localhost:3001/api/problems/two-sum
```

预期：

- `items` 至少包含 `two-sum`、`valid-parentheses`、`container-with-most-water`
- 详情含 `sampleInput` 和 `sampleOutput`

### 4.3 提交与结果查询验证

示例 A：Python Core（预期 AC）

```bash
curl -X POST http://localhost:3001/api/submissions \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","language":"python","mode":"core","code":"def twoSum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        y = target - x\n        if y in seen:\n            return [seen[y], i]\n        seen[x] = i\n    return []"}'
```

查询提交（替换 `<submission-id>`，建议间隔 0.5 秒连续查 3-5 次）：

```bash
curl http://localhost:3001/api/submissions/<submission-id> 
```

预期：

- 初次查询通常 `QUEUED` 或 `RUNNING`
- 约 0.5~3 秒后变为 `AC`

示例 B：C++ Core（预期 CE）

```bash
curl -X POST http://localhost:3001/api/submissions \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","language":"cpp","mode":"core","code":"// TODO"}'
```

预期：
- 状态最终为 `CE`
- 若已拉取 `gcc:13-bookworm`：`errorMessage` 含编译错误信息（例如缺少 `twoSum` 符号）
- 若未拉取镜像：`errorMessage` 会提示 `No such image` 和 `docker pull gcc:13-bookworm`

### 4.4 AI 点评验证

```bash
curl -X POST http://localhost:3001/api/ai/review \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","status":"WA","errorMessage":"Hint: 你的代码还未实现核心逻辑。"}'
```

预期：

- 返回 `guidance`
- `source` 为 `ai-tutor` 或 `api-fallback`

### 4.5 页面验证

浏览器打开并按下面步骤操作：

1. 打开 `http://localhost:3000/problems`，确认列表来自 API（至少包含 `two-sum`、`valid-parentheses`、`container-with-most-water`）。
2. 点击进入 `http://localhost:3000/problems/two-sum`。
3. 在右侧编辑器保持默认代码或粘贴可 AC 代码，点击 `提交判题`。
4. 观察“判题结果”面板状态从 `QUEUED/RUNNING` 变为终态（如 `AC`）。
5. 点击 `求助 AI`，观察“AI 点评”面板出现引导式建议，并显示 `source`。

预期：
- 提交后可看到 `submission id`、`status`、`runtimeMs/errorMessage` 的实时更新
- `AC` 或失败态都会稳定落在终态，不会长期卡在 `QUEUED`
- AI 点评区域返回非空文本，且不直接给出完整题解

### 4.6 最小 E2E 一键联调脚本（推荐）

项目已提供脚本：`scripts/e2e/minimal-flow.mjs`，覆盖流程：
- `GET /api/problems`
- `POST /api/submissions`
- 轮询 `GET /api/submissions/:id` 直到终态
- `POST /api/ai/review`
- 启动前依赖健康检查（API/AI/Judge）

直接执行：

```bash
npm run e2e:minimal
```

预期：
- 终端打印 `health / problem-list / submit / judge / ai-review / result` 阶段日志
- 最终出现 `Minimal E2E flow passed`
- 进程退出码为 `0`

可选参数示例（指定 API 地址、语言、模式、期望状态）：

```bash
node scripts/e2e/minimal-flow.mjs \
  --api-base-url http://localhost:3001 \
  --ai-base-url http://localhost:8000 \
  --judge-base-url http://localhost:8080 \
  --problem-slug two-sum \
  --language python \
  --mode core \
  --expected-status AC
```

如果你只想校验 API（跳过 AI/Judge 健康检查）：

```bash
node scripts/e2e/minimal-flow.mjs --health-check-deps false
```

退出码说明：
- `0`：链路验证通过
- `11`：参数错误（如 language/mode 非法）
- `20`：链路执行失败（网络超时、接口报错、轮询超时）
- `21`：判题终态与期望不一致

---

## 5. 停止服务

停止应用服务（`npm run dev` 的终端）：

```bash
Ctrl + C
```

停止基础依赖容器：

```bash
docker compose down
```

---

## 6. 常见问题与排查

### 6.1 `command not found: docker`

- 原因：未安装 Docker
- 处理：执行 `brew install --cask docker`，再 `open -a Docker`

### 6.2 `Cannot connect to the Docker daemon`

- 原因：Docker Desktop 未启动
- 处理：`open -a Docker`，等待启动完成后重试

### 6.3 `ECONNREFUSED 127.0.0.1:5432`（或 `::1:5432`）

- 原因：PostgreSQL 容器未启动或未就绪
- 处理步骤：
  1. `docker compose ps`
  2. `docker compose logs postgres --tail=100`
  3. `docker compose up -d`
  4. 再执行 `npm run db:setup -w @leetcodepro/api`

### 6.4 `Invalid problemSlug`

- 原因：提交时题目标识不存在
- 处理：先执行 `curl http://localhost:3001/api/problems` 获取合法 `slug`

### 6.5 `Judge queue unavailable, please retry.`

- 原因：API 无法连接 RabbitMQ（`RABBITMQ_URL` 不可达）或队列声明失败
- 处理步骤：
  1. `docker compose ps`
  2. `docker compose logs rabbitmq --tail=100`
  3. `curl http://localhost:8080/health` 查看 `lastError`
  4. 确认 `.env` 中 `RABBITMQ_URL` 与 `JUDGE_QUEUE_NAME` 与服务一致

### 6.6 `g++: command not found`

- 原因：本机未安装 C++ 编译器
- 处理：安装 Xcode Command Line Tools（macOS）
  1. `xcode-select --install`
  2. 重新执行 `g++ --version` 验证可用

### 6.7 Judge 返回 `CE` 且包含 `Unable to find image`

- 原因：本机未拉取判题容器镜像（如 `gcc:13-bookworm` / `python:3.12-slim`）
- 处理步骤：
  1. `docker pull gcc:13-bookworm`
  2. `docker pull python:3.12-slim`
  3. 重试提交

补充：
- 2026-03-30 后的代码已修复“镜像缺失缓存”问题，拉取镜像后无需依赖重启即可恢复。
- 若你仍在运行旧版 `judge-dispatcher` 进程，请重启一次：`npm run dev:judge`。

### 6.8 容器模式下首次提交频繁 `TLE`

- 原因：首次拉镜像或容器冷启动耗时计入执行超时窗口
- 处理：
  1. 预拉镜像（见 6.7）
  2. 适当调大 `.env` 中 `JUDGE_SANDBOX_STARTUP_GRACE_MS`（默认 `8000`，可按机器性能上调）

### 6.9 前端提交长期停留 `QUEUED`

- 原因：Judge 进程未真正消费队列（常见于旧进程或环境变量未生效）
- 处理步骤：
  1. `curl http://localhost:8080/health`，确认返回包含 `queueName`、`lastConsumedAt`、`executionMode`
  2. 重新启动 Judge：`npm run dev:judge`
  3. 再次提交，并观察 `lastConsumedAt` 是否更新

---

## 7. 附录：非 Docker 路径（不推荐）

如果你明确要走本机 PostgreSQL，请先确保：

- `psql --version` 可用
- 本机 PostgreSQL 已启动并监听 `5432`
- 自行准备 Redis/RabbitMQ（后续阶段会依赖）

然后再运行：

```bash
export POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/leetcodepro
npm run db:setup -w @leetcodepro/api
```
