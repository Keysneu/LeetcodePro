# LeetCodePro MVP 开发 ToDo

更新时间：2026-04-19（Asia/Shanghai）

状态约定：
- `[ ]` 未开始
- `[/]` 进行中
- `[x]` 已完成

## 1. 当前目标（MVP 第一阶段）

优先跑通完整主流程：`做题 -> 判题 -> AI 找 Bug`  
范围聚焦 V1.0，不扩展推荐系统和社区功能。

## 2. 当前进度总览

### 2.1 文档阶段
- [x] 完成产品需求文档 [PRD.md](/Users/moem/Desktop/vibecoding/LeetcodePro/PRD.md)
- [x] 完成技术设计文档 [TECH_DESIGN.md](/Users/moem/Desktop/vibecoding/LeetcodePro/TECH_DESIGN.md)
- [x] 明确开发规范与红线 [AGENTS.md](/Users/moem/Desktop/vibecoding/LeetcodePro/AGENTS.md)

### 2.2 开发阶段
- [x] 工程初始化（Monorepo + 基础依赖）
- [x] 前端题目页（题面/编辑器/提交）
- [x] 后端核心 API（题目、提交、结果查询、后台判题数据）
- [x] 判题链路（入队、执行、回写）
- [x] AI 找 Bug 链路（基于提交结果的诊断）
- [x] AI RAG 栈集成（RAG 方法论 + LlamaIndex 知识切分检索 + LangChain 提示词编排）
- [x] 进度页可视化（打卡热力图 + 能力雷达图）
- [x] 题目掌握度可视化重构（迁移进度页 + 遗忘曲线 + 仅 C++ 计入口径）
- [x] 做题页展示重构（左右等高壳层 + 内部滚动 + 运行分析自适应折叠）
- [x] ACM 全量适配（Hot100 元数据驱动 stdin 转换 + 无序多解语义归一 + 模式化题面规范）
- [x] ACM 字段迁移兼容兜底（数据库未执行 009 时 API/seed 自动降级，不再因缺列报错）
- [x] 前端编辑器可写性修复（Monaco 强制非只读 + `modeSupport` 脏值兼容，解决代码区无法输入）
- [x] 前端编辑器可见性修复（桌面端代码区改为 `flex` 自适应高度，修复“编辑器被顶上去不可见”）
- [x] AI 前端展示重构（真实流式渲染 + `thinking/正文` 分流 + thinking 折叠/放大）
- [x] 端到端联调与验收

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
- [x] 题库页展示优化：按题型分组（首标签）+ 组内难度排序 + 知识点标签组件替换 slug 列
- [x] 判题结果专业化：失败样例（输入/输出/期望）可视化 + 字符级红绿 diff + 隐藏用例折叠展开
- [x] 页面去调试信息：移除“控制台”占位与 `Submission ID/实际 Provider/来源/会话` 展示
- [x] 前端空间自适应优化：全站流式扩展（去除 `1400px` 上限）+ 做题页可拖拽分栏（默认 40/60，支持持久化）
- [x] 做题页纵向可拖拽比例扩展：代码框/运行分析（默认 65/35）+ 题解笔记/AI题解（默认 50/50），支持持久化与双击复位
- [x] ACM 模式编辑器升级：切换 ACM 自动加载 C++/Python 起步模板（不再空白）
- [x] 左侧题面说明按编辑模式切换：`core/acm` 分别展示对应输入输出与示例
- [x] 题库页/进度页题目入口改为新开标签页，返回列表时无需重新查找题目
- [x] 做题页“运行与分析”改为 `测试用例 / 测试结果` 分栏切换，并新增紧凑版测试用例面板，支持查看官方示例并在前端本地新增/编辑/删除自定义 Case
- [x] 测试用例面板字段再压缩：`nums/期望输出` 等单行内容优先使用更紧凑的输入卡，减少纵向占用
- [x] 题目页顶栏中部接入 LeetCode 风格 `刷新结果 / 提交` 操作组，并联动当前题目工作区
- [x] 顶栏操作组拆分为 `刷新结果 / 运行测试 / 提交`：`运行测试` 同步执行当前编辑器代码与右侧自定义测试用例，不写库；`提交` 继续走正式判题链路
- [x] 左侧 `AI判题` 支持消费 `运行测试` 结果：本地自定义 Case 跑完后，可直接做 AI 诊断，不再强依赖正式提交
- [x] 修复 ACM 自定义运行测试判题入口：测试用例面板中的输入在 `acm` 模式下直接作为标准输入 `stdin`，不再错误走 core 输入转换
- [x] 移除 ACM 模式与代码工作区中的冗余提示文案，失败样例输出展示自动去掉外层双引号
- [x] 题面与测试数据展示清洗：自动去掉历史脏数据中的多余反引号（如 ``nums = `[0,1,0,3,12]` ``）

