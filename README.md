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
- 题库已升级为 **LeetCode Hot 100 全量中文题面**（100 题），名称、描述与示例对齐 LeetCode 中文站风格
- 所有 Hot100 题目均写入公开/隐藏样例（`test_cases`），并在题目层声明支持 `core + acm` 双模式提交
- 核心判题引擎已升级为 Hot100 全题通用适配：解法题与设计题均支持 `core` 提交（C++/Python）
- 核心模式结果比较已支持 JSON 规范化（忽略空白差异），避免 `[null, null]` 与 `[null,null]` 误判
- 题面描述区按 Markdown 渲染（含标题、列表、代码块、表格）
- 判题错误输出默认完整保留并在前端滚动展示（`JUDGE_MAX_OUTPUT_LENGTH` 默认 `1048576`）
- 题库与题面展示已支持中文样式：题库列表与题目详情默认展示中文题名与中文描述
- 核心模式模板已升级为 Hot100 全量官方函数签名模板（C++/Python）
- 前端题目页已打通真实交互：支持题目列表 API 拉取、题面详情展示、提交判题、结果轮询、AI **SSE 流式点评**
- 前端展示已完成一轮 LeetCode 风格重构：统一深色 token、顶栏导航、题库表格化题单、题面/编辑区卡片层级、按钮与状态标签样式
- 前端展示已完成第二轮 LeetCode 风格优化：题面/代码区增加 tab 结构、题库表头与通过率列优化、运行分析面板层级强化
- 已支持夜间/白天主题切换（右上角按钮），并持久化到 `localStorage`
- 题目详情页已打通“提交记录/题解”功能：提交记录展示历史提交与运行结果，题解支持 AI SSE 流式生成完整思路与代码讲解
- 题解功能已支持用户 Markdown 笔记上传与自动映射：在首页上传一次后，可按题目提取个人笔记并在“题解”tab优先展示，且按 Markdown 格式渲染
- 题目页右侧工作区布局已调整为上下分区：上方仅代码编辑器，下方独立展示操作按钮、判题结果与 AI 点评
- 核心代码模式已对齐 LeetCode 风格：C++ 默认模板为 `class Solution` 成员函数，用户无需手动编写头文件
- 编辑器模式切换行为已更新：切到 `ACM` 会自动清空代码；切回 `core` 会恢复该题在核心模式下编辑过的代码
- 新增后台判题数据看板：支持按题查看判题使用的完整测试数据（公开/隐藏用例、权重、输入、期望输出）
- 前端构建目录已隔离：`next dev` 使用 `.next-dev`，`next build/start` 使用 `.next`，减少 chunk 缓存串扰
- AI 点评链路已接通 `vLLM 实时调用 + SSE 流式输出 + ai_sessions/ai_messages 落库`（可返回 `sessionId`）
- Judge 默认运行在 `docker` 沙箱模式：禁网、只读根文件系统、非 root 用户、`memory/cpu/pids` 限制（cgroups）+ 自定义 seccomp profile
- C++ 判题依赖镜像 `gcc:13-bookworm`，Python 判题依赖镜像 `python:3.12-slim`
- 已提供 `P0-6` 验收脚本：
  - 连续 10 次稳定性验收：`npm run e2e:stability`
  - MVP 演示脚本：`npm run demo:mvp`

当前未完成范围：
- 推荐系统、遗忘曲线调度、RAG 检索增强等 V2 能力尚未进入 MVP 范围

临时验证方式（当前阶段）：
- 方式 A：使用前端题目页进行真实提交流程验证
- 方式 B：使用 `curl` 调用 API 创建提交，再轮询提交状态，并验证 AI SSE/会话落库
- 方式 C：进入后台看板核对每题判题数据（`/admin/problems`）

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

按需确认（或覆盖）以下 AI 配置：

