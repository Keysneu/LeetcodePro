# LeetCodePro MVP 开发 ToDo

更新时间：2026-03-30（Asia/Shanghai）

状态约定：
- `[ ]` 未开始
- `[/]` 进行中
- `[x]` 已完成

## 1. 当前目标（MVP 第一阶段）

优先跑通完整主流程：`做题 -> 判题 -> AI点评`  
范围聚焦 V1.0，不扩展推荐系统和社区功能。

## 2. 当前进度总览

### 2.1 文档阶段
- [x] 完成产品需求文档 [PRD.md](/Users/moem/Desktop/vibecoding/LeetcodePro/PRD.md)
- [x] 完成技术设计文档 [TECH_DESIGN.md](/Users/moem/Desktop/vibecoding/LeetcodePro/TECH_DESIGN.md)
- [x] 明确开发规范与红线 [AGENTS.md](/Users/moem/Desktop/vibecoding/LeetcodePro/AGENTS.md)

### 2.2 开发阶段
- [x] 工程初始化（Monorepo + 基础依赖）
- [x] 前端题目页（题面/编辑器/提交）
- [/] 后端核心 API（题目、提交、结果查询、后台判题数据）
- [/] 判题链路（入队、执行、回写）
- [/] AI 点评链路（基于提交结果的诊断）
- [/] 端到端联调与验收

## 3. P0 任务清单（按执行顺序）

### P0-1 工程骨架与基础设施
- [x] 初始化目录：`apps/web`、`apps/api`、`services/ai-tutor`、`services/judge-dispatcher`
- [x] 配置代码规范：ESLint/Prettier/TypeScript strict
- [x] 配置本地开发编排：`docker-compose`（PostgreSQL/Redis/RabbitMQ）
- [x] 提供 `.env.example` 与启动脚本

验收标准：
- [x] 一条命令可启动本地核心依赖和各服务
- [x] 前后端均可成功启动并通过基础健康检查

### P0-2 数据库与题库最小集
- [x] 建立核心表：`users`、`problems`、`test_cases`、`submissions`、`submission_case_results`
- [x] 编写初始迁移脚本
- [x] 导入最小题库（建议先 3-5 题，覆盖数组/字符串/双指针）
- [x] 题库升级为 LeetCode Hot100 全量（100 题）并增加 `leetcode_id` 题号字段

验收标准：
- [x] 可通过 API 查询题目列表与题目详情
- [x] 每道题均包含至少 1 个公开样例 + 1 个隐藏用例
- [x] 题库列表按题号稳定排序，题目展示格式可对齐“题号.题目名称”笔记

### P0-3 前端做题流程
- [x] 题目列表页（最小可用）
- [x] 题目详情页（三栏布局基础版）
- [x] Monaco 编辑器集成（支持 C++/Python）
- [x] 支持 `核心代码模式 / ACM 模式` 切换
- [x] 提交按钮与结果展示区域

验收标准：
- [x] 用户可完成“选题-写码-提交-看到判题状态/结果”

### P0-4 判题主链路
- [x] API 接收提交并写入 `submissions`（状态 `QUEUED`）
- [x] 提交任务投递 RabbitMQ
- [x] Judge Dispatcher 消费任务并执行沙箱判题（Docker 沙箱：禁网/只读根目录/非 root/cgroups）
- [x] 判题结果回写数据库（AC/WA/TLE/RE/CE）
- [x] API 提供提交结果查询接口

验收标准：
- [x] 支持 C++/Python 两种语言最小判题能力（当前为真实编译执行最小版）
- [x] 支持核心模式与 ACM 模式的统一结果返回
- [x] 完成 Hot100 全题核心判题适配（解法题 + 设计题，C++/Python）

### P0-5 AI 点评链路
- [x] 前端“求助 AI”入口
- [/] API 聚合上下文（题目 + 用户代码 + 失败样例 + 错误信息）
- [x] AI Tutor 接入 vLLM（`LLM_PROVIDER=vllm` + OpenAI 兼容接口）
- [x] AI 服务返回诊断（SSE 流式）
- [x] 落库 AI 会话与消息记录（`ai_sessions`、`ai_messages`）
- [x] 题解支持个人 Markdown 笔记：上传、题目自动映射、按题展示

验收标准：
- [x] WA/TLE 时可拿到可读的定位建议
- [x] 回复风格符合“引导式提示，不直接给完整答案”
- [x] 用户点击“题解”可直接查看当前题目匹配到的个人笔记内容

### P0-6 E2E 联调与验收
- [x] 编写最小端到端脚本：`题目查询 -> 提交 -> 判题 -> AI点评`（`scripts/e2e/minimal-flow.mjs`）
- [x] 补充关键日志与错误码（阶段日志 + 退出码 + 超时依赖诊断）
- [x] 输出 MVP 演示脚本（供产品验收）
- [x] 输出连续 10 次稳定性验收脚本（`scripts/e2e/stability-acceptance.mjs`）