验收标准：
- [x] 用户可完成“选题-写码-提交-看到判题状态/结果”
- [x] 用户从 `/problems` 或 `/progress` 点击题目后会新开做题标签页，原列表页状态保持不变
- [x] 用户在做题页可以直接查看/切换/新增测试用例，且 ACM 模式失败样例输出展示更接近 LeetCode 风格
- [x] 用户可在不提交的情况下直接运行本地编辑测试用例，并在右侧逐条查看 Case 结果
- [x] 用户可在只执行本地 `运行测试` 的前提下，直接点击左侧 `AI判题` 获取诊断建议

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
- [x] 完成 Hot100 全题 ACM stdin 适配（按题目参数类型转换 `key=value` 样例）
- [x] ACM 判题比较升级为语义归一（`3sum/group-anagrams` 等无序输出不再误判）

### P0-5 AI 找 Bug 链路
- [x] 前端“AI 找 Bug”入口
- [x] API 聚合上下文（题目 + 用户代码 + 失败样例 + 错误信息）
- [x] AI Tutor 接入远程大模型（`vLLM/MiniMax` 可切换，OpenAI 兼容接口）
- [x] AI 服务返回诊断（SSE 流式）
- [x] 落库 AI 会话与消息记录（`ai_sessions`、`ai_messages`）
- [x] 题解支持个人 Markdown 笔记：上传、题目自动映射、按题展示

验收标准：
- [x] WA/TLE 时可拿到可读的定位建议
- [x] 回复风格符合“直接定位问题 + 证据支撑，不直接给完整答案”
- [x] 用户点击“题解”可直接查看当前题目匹配到的个人笔记内容

### P0-6 E2E 联调与验收
- [x] 编写最小端到端脚本：`题目查询 -> 提交 -> 判题 -> AI 找 Bug`（`scripts/e2e/minimal-flow.mjs`）
- [x] 补充关键日志与错误码（阶段日志 + 退出码 + 超时依赖诊断）
- [x] 输出 MVP 演示脚本（供产品验收）
- [x] 输出连续 10 次稳定性验收脚本（`scripts/e2e/stability-acceptance.mjs`）

验收标准：
- [x] 连续 10 次提交流程可稳定跑通（`npm run e2e:stability` 实测 10/10 通过）
- [x] 主流程无阻塞级 Bug（无法提交、结果不回写、AI 无响应）

## 3.1 P1 任务清单（AI 诊断质量评估与 Prompt Injection 对抗）

### P1-1 AI 诊断质量评估
- [x] 新增质量评估脚本：`scripts/e2e/ai-review-quality-eval.mjs`
- [x] 新增一键命令：`npm run e2e:ai-quality`
- [x] 首轮质量闸门通过（`overallScore=100`，阈值 `minCaseScore=70` / `minOverallScore=80`）

### P1-2 Prompt Injection 对抗测试
- [x] 新增对抗测试脚本：`scripts/e2e/prompt-injection-attack.mjs`
- [x] 新增一键命令：`npm run e2e:prompt-injection`
- [x] API 层新增注入片段脱敏（`errorMessage`/`failureSignals`）并在对抗闸门通过（`overallScore=100`）

## 3.2 P2 任务清单（进度页可视化）

### P2-1 打卡热力图 + 能力雷达图
- [x] API 新增进度聚合接口：`GET /api/progress/overview?timezone=<IANA>`
- [x] 统计口径落地：热力图按“每日 AC 提交次数累计”，雷达图按“标签 AC 覆盖率（近90天去重题数 / 标签全库总题数）”
- [x] 前端 `/progress` 接入 ECharts（热力图 + Top8 标签雷达图）与加载/错误/空态
- [x] API 单元测试补齐：热力图计数、雷达分母分子、90天补齐、时区跨天分桶
- [x] README / TECH_DESIGN / ToDo 同步更新验证说明与里程碑状态

### P2-2 掌握度重构（迁移进度页 + 遗忘曲线）
- [x] 掌握度状态枚举升级：`UNTOUCHED/LEARNING/REINFORCING/MASTERED/REVIEW_DUE`
- [x] 掌握度算法改为“近 7 天连续 2 次 AC + 1/3/7/14/30 天复习间隔”
- [x] 掌握度仅统计 C++，保留 core/acm 双模式轨道（`core-cpp/acm-cpp`）
- [x] `/api/progress/overview` 扩展 mastery 聚合块（状态分布、双模式完成度、待复习 Top10）
- [x] 题目页“运行与分析”移除掌握度卡片，题库页状态改为复习信号
- [x] 单测补齐并通过：`mastery-metrics`、`progress-metrics`
- [x] README / TECH_DESIGN / ToDo 同步更新

## 4. 本周开发记录（Progress Log）