```bash
LLM_PROVIDER=vllm
VLLM_BASE_URL=http://127.0.0.1:18100/v1
VLLM_API_KEY=asjjcjasldasdasdcasd
VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct
CHAT_TEMPLATE_TYPE=qwen
ADMIN_API_KEY=leetcodepro-admin-key
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

如果你之前已经做过 seed（旧英文题面），请至少再执行一次：

```bash
npm run db:seed -w @leetcodepro/api
```

成功日志关键字：

- `applied migration: 001_init_core_tables.sql`
- `applied migration: 002_add_ai_sessions_and_messages.sql`
- `applied migration: 003_add_user_notes.sql`
- `applied migration: 004_add_leetcode_id_to_problems.sql`
- `database migration completed.`
- `seed completed: 100 problems, demo user demo@leetcodepro.local`

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

`ai-tutor` 预期示例：
- `status` 为 `ok`
- `provider` 为 `vllm`
- `model` 为 `Qwen/Qwen2.5-7B-Instruct`

`judge-dispatcher` 预期示例：
- `status` 为 `ok`
- `executionMode` 为 `docker`
- `seccompProfile` 为非空路径（默认内置 `infra/seccomp/judge-seccomp.json`）
- `queueName` 为 `judge.submissions.v1`

### 4.2 题库接口验证

```bash
curl http://localhost:3001/api/problems
curl http://localhost:3001/api/problems/two-sum
```

预期：

- `items` 长度应为 `100`
- 列表按 `leetcodeId` 升序（例如开头是 `1. 两数之和`）
- 详情含 `description`、`inputSpec`、`outputSpec`、`sampleInput`、`sampleOutput`

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

示例 C：Python Core（设计题 `min-stack`，预期 AC）

```bash
curl -X POST http://localhost:3001/api/submissions \
  -H "content-type: application/json" \
  -d '{"problemSlug":"min-stack","language":"python","mode":"core","code":"class MinStack:\n    def __init__(self):\n        self.st=[]\n        self.mn=[]\n    def push(self, val: int) -> None:\n        self.st.append(val)\n        self.mn.append(val if not self.mn else min(val, self.mn[-1]))\n    def pop(self) -> None:\n        self.st.pop(); self.mn.pop()\n    def top(self) -> int:\n        return self.st[-1]\n    def getMin(self) -> int:\n        return self.mn[-1]"}'
```

预期：
- 状态最终为 `AC`
- `caseResults` 中会对设计题样例返回逐用例判定结果

### 4.4 AI 点评验证

方式 A：SSE 流式（推荐）

```bash
curl -N -X POST http://localhost:3001/api/ai/review/stream \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","submissionId":"<submission-id>","status":"WA","errorMessage":"Hint: 你的代码还未实现核心逻辑。"}'
```

预期：
- 持续收到 `event: meta / delta / done`
- `done` 事件中包含 `sessionId`、`source`、`guidance`
- `source` 优先为 `vllm`（当 vLLM 不可用时回退为 `ai-tutor-fallback`）

方式 B：同步接口（兼容）

```bash
curl -X POST http://localhost:3001/api/ai/review \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","submissionId":"<submission-id>","status":"WA","errorMessage":"Hint: 你的代码还未实现核心逻辑。"}'
```

预期：

- 返回 `guidance`
- `source` 为 `vllm` 或 `ai-tutor-fallback` 或 `api-fallback`
- 返回 `sessionId`

会话落库验证（替换 `<session-id>`）：

```bash
psql postgresql://postgres:postgres@localhost:5432/leetcodepro -c "select id, session_type, created_at from ai_sessions where id = '<session-id>';"
psql postgresql://postgres:postgres@localhost:5432/leetcodepro -c "select role, left(content, 80) as preview, created_at from ai_messages where session_id = '<session-id>' order by created_at asc;"
```

### 4.5 页面验证

浏览器打开并按下面步骤操作：

1. 打开 `http://localhost:3000/problems`，确认列表来自 API，且题目总数为 `100`。
2. 点击进入 `http://localhost:3000/problems/two-sum`。
3. 观察右侧编辑器默认代码，确认是 LeetCode 风格 `class Solution { ... }`，且没有 `#include` 头文件。
4. 在 `core` 模式下先输入任意标记（例如 `// core-mark`）。
5. 将模式切到 `ACM`，确认编辑器内容立即被清空（空白状态）。
6. 再切回 `core`，确认第 4 步输入的 `// core-mark` 被恢复显示。
7. 在右侧编辑器保持默认代码或粘贴可 AC 代码，点击 `提交判题`。
8. 观察“判题结果”面板状态从 `QUEUED/RUNNING` 变为终态（如 `AC`）。
9. 点击 `求助 AI`，观察“AI 点评”面板出现引导式建议，并显示 `source`。
10. 点击顶部导航右上角主题按钮，在“夜间/白天”之间切换 2 次，确认页面背景、卡片、文字和 Monaco 编辑器主题同步切换。
11. 在题目左侧切换到“提交记录”标签，确认能看到最近提交状态、运行时间、内存与错误信息。
12. 在题目左侧切换到“题解”标签，确认可流式生成系统题解，并展示 `source` 与 `sessionId`。
13. 返回首页 `http://localhost:3000/`，在“上传刷题笔记（全局）”卡片上传包含多题笔记的 Markdown。
14. 回到题目页“题解”标签，确认“我的题解笔记”区域能展示当前题匹配内容。

