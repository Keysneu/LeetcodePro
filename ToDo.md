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
- [/] 后端核心 API（题目、提交、结果查询）
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

验收标准：
- [x] 可通过 API 查询题目列表与题目详情
- [x] 每道题均包含至少 1 个公开样例 + 1 个隐藏用例

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

### P0-5 AI 点评链路
- [x] 前端“求助 AI”入口
- [/] API 聚合上下文（题目 + 用户代码 + 失败样例 + 错误信息）
- [/] AI 服务返回诊断（SSE 流式）
- [ ] 落库 AI 会话与消息记录（`ai_sessions`、`ai_messages`）

验收标准：
- [ ] WA/TLE 时可拿到可读的定位建议
- [ ] 回复风格符合“引导式提示，不直接给完整答案”

### P0-6 E2E 联调与验收
- [x] 编写最小端到端脚本：`题目查询 -> 提交 -> 判题 -> AI点评`（`scripts/e2e/minimal-flow.mjs`）
- [x] 补充关键日志与错误码（阶段日志 + 退出码 + 超时依赖诊断）
- [ ] 输出 MVP 演示脚本（供产品验收）

验收标准：
- [ ] 连续 10 次提交流程可稳定跑通
- [ ] 主流程无阻塞级 Bug（无法提交、结果不回写、AI 无响应）

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

## 5. 当前阻塞项

- [ ] 自定义 seccomp profile 尚未落地（当前使用 Docker 默认 seccomp）
- [ ] C++ 编译镜像需提前拉取（`gcc:13-bookworm`），否则会快速返回 `CE`（No such image）

## 6. 下一步（立即执行）

- [ ] 继续 P0-6：将前端提交流程接入连续 10 次稳定性验收并沉淀 MVP 演示脚本