### 2026-04-19
- [x] 新增前端展示清洗工具：统一处理题面、示例输入输出、运行测试结果、失败样例、后台判题数据中的历史反引号脏格式
- [x] `apps/api/scripts/db/seed.ts` 增加题库 seed 清洗：重新灌库时会自动去掉数组/对象字面量外层多余反引号
- [x] README / ToDo 同步更新：补充“题面样例去脏展示”的验证页面与重新 seed 说明
- [x] 统一前端 AI 判题上下文：`提交结果 / 历史回放 / 运行测试` 都转成同一份分析快照，补齐 `failureSignals/failureCase`
- [x] `AI判题` 请求改为按上下文源自动带参：正式提交才传 `submissionId`，运行测试直接透传结构化失败信号与失败样例
- [x] Judge 执行器新增自定义 case 输入格式选项：正式提交继续使用 `problem input -> ACM stdin` 转换；`run-tests` 在 ACM 模式下改为直接消费原样 `stdin`
- [x] 新增 API `POST /api/submissions/run-tests`：同步执行当前代码 + 自定义测试用例，直接返回终态与逐 Case 结果，不写 `submissions`
- [x] 前端题目页顶栏新增 LeetCode 风格圆形 `运行测试` 按钮，位置在 `提交` 旁边，样式对齐参考图
- [x] 右侧结果区支持双结果源：`运行测试` 展示逐条自定义 Case 的输入/你的输出/期望输出，`提交` 保持原有正式判题与刷新结果能力
- [x] 验证通过：`npm run test -w @leetcodepro/api`、`npm run check -w @leetcodepro/api`、`npm run check -w @leetcodepro/web`、`npm run build -w @leetcodepro/api`、`npm run build -w @leetcodepro/web`
- [x] 抽离 `apps/web/lib/ai-stream.ts`：统一 SSE 边界解析与流式文本批量刷新，避免 `AI题解/AI判题` 两条链路重复维护
- [x] 新增 `apps/web/components/ai-stream-panel.tsx`：统一 AI 双流展示卡片，移除头像徽标，拆分 `thinking` 与 `正文回答`
- [x] 重构 `apps/web/components/problem-side-panel.tsx`：`AI题解/AI判题` 改为真正按帧流式渲染，`thinking` 支持 `展开/收起/放大/标准视图`
- [x] 新增 `apps/web/lib/ai-content-split.ts`：当前端只拿到混合文本时，自动识别 `<think>` 和 `Thought ...` 结构并拆分思考/正文
- [x] 收敛 AI 页签视觉层级：移除重复说明，卡片头改为 `Leet` 品牌行，正文首段字号与行距提升，`thinking` 胶囊更贴近参考图
- [x] 修复 AI 判题正文非实时问题：`ai-tutor -> api -> web` 新增 `response.output_text.replace` 链路，避免安全清洗后只能在最终帧一次性落整段文本
- [x] 放宽 AI 判题代码展示：允许错误定位用短代码片段，仅继续拦截整题完整实现
- [x] README / ToDo 同步更新：补充 AI 双流面板的页面验证步骤与预期结果

### 2026-04-18
- [x] 题库搜索升级：`GET /api/problems` 新增可选 `q` 参数，支持按题号、题名、slug、标签做大小写无关的部分匹配
- [x] 前端题库页新增 URL 驱动搜索框：输入后更新 `/problems?q=...`，支持清空、刷新回显、无结果空态与命中统计
- [x] 新增搜索纯逻辑单测：覆盖空查询、空白查询、中文题名、英文 slug、题号、标签与未命中场景
- [x] 文档同步：`README.md` 新增题库搜索接口验证、页面验证步骤与搜索示例
- [x] 验证通过：`npm run check -w @leetcodepro/api`、`npm run test -w @leetcodepro/api`、`npm run check -w @leetcodepro/web`
- [x] 修复 core 判题输入解析：`services/judge-dispatcher/src/core-wrapper.mjs` 支持 Markdown 反引号包裹参数（如 ``nums = `[0,1,0,3,12]` ``），解决 `move-zeroes` `void + 引用参数` 输出误判为空数组
- [x] 新增判题隔离回归：`services/judge-dispatcher/test/judge-executor.test.mjs` 增加 `move-zeroes` 的 `cpp core` 与 `cpp acm` 用例，确保两种模式互不干扰
- [x] 修复 core/acm 判题兼容性：补齐 `copy-list-with-random-pointer` 元数据、修正 `merge-two-sorted-lists` 参数别名、修复 `intersection-of-two-linked-lists` 隐藏用例期望值与多题输入格式
- [x] 修复 core 单参数位置输入：`services/judge-dispatcher/src/core-wrapper.mjs` 支持将无键字面量输入（如 `[1,8,6,2,5,4,8,3,7]`）映射到第一个参数，解决 `container-with-most-water` 被误判 `0` 的问题
- [x] 新增数据库迁移：`apps/api/scripts/db/sql/migrations/010_fix_core_acm_judge_case_data.sql`（修复历史入库的判题用例脏数据）
- [x] 新增 Hot100 全量模式巡检脚本：`scripts/verify/all-problems-mode-isolation.mjs`（命令 `npm run verify:judge-modes`）
- [x] 验证通过：`npm run test -w @leetcodepro/judge-dispatcher`（36/36）
- [x] 验证通过：`npm run verify:judge-modes`（100 题 core/acm 全量扫描，`issueCount=0`）
- [x] 修复题目页代码编辑区可见性：`apps/web/components/code-editor.tsx` 将编辑器容器改为 `flex-1 + min-h`，移除固定 `h-full/52vh` 冲突
- [x] 修复代码编辑区“被顶上去”回归：`apps/web/components/code-editor.tsx` 将模式/语言工具栏与底部状态栏设为 `shrink-0`，Monaco 区域改为自适应填充，避免顶部内容被挤出可视区
- [x] 修复题目页视口高度：`apps/web/app/problems/[slug]/page.tsx` 高度改为 `lg:h-[calc(100dvh-6.5rem)]`
- [x] 下调右侧纵向分栏最小高度：`apps/web/components/problem-workspace.tsx` 从 `380/240` 调整为 `320/200`
- [x] 调回右侧纵向分栏主区最小高度：`apps/web/components/problem-workspace.tsx` 从 `320` 提升回 `380`，避免编辑区可用高度被压扁
- [x] 优化 ACM 模式代码区展示：移除 `apps/web/components/problem-workspace.tsx` 中代码框内“ACM 输入提示（stdin）”区块，避免占用编辑区空间
- [x] 最终参数收敛：`apps/web/components/problem-workspace.tsx` 纵向分栏改为默认 `70%`，最小高度 `280/120`（代码区/运行区），优先保证编辑区可见
- [x] 编辑区空间再释放：`apps/web/components/code-editor.tsx` 移除底部“当前模式/语言”状态栏，Monaco 最小高度提高到 `220/260`
- [x] 二次重构代码编辑区：`apps/web/components/code-editor.tsx` 改为“工具栏固定 + 编辑区主体”网格结构，避免正文区域被工具条挤压
- [x] Monaco 稳定性增强：`apps/web/components/code-editor.tsx` 增加容器最小高度与 `ResizeObserver + editor.layout()`，修复仅显示空白/滚动条的问题
- [x] 分栏缓存隔离：`apps/web/components/problem-workspace.tsx` 纵向分栏 storage key 升级为 `leetcodepro-workspace-vertical-ratio-v2`，并调整默认为 `70%`、最小高度 `280/120`
- [x] 纵向分栏比例再校准：`apps/web/components/problem-workspace.tsx` 默认比例调到 `78%`，最小高度调到 `360/120`，减少“运行与分析”区域空白
- [x] 纵向分栏缓存 key 升级：`leetcodepro-workspace-vertical-ratio-v3`，确保新比例立即生效
- [x] 拖拽条可用性增强：`apps/web/components/problem-resizable-layout.tsx` 纵向分隔条加厚高亮，支持触控/触控板拖拽
- [x] 纵向分栏可拖动性修复：`apps/web/components/problem-workspace.tsx` 将最小高度调整为 `180/72`，避免小窗口下因最小高度冲突导致“看起来拖不动”
- [x] 纵向分栏默认再偏代码区：`apps/web/components/problem-workspace.tsx` 默认比例调整为 `86%`，减少“运行与分析”区域大面积空白
- [x] 纵向分栏缓存 key 再升级：`leetcodepro-workspace-vertical-ratio-v4`，强制应用本轮新参数
- [x] 文档同步：`README.md` 新增可见性问题说明与验证步骤，`ToDo.md` 同步记录
- [x] 验证通过：`npm run check -w @leetcodepro/web`、`npm run build -w @leetcodepro/web`