验收标准：
- [x] 连续 10 次提交流程可稳定跑通（`npm run e2e:stability` 实测 10/10 通过）
- [x] 主流程无阻塞级 Bug（无法提交、结果不回写、AI 无响应）

## 4. 本周开发记录（Progress Log）

### 2026-03-29
- [x] 完成 PRD 梳理
- [x] 完成技术架构设计（TECH_DESIGN）
- [x] 建立 MVP ToDo 看板（本文件）
- [x] 初始化 Monorepo 与四服务基础骨架（web/api/ai/judge）
- [x] 完成本地依赖安装与健康检查（3000/3001/8000/8080）
- [x] 完成 PostgreSQL 初始迁移脚本（含核心 5 张表）
- [x] 完成最小题库 seed（3 题，每题公开/隐藏用例）
- [x] API `problems`/`submissions` 切换为数据库读写
- [x] README 补充数据库依赖强校验与 `ECONNREFUSED` 直达排查指引
- [x] README 改为 Docker 主流程（安装 -> 启动 -> 迁移 -> 验证）并将本机 PostgreSQL降为附录
- [x] API 新增 RabbitMQ 入队服务，提交后不再本地定时器判题
- [x] Judge Dispatcher 接入 RabbitMQ 消费并回写 submissions 状态
- [x] README 补充队列链路验证与队列故障排查说明
- [x] 隔离端口联调通过：`cpp/core -> WA`、`python/acm -> RUNNING -> AC`
- [x] Judge Dispatcher 升级为真实执行最小版（C++/Python，core/acm，逐用例判定）
- [x] 新增判题执行器测试（适配器 + core/acm + CE 路径）
- [x] 隔离端口联调通过：`python/core -> AC`、`cpp/core -> CE`，并验证 `submission_case_results` 回写
- [x] Judge 执行器迁移到 Docker 沙箱默认模式（`JUDGE_EXECUTOR_MODE=docker`）
- [x] 判题沙箱资源限制上线（memory/cpu/pids + no-new-privileges + read-only rootfs + no-network）
- [x] 为容器冷启动增加超时宽限配置（`JUDGE_SANDBOX_STARTUP_GRACE_MS`）
- [x] 修复 Docker stdin 传递（`docker run -i`），消除 Python 误判超时
- [x] 增加镜像存在性预检查，缺失时快速返回可操作错误提示
- [x] 新增最小 E2E 联调脚本（`npm run e2e:minimal`），覆盖题目查询/提交/判题/AI点评全链路
- [x] E2E 脚本补充关键日志/退出码/依赖健康检查，失败时输出 Judge/AI 诊断快照