预期：
- 提交后可看到 `submission id`、`status`、`runtimeMs/errorMessage` 的实时更新
- `AC` 或失败态都会稳定落在终态，不会长期卡在 `QUEUED`
- AI 点评区域返回非空文本，且不直接给出完整题解
- 题库列表应以 `题号.中文题名` 展示（例如 `1. 两数之和`）
- 核心模式默认代码符合 LeetCode 风格（`class Solution`），且无需用户显式编写 C++ 头文件
- 切换到 `ACM` 时编辑器内容会清空；切回 `core` 时会恢复该题核心模式下最近编辑内容
- 所有 Hot100 题目都支持 `core + acm` 双模式提交（含设计题）
- 顶部导航、题库列表、题面卡片、编辑区按钮视觉风格统一为 LeetCode 风格（深灰基底 + 橙色主操作）
- 题目页在移动端无明显错位：题面卡片与编辑区上下排列，内容可滚动
- 题目页右侧顺序符合“代码编辑区在上，操作按钮+判题/AI 面板在下”
- 主题切换后无需刷新页面，且重新打开浏览器后保持最近一次主题选择
- “提交记录”标签可看到最新 30 条提交，状态色与判题状态一致
- “题解”标签能返回结构化题解文本（题意/思路/复杂度/代码/易错点）
- 首页上传 `.md` 后，系统会返回匹配结果；若包含当前题目，题解页“我的题解笔记”应立即展示对应段落
- “我的题解笔记”区域应按 Markdown 正确渲染（标题、列表、代码块、表格等）
- 当笔记使用 `24. 两两交换链表中的节点`、`25.K个一组翻转链表（附注）` 这类题号边界行时，系统会按“两个题号行之间的内容”归属前一道题目

### 4.12 后台判题数据看板验证（本次新增）

先确认 `./.env` 中存在（或与 API 实际值一致）：

```bash
ADMIN_API_KEY=leetcodepro-admin-key
```

接口验证：

```bash
curl http://localhost:3001/api/admin/problems \
  -H "x-admin-key: leetcodepro-admin-key"
```

预期：
- 返回 `items` 数组（长度为 `100`）
- 每题含 `totalCases/publicCases/hiddenCases/totalWeight`

题目判题详情验证（示例 `two-sum`）：

```bash
curl http://localhost:3001/api/admin/problems/two-sum/judge-data \
  -H "x-admin-key: leetcodepro-admin-key"
```

预期：
- 返回 `item.testCases` 数组
- 每条用例包含 `inputData`、`expectedOutput`、`isHidden`、`weight`

页面验证：

1. 打开 `http://localhost:3000/admin/problems`。
2. 顶部导航应看到“后台”入口，页面样式与题库页一致（同一主题色、卡片边框、状态标签）。
3. 左侧切换任意题目，右侧应显示该题判题数据统计与完整用例列表。
4. 用例卡片应明确标记“公开/隐藏”以及权重。

预期：
- 左侧题目列表展示 `题号 + 标题 + 难度 + 用例数`
- 右侧“判题测试用例”可看到输入与期望输出原文（空内容显示 `(空)`）
- 未携带或携带错误 `x-admin-key` 时，接口返回 `401`

### 4.9 新接口验证（提交记录 + 题解）

提交记录接口：

```bash
curl http://localhost:3001/api/submissions/history/by-problem/two-sum
```

预期：
- 返回 `items` 数组
- 每项包含 `status`、`runtimeMs`、`memoryKb`、`passedCount`、`totalCount`、`createdAt`

题解同步接口：