### 2026-04-17
- [x] `services/ai-tutor/app/rag_stack.py`：新增 RAG 编排层，落地“检索 -> 增强提示 -> 生成”流程
- [x] 集成 LlamaIndex：使用 `Document + SentenceSplitter` 构建知识切片并做 TopK 检索
- [x] 集成 LangChain：使用 `ChatPromptTemplate` 统一 system/human 消息编排，保持现有 OpenAI 兼容模型调用路径
- [x] `services/ai-tutor/app/main.py`：`review/solution` 两条链路接入 RAG 增强消息构建
- [x] RAG 接入用户笔记 Markdown：API 从 `user_problem_notes.content_md` 注入 `noteContext`，ai-tutor 使用 LlamaIndex 对笔记切分后参与检索
- [x] `GET /health` 扩展 RAG 运行状态字段：`ragEnabled/langChainReady/llamaIndexReady/ragTopK`
- [x] `.env.example` 新增 `AI_TUTOR_RAG_ENABLED/AI_TUTOR_RAG_TOP_K`
- [x] `services/ai-tutor/requirements.txt` 新增 `langchain` 与 `llama-index-core` 依赖，`package.json` check 覆盖 `app/rag_stack.py`
- [x] 文档同步：README 新增 RAG 接入说明、验证步骤与故障排查
- [x] 校验通过：`npm run check -w @leetcodepro/ai-tutor`