### 2026-03-30
- [x] 前端题库页切换为 API 拉取（去除静态占位题单）
- [x] 题目详情页切换为 API 题面/样例渲染（去除静态占位题面）
- [x] 打通前端真实提交按钮：`POST /api/submissions` + 轮询 `GET /api/submissions/:id`
- [x] 打通前端“求助 AI”按钮：`POST /api/ai/review` 并展示 guidance/source
- [x] README 增补“前端页面实测步骤 + QUEUED 排查”说明
- [x] 修复 Judge 镜像缺失缓存问题（拉取镜像后无需重启即可重新判题）
- [x] AI Tutor 新增 `POST /review/stream`，API 新增 `POST /api/ai/review/stream` 并完成前端 SSE 渲染
- [x] 新增数据库迁移 `002_add_ai_sessions_and_messages.sql`，打通 `ai_sessions` / `ai_messages` 落库
- [x] 新增内置 seccomp profile：`infra/seccomp/judge-seccomp.json`，Judge `/health` 增加 `seccompProfile`
- [x] `minimal-flow` 升级支持 `--ai-review-mode stream|sync`
- [x] 新增连续稳定性脚本：`npm run e2e:stability`
- [x] 新增产品演示脚本：`npm run demo:mvp`
- [x] 实机验收：`npm run e2e:stability` 连续 10 次通过（全部 `AC` + AI SSE 正常）
- [x] 实机验收：`npm run demo:mvp` 两个演示场景通过（`AC`/`WA`）
- [x] AI Tutor 接入远程 vLLM 配置（`VLLM_BASE_URL` / `VLLM_API_KEY` / `VLLM_MODEL` / `CHAT_TEMPLATE_TYPE`）
- [x] AI 服务新增 provider 健康字段与 vLLM 故障自动回退（`source=ai-tutor-fallback`）
- [x] 前端样式升级为 LeetCode 风格：统一设计 token、重构顶部导航、题库表格化列表、做题页题面/编辑区布局与状态控件样式
- [x] 前端验收通过：`npm run check -w @leetcodepro/web`、`npm run build -w @leetcodepro/web`（构建阶段仅提示 ESLint 未安装，不阻塞产物输出）
- [x] 修复前端 chunk 缓存串扰：开发/生产构建目录隔离（`.next-dev` / `.next`）并补充 `npm run clean -w @leetcodepro/web`
- [x] 调整做题页右侧布局层级：将“操作按钮 + 判题/AI 面板”下移为编辑器下方独立卡片，优化信息流顺序
- [x] 前端第二轮 LeetCode 风格增强：题面/代码区引入 tab 布局、题库列表补充通过率列与头部信息条、运行分析面板层级优化
- [x] 新增夜间/白天主题切换：右上角按钮切换 + `localStorage` 持久化 + Monaco 主题联动（`vs-dark/vs`）
- [x] 新增提交记录功能：API `GET /api/submissions/history/by-problem/:slug` + 题目页“提交记录”tab 展示历史提交状态与运行结果
- [x] 新增题解功能：AI Tutor `POST /solution` / `POST /solution/stream`、API 代理 `POST /api/ai/solution` / `POST /api/ai/solution/stream`、前端“题解”tab 流式展示
- [x] 题解与提交记录联调验收通过：`npm run check -w @leetcodepro/api`、`npm run check -w @leetcodepro/web`、`npm run check -w @leetcodepro/ai-tutor`
- [x] 新增笔记映射功能：API `POST /api/notes/upload` / `GET /api/notes/problem/:slug`，支持 Markdown 分段匹配题目并落库 `user_notes`、`user_problem_notes`
- [x] 前端首页支持 `.md` 全局上传（上传一次全题可用）；题解页优先展示个人笔记，当前题无笔记时自动生成 AI 题解补充
- [x] 笔记题解联调验收通过：`npm run check -w @leetcodepro/api`、`npm run check -w @leetcodepro/web`
- [x] 修复大文件上传报错：API `json/urlencoded` body limit 提升至 `4mb`（解决 `PayloadTooLargeError`）
- [x] 修复缺表报错：执行 `003_add_user_notes.sql` 迁移并在 notes 接口增加缺迁移友好提示（`relation "user_notes" does not exist`）
- [x] 题解页“我的题解笔记”支持 Markdown 渲染（标题/列表/代码块/表格）
- [x] 核心代码模式对齐 LeetCode：C++ 默认 `class Solution` 模板（无头文件），并调整编辑器切换为“`ACM` 自动清空、切回 `core` 恢复核心代码”
- [x] 题库数据完整化：新增 Hot100 全量 100 题 seed（含公开/隐藏样例），API/前端按 `leetcode_id` 展示 `题号.题名`，并增强笔记匹配对“题号+标题”格式的识别
- [x] 修复 `db:seed` 启动报错：`seed.ts` 改为 `import * as path from "node:path"`，兼容 `ts-node + commonjs`，恢复 Hot100 种子可执行性
- [x] 修复 `db:seed` 外键冲突：替换用例前先清理该题关联的 `submission_case_results`，避免 `submission_case_results_case_id_fkey (23503)` 阻塞
- [x] 修复题目展示与模式体验：题库页移除 3 题 fallback（失败显式报错）、接入 Hot100 全量中文题名展示、题面补齐输入/输出说明；所有题支持核心模式编辑并对未接入核心判题题目给出提交提示
- [x] 重建 Hot100 题库数据：题名/题面描述切换为中文完整版（修复英文截断）、示例输入输出重提取并覆盖 seed、核心模板升级为 Hot100 全量官方签名（C++/Python）
- [x] 完成核心判题引擎全题适配：核心模式按题目原始样例输入执行（不再走 ACM stdin 转换），新增 C++ `json.hpp` 依赖注入与 LeetCode 风格命名空间兼容
- [x] 修复核心判题稳定性：Python 运行时元数据改为 `json.loads` 解析，通用判定改为 JSON 规范化比较（解决空白差异误判）
- [x] 新增判题回归测试：覆盖非旧题核心判题（`jump-game-ii`）与设计题核心判题（`min-stack`）
- [x] 前端题面渲染优化：题目描述按 Markdown 渲染并做格式归一化（修复制表符列表显示异常）
- [x] 判题结果展示优化：移除 600 字错误摘要截断，提升沙箱输出上限到 1MB，并在前端以可滚动 `pre` 完整展示错误信息
- [x] 笔记匹配规则优化：支持 `题号.题目名`/`题号.题目名（附注）` 作为题目边界，按“两个题号行之间内容”归属前题
- [x] 新增 API 单元测试：`notes-matcher` 覆盖题号边界切分与标题括号后缀匹配
- [x] 新增后台判题数据接口：`GET /api/admin/problems`、`GET /api/admin/problems/:slug/judge-data`（`x-admin-key` 鉴权）
- [x] 新增后台界面：`/admin/problems`，支持按题查看完整判题用例（公开/隐藏、权重、输入、期望输出）
- [x] 顶部导航新增“后台”入口，并保持 LeetCodePro 视觉风格一致
- [x] 新增鉴权单元测试：`apps/api/src/admin-auth.test.ts`
- [x] README 与 `.env.example` 同步更新后台验证步骤与 `ADMIN_API_KEY` 配置

## 5. 当前阻塞项

- 暂无 P0 阻塞项（`gcc:13-bookworm` 镜像相关问题已完成处理并移出阻塞）

## 6. 下一步（立即执行）

- [ ] 进入 P1：开始补齐 AI 诊断质量评估与 Prompt Injection 对抗测试