```bash
curl -X POST http://localhost:3001/api/ai/solution \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","problemTitle":"Two Sum","modeSupport":"BOTH","preferredLanguage":"cpp","description":"给定整数数组 nums 和目标值 target，找到和为 target 的两个下标。","sampleInput":"nums=[2,7,11,15], target=9","sampleOutput":"[0,1]"}'
```

预期：
- 返回 `editorial`（非空）
- 返回 `source`（`vllm` 或 `ai-tutor-fallback` 或 `api-fallback`）
- 返回 `sessionId`

题解 SSE 接口：

```bash
curl -N -X POST http://localhost:3001/api/ai/solution/stream \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","problemTitle":"Two Sum","modeSupport":"BOTH","preferredLanguage":"cpp","description":"给定整数数组 nums 和目标值 target，找到和为 target 的两个下标。","sampleInput":"nums=[2,7,11,15], target=9","sampleOutput":"[0,1]"}'
```

预期：
- 持续收到 `event: meta / delta / done`
- `done` 中包含 `editorial`、`source`、`sessionId`

### 4.10 个人笔记题解验证（Markdown 上传与题目映射）

上传 Markdown 笔记：

```bash
curl -X POST http://localhost:3001/api/notes/upload \
  -H "content-type: application/json" \
  -d '{"filename":"leetcode-notes.md","markdownContent":"# Two Sum\n\n哈希表记录已遍历值与下标，时间 O(n)。\n\n# Valid Parentheses\n\n用栈维护左括号，遇到右括号时校验栈顶是否匹配。"}'
```

预期：
- 返回 `item.noteId`
- 返回 `item.matchedCount`（应 >= 1）
- 返回 `item.matches`，每项包含 `problemSlug`、`problemTitle`、`matchedHeading`

查询某题映射笔记（示例：`two-sum`）：

```bash
curl http://localhost:3001/api/notes/problem/two-sum
```

预期：
- 返回 `item`（存在时非空）
- `item.contentMd` 包含笔记中的对应段落
- `item.sourceFilename` 为上传文件名
- 题目边界识别优先使用“题号 + 题目名称”，并允许题目名称后追加 `（）` 注释

请求体大小说明：
- API 已将 JSON Body 限制提升到 `4mb`，可支持较大的 Markdown 笔记上传。

### 4.11 单元测试验证（本次新增）

```bash
npm run test -w @leetcodepro/api
npm run test -w @leetcodepro/judge-dispatcher
```

预期：
- `@leetcodepro/api`：`notes-matcher` 测试通过（题号边界切分 + 标题后缀括号兼容）
- `@leetcodepro/judge-dispatcher`：判题回归测试通过

### 4.6 最小 E2E 一键联调脚本（推荐）

项目已提供脚本：`scripts/e2e/minimal-flow.mjs`，覆盖流程：
- `GET /api/problems`
- `POST /api/submissions`
- 轮询 `GET /api/submissions/:id` 直到终态
- `POST /api/ai/review/stream`（默认）或 `POST /api/ai/review`（兼容）
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
  --expected-status AC \
  --ai-review-mode stream
```

如果你只想校验 API（跳过 AI/Judge 健康检查）：

```bash
node scripts/e2e/minimal-flow.mjs --health-check-deps false
```

如果你要回退到同步 AI 验证：

```bash
node scripts/e2e/minimal-flow.mjs --ai-review-mode sync
```

退出码说明：
- `0`：链路验证通过
- `11`：参数错误（如 language/mode 非法）
- `20`：链路执行失败（网络超时、接口报错、轮询超时）
- `21`：判题终态与期望不一致

### 4.7 连续 10 次稳定性验收（P0-6）

```bash
npm run e2e:stability
```

预期：
- 按顺序执行 10 次 `minimal-flow`（第 1 次带依赖健康检查）
- 任一轮失败即停止并返回非 0 退出码
- 全部通过时输出 `stability acceptance passed`

可选参数（示例：改为 12 次）：

```bash
node scripts/e2e/stability-acceptance.mjs --runs 12
```

### 4.8 MVP 演示脚本（产品验收）

```bash
npm run demo:mvp
```

脚本默认演示 2 个场景：
- 场景 1：`python + core + AC`（成功链路）
- 场景 2：`python + acm + WA`（失败链路 + AI 定位建议）

预期：
- 每个场景均打印完整阶段日志（health/problem/submit/judge/ai-review/result）
- 最终输出 `MVP demo passed`

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

### 6.7 Judge 返回 `CE` 且包含 `Unable to find image`（已降级为非阻塞项）

- 原因：本机未拉取判题容器镜像（如 `gcc:13-bookworm` / `python:3.12-slim`）
- 处理步骤：
  1. `docker pull gcc:13-bookworm`
  2. `docker pull python:3.12-slim`
  3. 重试提交

补充：
- 2026-03-30 后的代码已修复“镜像缺失缓存”问题，拉取镜像后无需依赖重启即可恢复。
- 若你仍在运行旧版 `judge-dispatcher` 进程，请重启一次：`npm run dev:judge`。
- 该问题已从 P0 阻塞项移除，不影响主流程功能闭环验收。

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

### 6.10 `seccomp profile` 相关报错

- 常见报错：`invalid seccomp path`、`open ... no such file or directory`
- 排查步骤：
  1. `curl http://localhost:8080/health`，确认 `seccompProfile` 是可访问绝对路径
  2. 如果路径不正确，在 `.env` 中设置 `JUDGE_DOCKER_SECCOMP_PROFILE=<绝对路径>`
  3. 如需临时关闭自定义 seccomp，设置 `JUDGE_DOCKER_SECCOMP_PROFILE=off` 并重启 Judge