### 2026-04-15
- [x] 重构 `apps/api/src/mastery-metrics.ts`：改为遗忘曲线口径，支持 `nextReviewAt/overdueDays/dueModes/consecutiveAc/reviewIntervalDays`
- [x] 掌握度轨道由 4 条收敛为 2 条（`core-cpp/acm-cpp`），并过滤 Python 对掌握度的影响
- [x] 扩展 `GET /api/progress/overview`：新增 `mastery` 聚合块（状态分布、模式完成度、待复习题目 Top10）
- [x] 前端 `/progress` 新增掌握度总览卡与待复习题目列表，显式提示“掌握度仅统计 C++ 提交”
- [x] 前端题目页工作区移除掌握度卡片，题库页状态文案改为复习信号
- [x] 新增/重写单测：`apps/api/src/mastery-metrics.test.ts`、`apps/api/src/progress-metrics.test.ts`
- [x] 验证通过：`npm run test -w @leetcodepro/api`、`npm run check -w @leetcodepro/api`、`npm run check -w @leetcodepro/web`
- [x] 做题页桌面端分栏重构：左右改为等高壳层 + 各自内部滚动，切换“描述/提交记录/题解”不再导致高度突变
- [x] 右侧“运行与分析”升级：默认分栏比例调整为 `58/42`，判题结果与 AI 区支持折叠/展开并持久化
- [x] 左侧 tab 内容滚动口径统一：移除 `max-h`/`vh` 硬编码，题解 tab 维持纵向可拖拽分栏
- [x] 做题页二次修复：左侧“提交记录/题解”隐藏题目徽标行（仅描述页展示），减少重复信息
- [x] 做题页二次修复：右侧“运行与分析”改为统一内部滚动容器，拖拽低高度后 AI 区不再穿模越界
- [x] 做题页三次重构：左侧页签扩展为 `描述/提交记录/笔记题解/AI题解/AI判题`，并将 AI 判题从右侧迁移到左侧独立页
- [x] 做题页三次重构：右侧“运行与分析”收敛为提交与判题结果；左侧非描述页签隐藏题目标题与徽标
- [x] 做题页三次重构：新增 submission sync 前端事件，打通“右侧提交/刷新/回放 -> 左侧 AI判题”上下文同步
- [x] 做题页三次重构：`AI题解` 与 `AI判题` 模型选择器改为独立持久化，互不覆盖
- [x] 做题页四次优化：左侧 `AI题解/AI判题` 移除调试元信息展示（模型/来源/服务返回模型/会话/当前提交）
- [x] 做题页四次优化：右侧“判题结果”改为横向紧凑统计条（状态/运行时间/内存/通过数）
- [x] 本轮前端校验通过：`npm run check -w @leetcodepro/web`
- [x] 新增数据库迁移 `008_add_user_ai_configs.sql`：落地 `user_ai_configs` / `user_ai_preferences` 两张表
- [x] 新增 API 配置中心：`GET/POST/PATCH/DELETE /api/ai/configs` + `PUT /api/ai/configs/defaults`
- [x] 新增 API Key 加密存储能力：`apps/api/src/ai-config-crypto.ts`（AES-256-GCM）并补齐单测
- [x] AI 请求链路升级：`aiConfigId` 优先级生效（`aiConfigId > 默认配置 > provider`），缺配置时显式报错
- [x] AI Tutor 支持 `runtimeConfig` 透传（OpenAI 兼容 Base URL / API Key / Model），自定义配置失败不回退模板
- [x] 首页新增“我的 AI 配置（OpenAI 兼容）”卡片：支持 CRUD、默认项设置、密钥掩码展示
- [x] 做题页 `AI题解/AI判题` 选择器升级：支持用户配置下拉 + 系统 provider 兼容项，且两者独立持久化
- [x] 本轮校验通过：`npm run check -w @leetcodepro/api`、`npm run test -w @leetcodepro/api`、`npm run check -w @leetcodepro/web`、`npm run check -w @leetcodepro/ai-tutor`

### 2026-04-14
- [x] 完成 `GET /api/progress/overview` 聚合接口，支持 `timezone` 参数校验与 90 天窗口统计
- [x] 新增 `apps/api/src/progress-metrics.ts` 与单元测试，覆盖重复 AC 计数、标签去重、时区分桶与连续日期补齐
- [x] 进度页改造为客户端仪表盘：接入浏览器时区、ECharts 热力图、Top8 标签雷达图
- [x] 前端新增 `progress-api` 类型与请求封装，进度页支持 loading/error 重试
- [x] 验证通过：`npm run test -w @leetcodepro/api`、`npm run check -w @leetcodepro/api`、`npm run check -w @leetcodepro/web`
- [x] 题库页展示优化完成：`/problems` 改为按题型分组展示（首标签为题型，空标签归“未分类”），组内按 `简单->中等->困难` 且同难度按题号升序
- [x] 题库“题目标识”列替换为“知识点”标签组件，显示每题全部标签；README/ToDo 同步更新验证步骤
- [x] 判题器数据增强：`submission_case_results` 新增 `actual_output`，`/api/submissions/:id` 新增 `failureCase`（输入/输出/期望/stderr）
- [x] 判题内存改为真实采集：每个 case 记录 `memoryKb`，提交结果展示峰值内存（可采集环境）
- [x] 前端判题结果重构：失败样例卡片 + 字符级 diff + 隐藏用例默认折叠；去除调试元信息展示
- [x] 前端布局自适应升级：`layout/top-nav` 改为全宽流式容器，减少超宽屏留白
- [x] 做题页新增可拖拽左右分栏：默认 `40/60`、最小宽度约束、比例 `localStorage` 持久化、双击恢复默认、移动端自动回退堆叠
- [x] 做题页分栏能力复用扩展：新增两组纵向可拖拽分栏（代码框/运行分析、题解笔记/AI题解），移动端自动回退堆叠
- [x] 修复失败样例展示不一致：当 `actualOutput` 缺失但 `stderr` 为 `Expected ..., got ...` 时，自动回填并展示“你的输出”
- [x] 修复“判题完成内存显示 `- KB`”：定位为 Judge 旧进程未重启导致，重启后 `memoryKb` 恢复为真实值
- [x] 判题内存采集增强：`sandbox-runner` 增加 `memory.current` 兜底，并支持 marker 粘连场景解析
- [x] Judge 防复发改进：`dev` 脚本优先 `node --watch`（`EMFILE` 自动回退 `node server.mjs`），`/health` 新增 `startedAt` 与 `memoryProbeVersion`
- [x] README 新增 Judge 重启与内存校验指引（含提交查询与 `submission_case_results.memory_kb` 入库验证）
- [x] 新增题目掌握度聚合模块：统一输出 `summary + tracks`，口径覆盖“一遍过/两次过/多次过/最近状态”
- [x] 扩展题库接口：`GET /api/problems` 返回 `masterySummary`；新增 `GET /api/problems/:slug/mastery`
- [x] 题库页状态列升级为真实掌握度徽标，并显示最近状态（`最近: AC/WA/...`）
- [x] 题目页新增“题目掌握度”卡片，展示 `core-cpp/core-python/acm-cpp/acm-python` 四轨道细分并在提交终态后自动刷新
- [x] 新增索引迁移：`007_add_submissions_mastery_lookup_index.sql`（`submissions(user_id, problem_id, mode, language, created_at, id)`）
- [x] 验证通过：`npm run test -w @leetcodepro/api`、`npm run check -w @leetcodepro/api`

### 2026-04-04
- [x] P0 收尾复测：`npm run e2e:minimal` 全链路通过（题目查询 -> 提交 -> 判题 -> AI 找 Bug）
- [x] 确认 `P0-5` API 聚合上下文闭环：优先使用提交实录补齐 `code/status/runtime/passedCount/failureSignals`
- [x] P1-1 完成：新增 `scripts/e2e/ai-review-quality-eval.mjs` 与 `npm run e2e:ai-quality`，首轮评分 `overallScore=100`
- [x] P1-2 完成：新增 `scripts/e2e/prompt-injection-attack.mjs` 与 `npm run e2e:prompt-injection`，对抗评分 `overallScore=100`
- [x] API 注入防护加固：`apps/api/src/ai.controller.ts` 新增注入片段脱敏（`errorMessage/failureSignals`）


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
- [x] 新增最小 E2E 联调脚本（`npm run e2e:minimal`），覆盖题目查询/提交/判题/AI 找 Bug 全链路
- [x] E2E 脚本补充关键日志/退出码/依赖健康检查，失败时输出 Judge/AI 诊断快照

### 2026-03-31
- [x] AI 找 Bug 专家化改版：放宽过度格式约束与强制回写逻辑，改为“直接定位问题 + 明确修改点 + 快速验证”，仅保留“禁止整题完整答案”最小红线
- [x] AI 找 Bug 兜底文案统一升级：`ai-tutor-fallback` 与 `api-fallback` 都输出直接定位与可执行修改建议，避免固定模板套话
- [x] README/ToDo 同步更新本次 AI 找 Bug 验证预期与排查说明
- [x] 修复 AI 找 Bug 输出截断：API/前端 SSE 增强尾包解析，流式未完成时自动补一次同步请求，确保展示完整内容
- [x] AI 找 Bug 状态分流：`AC` 返回“通过后优化评审”（复杂度/规范/边界），非 `AC` 返回“错误定位 + 修改建议”
- [x] AI 找 Bug 面板交互优化：固定高度显示 + 滚轮滚动查看完整输出，避免长文本挤压布局
- [x] 修复 AI 题解 MiniMax 流式稳定性：题解前端 SSE 解析增强（支持 CRLF/尾包补齐），疑似截断时自动同步补齐
- [x] AI 找 Bug 布局重构：参考题解展示方案放大为右侧主区域，头部展示模型/Provider/来源，正文固定高度滚动
- [x] AI 找 Bug 抗截断增强：MiniMax 默认二次同步补齐 + bug-find 专用超时（`AI_TUTOR_REVIEW_TIMEOUT_MS`）+ review token 上限提升
- [x] 修复 AI 题解 MiniMax 套话回退：题解路径新增一次应用层补偿重试，降低 `source=ai-tutor-fallback` 概率
- [x] 移除 AI 题解模板兜底：MiniMax 失败时直接错误提示（HTTP 502 / SSE error），前端不再展示套话题解
- [x] 修复 AI 题解 `api-error/Abort`：API 增加题解专用超时配置（`AI_TUTOR_SOLUTION_MINIMAX_TIMEOUT_MS`），并将 Abort 显式映射为“题解请求超时”提示
- [x] 修复 AI 题解错误透传：API/前端统一归一化 `This operation was aborted`/timeout 类错误，改为中文可读提示，避免原始英文暴露
- [x] 提升 AI 找 Bug 输出上限：新增 `VLLM_REVIEW_MAX_TOKENS` / `MINIMAX_REVIEW_MAX_TOKENS`（默认 `2200/3000`），避免 review 文本被 token 上限截断