### 6.11 AI `source` 总是 `ai-tutor-fallback`

- 原因：`ai-tutor` 无法连到 vLLM，或 vLLM 返回错误
- 排查步骤：
  1. `curl http://localhost:8000/health`，确认 `provider` 为 `vllm`
  2. 检查 `.env`：`VLLM_BASE_URL`、`VLLM_API_KEY`、`VLLM_MODEL` 是否正确
  3. 直接探测 vLLM：
     `curl http://127.0.0.1:18100/v1/models`
  4. 若 vLLM 在远程机器，确认 SSH 隧道/端口映射已建立，再重启 AI 服务：`npm run dev:ai`

### 6.12 前端报错 `Cannot find module './383.js'`

- 原因：Next.js chunk 缓存不一致（常见于中断重启、分支切换，或 dev/build 产物混用后）
- 处理步骤：
  1. 在项目根目录执行：`npm run clean -w @leetcodepro/web`
  2. 重新启动前端：`npm run dev:web`
  3. 刷新页面后再次验证
- 补充说明：
  - 当前版本已将开发产物目录固定为 `.next-dev`，生产构建目录固定为 `.next`，用于降低该问题复发概率

### 6.13 上传笔记时报错 `relation "user_notes" does not exist`

- 原因：数据库未应用最新迁移（`003_add_user_notes.sql`）。
- 处理步骤：
  1. 执行迁移：`npm run db:migrate -w @leetcodepro/api`
  2. 重启 API：`npm run dev:api`（或重启 `npm run dev`）
  3. 重新上传 Markdown 笔记
- 当前版本已增加后端提示：若缺表会返回明确信息，提示执行迁移命令。

### 6.14 `db:seed` 报错 `TypeError: Cannot read properties of undefined (reading 'resolve')`

- 原因：使用旧代码版本时，`apps/api/scripts/db/seed.ts` 对 `node:path` 的导入方式在当前 `ts-node + commonjs` 配置下可能被解析为 `undefined`。
- 处理步骤：
  1. 拉取最新代码（已修复导入方式）：`git pull`
  2. 重新执行：`npm run db:seed -w @leetcodepro/api`
  3. 验证题库数量：`curl http://localhost:3001/api/problems | jq '.items | length'`
- 预期结果：返回 `100`，且 `items[0].leetcodeId` 非 `null`。

### 6.15 `db:seed` 报错外键冲突 `submission_case_results_case_id_fkey`（错误码 `23503`）

- 原因：历史提交结果表 `submission_case_results` 仍引用旧的 `test_cases.id`，而 seed 需要替换 `test_cases`。
- 处理步骤：
  1. 拉取最新代码（seed 已改为先清理当前题相关 `submission_case_results`，再替换测试用例）：`git pull`
  2. 重新执行：`npm run db:seed -w @leetcodepro/api`
  3. 验证题库数量：`curl http://localhost:3001/api/problems | jq '.items | length'`
- 预期结果：seed 正常完成并打印 `seed completed: 100 problems...`。

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