### 2026-03-30
- [x] 前端题库页切换为 API 拉取（去除静态占位题单）
- [x] 题目详情页切换为 API 题面/样例渲染（去除静态占位题面）
- [x] 打通前端真实提交按钮：`POST /api/submissions` + 轮询 `GET /api/submissions/:id`
- [x] 打通前端“AI 找 Bug”按钮：`POST /api/ai/bug-find` 并展示 guidance/source
- [x] README 增补“前端页面实测步骤 + QUEUED 排查”说明
- [x] 修复 Judge 镜像缺失缓存问题（拉取镜像后无需重启即可重新判题）
- [x] AI Tutor 新增 `POST /bug-find/stream`，API 新增 `POST /api/ai/bug-find/stream` 并完成前端 SSE 渲染
- [x] 新增数据库迁移 `002_add_ai_sessions_and_messages.sql`，打通 `ai_sessions` / `ai_messages` 落库
- [x] 新增内置 seccomp profile：`infra/seccomp/judge-seccomp.json`，Judge `/health` 增加 `seccompProfile`
- [x] `minimal-flow` 升级支持 `--ai-review-mode stream|sync`
- [x] 新增连续稳定性脚本：`npm run e2e:stability`
- [x] 新增产品演示脚本：`npm run demo:mvp`
- [x] 实机验收：`npm run e2e:stability` 连续 10 次通过（全部 `AC` + AI SSE 正常）
- [x] 实机验收：`npm run demo:mvp` 两个演示场景通过（`AC`/`WA`）
- [x] AI Tutor 接入远程 vLLM 配置（`VLLM_BASE_URL` / `VLLM_API_KEY` / `VLLM_MODEL` / `CHAT_TEMPLATE_TYPE`）
- [x] AI 服务新增 provider 健康字段与 vLLM 故障自动回退（`source=ai-tutor-fallback`）
- [x] 新增 AI provider 按请求切换：前端可选 `vLLM/MiniMax`，API/AI Tutor 全链路透传并回显 `provider`
- [x] 修复 MiniMax 点评“固定套话”问题：保留诊断文本并仅打码代码片段（避免整段回退为固定三问）
- [x] 修复 MiniMax 经 API 代理超时回退：新增 `AI_TUTOR_MINIMAX_TIMEOUT_MS` 并按 provider 使用差异化超时
- [x] 修复 MiniMax 直连读超时回退：`MINIMAX_TIMEOUT_SECONDS` 默认提升到 60s，并增加读超时二次重试
- [x] 修复 MiniMax 题解流式仍回退模板：API 代理超时默认提升至 `AI_TUTOR_MINIMAX_TIMEOUT_MS=90000`
- [x] 修复 MiniMax 题解体验：清理 `<think>` 推理块、默认 `MINIMAX_SOLUTION_MAX_TOKENS=3000`、前端题解切换为 Markdown 渲染
- [x] 增强 MiniMax 网络稳定性：AI Tutor 对 `TransportError`（ReadTimeout/RemoteProtocolError 等）自动重试
- [x] AI 找 Bug 质量升级：API 自动注入提交运行信号（语言/模式/通过率/失败信号），AI Tutor 要求证据化诊断，前端点评区改为 Markdown 渲染
- [x] AI 找 Bug 风格重构：从“引导式套话”切换为“代码审查式定位”（错误结论+证据+修复方向）
- [x] AI 找 Bug 兜底升级：无论 `ai-tutor-fallback` 还是 `api-fallback`，都基于代码与报错输出“行号级”可疑点定位
- [x] 前端样式升级为 LeetCode 风格：统一设计 token、重构顶部导航、题库表格化列表、做题页题面/编辑区布局与状态控件样式
- [x] 前端验收通过：`npm run check -w @leetcodepro/web`、`npm run build -w @leetcodepro/web`（构建阶段仅提示 ESLint 未安装，不阻塞产物输出）
- [x] 修复前端 chunk 缓存串扰：开发/生产构建目录隔离（`.next-dev` / `.next`）并补充 `npm run clean -w @leetcodepro/web`
- [x] 调整做题页右侧布局层级：将“操作按钮 + 判题/AI 面板”下移为编辑器下方独立卡片，优化信息流顺序
- [x] 前端第二轮 LeetCode 风格增强：题面/代码区引入 tab 布局、题库列表补充通过率列与头部信息条、运行分析面板层级优化
- [x] 新增夜间/白天主题切换：右上角按钮切换 + `localStorage` 持久化 + Monaco 主题联动（`vs-dark/vs`）
- [x] 新增提交记录功能：API `GET /api/submissions/history/by-problem/:slug` + 题目页“提交记录”tab 展示历史提交状态与运行结果
- [x] 新增提交记录回放联动：点击历史提交先确认后回放，自动回填编辑器代码并同步显示该次提交的判题结果、AI 找 Bug 与 AI 题解（无历史题解时空态+手动生成）
- [x] 提交记录回放确认交互升级：用站内居中模态弹窗替换浏览器原生 `confirm`，支持 `Esc/遮罩` 关闭与加载中禁用
- [x] 新增题解功能：AI Tutor `POST /solution` / `POST /solution/stream`、API 代理 `POST /api/ai/solution` / `POST /api/ai/solution/stream`、前端“题解”tab 流式展示
- [x] 题解与提交记录联调验收通过：`npm run check -w @leetcodepro/api`、`npm run check -w @leetcodepro/web`、`npm run check -w @leetcodepro/ai-tutor`
- [x] 新增笔记映射功能：API `POST /api/notes/upload` / `GET /api/notes/problem/:slug`，支持 Markdown 分段匹配题目并落库 `user_notes`、`user_problem_notes`
- [x] 前端首页支持 `.md` 全局上传（上传一次全题可用）；题解页优先展示个人笔记，当前题无笔记时自动生成 AI 题解补充
- [x] 笔记题解联调验收通过：`npm run check -w @leetcodepro/api`、`npm run check -w @leetcodepro/web`
- [x] 修复大文件上传报错：API `json/urlencoded` body limit 提升至 `4mb`（解决 `PayloadTooLargeError`）
- [x] 修复缺表报错：执行 `003_add_user_notes.sql` 迁移并在 notes 接口增加缺迁移友好提示（`relation "user_notes" does not exist`）
- [x] 题解页“我的题解笔记”支持 Markdown 渲染（标题/列表/代码块/表格）
- [x] 核心代码模式对齐 LeetCode：C++ 默认 `class Solution` 模板（无头文件），并调整编辑器切换为“`ACM` 自动加载模板、切回 `core` 恢复核心代码”
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
- [x] 修复核心判题元数据缺失：补齐 `linked-list-cycle-ii` 与 `intersection-of-two-linked-lists` 的 `class Solution` 方法签名，解决 `Invalid solution metadata for class Solution`
- [x] 修复 `linked-list-cycle-ii` 判题口径：由“节点值”改为“入环索引”比较，并修正错误隐藏用例期望值（`head=[1,2], pos=0`）
- [x] 笔记匹配规则优化：支持 `题号.题目名`/`题号.题目名（附注）` 作为题目边界，按“两个题号行之间内容”归属前题
- [x] 新增 API 单元测试：`notes-matcher` 覆盖题号边界切分与标题括号后缀匹配
- [x] 新增后台判题数据接口：`GET /api/admin/problems`、`GET /api/admin/problems/:slug/judge-data`（`x-admin-key` 鉴权）
- [x] 新增后台界面：`/admin/problems`，支持按题查看完整判题用例（公开/隐藏、权重、输入、期望输出）
- [x] 顶部导航新增“后台”入口，并保持 LeetCodePro 视觉风格一致
- [x] 新增鉴权单元测试：`apps/api/src/admin-auth.test.ts`
- [x] README 与 `.env.example` 同步更新后台验证步骤与 `ADMIN_API_KEY` 配置

### 2026-04-19
- [x] 修复 AI 判题失败样例透传：`apps/api/src/ai.controller.ts` / `services/ai-tutor/app/main.py` 新增 `failureCase` 结构（输入/你的输出/期望输出/stderr/是否隐藏），AI 与 fallback 诊断不再只依赖泛化 `errorMessage`
- [x] 修复 `minimum-window-substring` 类 WA 套话：fallback 诊断优先引用结构化失败样例，并对最小覆盖子串补充“窗口收缩/最优答案更新时机”专项提示
- [x] 优化 AI 判题 / AI 题解 等待体验：AI Tutor SSE 新增 `phase` 事件，前端展示“准备上下文 / 检索证据 / 请求模型 / 整理结果”阶段与等待时长
- [x] 修复 AI 题解流式代理稳健性：`apps/api/src/ai.controller.ts` 的 `solution/stream` 改为统一边界解析并透传 `phase` 事件，减少尾包丢失
- [x] 按 OpenAI 风格重构 AI 流式协议：`services/ai-tutor/app/main.py` 优先走 `/responses` 真流式，前端支持 `response.output_text.delta` / `response.reasoning_summary_text.delta` / `response.completed`
- [x] 明确思维展示边界：遵循 OpenAI 官方口径，不展示原始 CoT，仅展示 `reasoning summary`；AI 判题保留苏格拉底式 guardrail
- [x] 补齐 AI 前端交互细节：`apps/web/components/problem-side-panel.tsx` 为 `AI题解/AI判题` 新增 `thinking` 折叠/展开，并对流式 Markdown 做未闭合代码块补全渲染，避免正文等到结尾才整体显示
- [x] 优化 AI 回答视觉：参考聊天助手 `ChatBox` 风格，将 `AI题解/AI判题` 重构为统一助手卡片，补齐 AI 徽标、状态标签、thinking 折叠面板与正文气泡样式
- [x] 联调验收通过：`npm run check -w @leetcodepro/api`、`npm run check -w @leetcodepro/web`、`npm run check -w @leetcodepro/ai-tutor`

## 5. 当前阻塞项

- 暂无 P0 阻塞项（`gcc:13-bookworm` 镜像相关问题已完成处理并移出阻塞）

## 6. 下一步（立即执行）

- [x] P1-2：完成 Prompt Injection 对抗测试脚本 + 阻断规则 + 报告沉淀
- [x] P2-1：完成进度页热力图与能力雷达图（接口 + 前端 + 测试 + 文档）
- [ ] P2-2：根据真实用户反馈迭代雷达维度映射（是否固定基础能力类目）
