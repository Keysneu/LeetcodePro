# LeetCodePro（MVP 第一阶段）运行与验证指南

更新时间：2026-04-26（Asia/Shanghai）

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
- 题目页编辑器工具栏已新增图标化 `还原模板`：仅作用于当前模式与语言，支持一键恢复默认起步代码
- 前端题目页已打通真实交互：支持题目列表 API 拉取、题面详情展示、提交判题、结果轮询、AI **SSE 流式点评**
- 首页新增“我的 AI 配置中心”：支持 OpenAI 兼容配置的新增/编辑/删除，并可分别设置 `AI判题` / `AI题解` 默认配置
- 前端展示已完成一轮 LeetCode 风格重构：统一深色 token、顶栏导航、题库表格化题单、题面/编辑区卡片层级、按钮与状态标签样式
- 前端展示已完成第二轮 LeetCode 风格优化：题面/代码区增加 tab 结构、题库表头与通过率列优化、运行分析面板层级强化
- 前端布局已升级为全站流式扩展：移除 `1400px` 固定上限，并按断点自适应利用大屏空间
- 题库页展示已优化为“按题型分组 + 组内难度排序”，并将原“题目标识”列替换为“知识点”标签组件（显示该题全部标签）
- 题库页已支持 URL 驱动模糊搜索：`/problems?q=关键词` 可按题号、题名、slug、标签进行大小写无关的部分匹配，刷新后保留搜索状态
- 已支持夜间/白天主题切换（右上角按钮），并持久化到 `localStorage`
- 题目详情页已打通“提交记录/题解”功能：提交记录展示历史提交与运行结果，题解支持 AI SSE 流式生成结构化讲解、Core 模式完整代码与 ACM 模式完整代码
- 提交记录支持“回放联动”：点击历史提交可先确认再回放，自动回填当时代码与判题结果，并联动展示该次提交的 AI 找 Bug / AI 题解
- 提交记录回放确认已升级为站内模态弹窗（支持 Esc/遮罩关闭与加载态禁用），不再使用浏览器原生 `confirm`
- 题解功能已支持用户 Markdown 笔记上传与自动映射：在首页上传一次后，可按题目提取个人笔记并在“题解”tab优先展示，且按 Markdown 格式渲染
- 题目页右侧工作区布局已调整为上下分区：上方仅代码编辑器，下方独立展示操作按钮与判题结果（AI 找 Bug 已迁移到左侧“AI判题”页签）
- 做题页内部分栏已扩展为可拖拽比例：支持“代码框/运行与分析”纵向拖拽，比例持久化并支持双击恢复默认
- 修复题目页代码编辑区可见性回归：编辑器高度改为 `flex` 自适应，避免在桌面端被“顶上去”后不可见
- 修复代码编辑区顶部工具栏挤压回归：模式/语言栏改为固定不收缩，Monaco 编辑区改为自适应填充，避免出现“编辑区被顶上去”导致不可操作
- 做题页桌面端布局已优化为左右等高视口壳层：左侧切换 `描述/提交记录/笔记题解/AI题解/AI判题` 不再导致高度突变，左右区域改为各自内部滚动
- 做题页三次重构已完成：左侧拆分“笔记题解/AI题解/AI判题”独立页签，`AI题解` 与 `AI判题` 模型选择独立记忆，且仅“描述”页签展示题目标题与徽标
- 做题页四次优化已完成：左侧 AI 页签移除调试元信息（模型/来源/服务返回模型/会话/当前提交），右侧“判题结果”改为横向紧凑统计条
- 做题页左侧页签视觉已按参考图升级：顶部改为圆角胶囊式导航，`提交记录/笔记题解/AI题解/AI判题` 头部与内容卡片层级同步增强
- 做题页左侧页签滚动行为已修正：`描述/笔记题解/AI题解/AI判题` 的顶部首卡会和正文一起参与滚动，不再出现“头部固定、下面单独滚动”
- 做题页桌面端布局已进一步紧凑化：工作台外边距、左右分栏间距、右侧上下分栏占位同步收紧，首屏可见内容明显增多
- 做题页与顶部 `LeetCodePro` 导航栏之间的空白已进一步收紧：题目描述区与右侧编辑区整体更贴近顶栏，但该调整仅作用于做题页，不影响题库/进度/后台页的默认节奏
- 做题页题面/编辑区已统一采用紧凑控件基线：标题卡、页签、下拉框、按钮、徽标、结果卡片与 Monaco 外框全部降噪收紧，减少“卡片套卡片”的空耗空间
- AI 页签头部已进一步收敛：原独立的“标题说明卡 + leetPro 结果卡”已合并为单卡结构，模型选择与 `生成题解/AI判题` 操作直接放进 `leetPro` 组件头部
- AI 页签布局已再次收敛：`leetPro` 主卡固定占位，不再随页签整体滚动；仅 `thinking` 与 `正文回答` 区域各自内部滚动，且卡头文案已移除、模型选择与主按钮同步完成美化
- AI 工具条视觉已再简化：去掉外层大胶囊包裹，模型选择器与主按钮缩小为更轻、更紧凑的一行控件
- 左侧顶部页签导航已改为满宽铺开：胶囊容器会占满左侧组件宽度，5 个页签按等分布局，不再只占左半区
- 左侧顶部页签已与主面板融为一体：不再单独悬浮成一枚独立组件，而是以内嵌式顶部导航条的形式贴合在左侧主卡内部
- 判题结果已支持失败样例可视化：展示输入/输出/期望输出，输出对比按字符级红绿高亮；隐藏用例默认折叠可手动展开
- 失败样例展示已增强兼容：当历史数据缺少 `actualOutput` 时，会从 `Expected ..., got ...` 错误信息中自动回填“你的输出”
- 判题内存已改为真实采集（提交结果展示峰值内存 KB），不再固定为空
- 核心代码模式已对齐 LeetCode 风格：C++ 默认模板为 `class Solution` 成员函数，用户无需手动编写头文件
- 修复核心模式元数据缺失：`linked-list-cycle-ii` 与 `intersection-of-two-linked-lists` 已补齐 `Solution` 方法签名，避免提交时报错 `Invalid solution metadata for class Solution`
- 修复 `linked-list-cycle-ii` 判题语义与样例数据：核心模式按“入环索引”比较结果，且修正该题错误隐藏用例期望值（`head=[1,2], pos=0`）
- 修复核心模式输入解析兼容：`core` 运行时支持解析 Markdown 反引号包裹参数（如 ``nums = `[0,1,0,3,12]` ``），`void + 引用参数`（如 `move-zeroes`）可正确返回变更后的数组
- 修复核心模式单参数位置输入兼容：当公开样例输入为纯字面量（如 `container-with-most-water` 的 `[1,8,6,2,5,4,8,3,7]`）时，`core` 运行时会自动映射到第一个形参，不再误判为空数组
- 修复 core/acm 判题兼容性细节：补齐 `copy-list-with-random-pointer` 元数据、修正 `merge-two-sorted-lists` 旧参数别名、修复部分题目测试数据格式与期望值错误（已提供迁移 `010_fix_core_acm_judge_case_data.sql`）
- ACM 模式已升级为 Hot100 全量适配：判题侧按题目参数类型统一将 `key=value` 样例转换为标准 stdin（数组/矩阵/链表/树/设计题）
- ACM 判题结果比较已支持多解语义归一：典型无序输出题（如 `3sum`、`group-anagrams`）不再因顺序差异误判
- 新增全量模式隔离巡检脚本：`npm run verify:judge-modes`，可一次性扫描 Hot100 全题的 `acm` 与 `core`（Python/C++）判题链路并输出报告到 `artifacts/judge-mode-isolation-report.json`
- 编辑器模式切换行为已更新：切到 `ACM` 会自动加载 ACM 起步模板；切回 `core` 会恢复该题在核心模式下编辑过的代码
- 编辑器工具栏支持当前缓冲区一键恢复默认模板：`core` 恢复为题目官方起步模板，`ACM` 恢复为标准输入输出起步模板，并使用站内弹窗确认覆盖
- 做题页 ACM 代码区展示已精简：移除代码框内 `ACM 输入提示（stdin）` 浮层，避免与编辑区争抢空间
- 题面描述区支持按当前编辑模式切换展示：`core` 展示函数式样例，`acm` 展示标准输入输出规范与 ACM 示例输入
- 数据库已扩展题目 ACM 字段：`acm_input_spec/acm_output_spec/acm_sample_input/acm_sample_output`，并在 `db:seed` 自动回填
- 新增后台判题数据看板：支持按题查看判题使用的完整测试数据（公开/隐藏用例、权重、输入、期望输出）
- 新增进度页可视化：`/progress` 已接入近 90 天打卡热力图、Top8 标签能力雷达图，以及“掌握度总览 + 待复习题目 Top10”
- 题库页与进度页中的题目入口已改为默认新开标签页，返回列表时无需重新展开或重新定位题目列表
- 新增进度聚合接口：`GET /api/progress/overview?timezone=<IANA>`（热力图按 AC 提交次数累计，雷达图按标签 AC 覆盖率计算，并返回掌握度聚合块）
- 题目掌握度口径已重构：采用遗忘曲线（`1/3/7/14/30` 天）+ 近 7 天连续 AC 规则，状态改为 `UNTOUCHED/LEARNING/REINFORCING/MASTERED/REVIEW_DUE`
- 掌握度仅统计 C++ 提交，保留 `core/acm` 双模式轨道；Python 提交仍保留在提交记录与判题链路
- 题库“已做题”口径已调整：同一题只要 `core` 或 `acm` 任一支持模式的最新有效 C++ 提交为 `AC`，就会在题库显示为已做；若只完成一个模式，复习信号会提示“单模式已做题”
- 待复习列表已临时隐藏历史藏数据：当前 `/progress` 只展示逾期小于 10 天的待复习记录，逾期 10 天及以上的旧记录暂不计入列表与数量；后续新复习间隔仍保留 `14/30` 天扩展能力
- 做题页“运行与分析”已改为 LeetCode 风格双标签结构：`测试用例 / 测试结果` 二选一展示；测试用例面板支持查看官方示例，并可在前端本地新增/编辑/删除自定义 Case
- 测试用例面板中的单行字段（如 `nums`、`期望输出`）已压缩为更紧凑的输入卡，优先单行展示，减少纵向占用
- 题目页顶栏中部操作组已升级为 `刷新结果 / 运行测试 / 提交`：`运行测试` 会同步执行当前编辑器代码 + 右侧测试用例面板中的自定义 Case，不写 `submissions`；`提交` 仍按正式判题链路走 `写库 -> RabbitMQ -> Judge Dispatcher`
- `运行测试` 的 ACM 模式已改为直接使用测试用例面板中的标准输入文本作为 `stdin`；不会再把 ACM 输入误当作 core 样例格式做二次转换
- 左侧 `AI判题` 已支持两类上下文：既可分析正式 `提交结果`，也可直接分析右侧 `运行测试` 的自定义 Case 结果；运行测试场景下不依赖数据库 `submissionId`
- ACM 模式描述区已移除“当前题面展示：ACM 模式规范（标准输入输出）”提示；代码工作区顶部也已移除“桌面端固定工作台...”说明文案
- ACM 模式失败样例中的 `期望输出/你的输出` 已增加展示清洗：若后端返回的是带双引号包裹的 JSON 字符串，前端会自动去掉外层引号后再展示
- 题面与测试数据展示已增加历史脏数据清洗：若旧题库把数组/对象字面量写成 ``nums = `[0,1,0,3,12]` `` 这类反引号包裹形式，前端会自动去掉多余反引号；`db:seed` 也会同步清洗后再入库
- 题目页“运行与分析”已移除掌握度卡片，题库页状态副文案改为复习信号（今天复习 / X 天后复习 / 已逾期 X 天）
- 题目掌握度接口已升级：`GET /api/problems` 返回新 `masterySummary` 字段；`GET /api/problems/:slug/mastery` 返回 `core-cpp/acm-cpp` 双轨明细
- 前端构建目录已隔离：`next dev` 使用 `.next-dev`，`next build/start` 使用 `.next`，减少 chunk 缓存串扰
- AI 找 Bug 链路已接通 `vLLM/MiniMax 实时调用 + SSE 流式输出 + ai_sessions/ai_messages 落库`（可返回 `sessionId`）
- AI 判题上下文已增强：失败样例会携带 `输入 / 你的输出 / 期望输出 / stderr / 是否隐藏用例` 进入 AI 与 fallback 诊断，避免只返回泛化套话
- AI 判题 / AI 题解 请求阶段不再占用卡头空间：生成过程只保留 `thinking` 区的思考时长与正文流式刷新
- AI 流式协议已向 OpenAI Responses 语义事件靠拢：前端支持 `response.output_text.delta`、`response.completed` 与 `response.reasoning_summary_text.delta`
- AI 思维展示遵循 OpenAI 官方边界：不展示原始 chain-of-thought，仅展示 `reasoning summary`（模型支持时）
- AI 页签前端已支持 `thinking` 折叠/展开：`AI题解` 与 `AI判题` 的推理摘要可单独收起，不影响正文继续流式更新
- AI Markdown 渲染已升级为“流式友好”模式：流到一半时会先补齐未闭合代码块再渲染，避免正文一直等到结尾才整体成型
- AI 回答展示已升级为轻量“双流面板”样式：`AI题解` / `AI判题` 统一拆分为 `thinking` 与回答两个实时流式区域，移除头像徽标、内层大卡片和重复描边
- `thinking` 面板支持 `展开/收起 + 放大/标准视图`，且在流式生成过程中保持实时追加渲染
- 当前前端会优先使用独立 `reasoningSummary` 流；若模型把思考与回答混在同一段文本中，也会尝试按 `<think>...</think>` 或 `Thought ... Final Answer ...` 结构自动拆分
- AI 页签布局已收敛为更轻的工具区 + 单主卡片：移除重复说明文案、卡头阶段提示和状态胶囊，卡片顶部只保留 `leetPro AI` 品牌行与操作控件
- AI 判题流式链路已补充 `response.output_text.replace` 兜底：当上游安全清洗导致正文不再是纯追加关系时，前端会按快照替换继续实时刷新
- AI 判题已放宽代码展示策略：允许返回用于定位问题的短代码片段，仅在检测到“整题完整实现”时才继续做打码
- AI 模型适配已收敛为统一 OpenAI-compatible 架构：vLLM / MiniMax / DeepSeek / 首页自定义配置共用同一套 runtime config 与 SSE 语义事件，前端不再按 provider 做流式兜底特判
- AI 题解支持输出 Core 模式与 ACM 模式完整参考代码：包含题意、思路、不变式、复杂度、两种模式代码、陷阱和验证用例
- AI Tutor 已集成 `RAG 方法论 + LlamaIndex（知识切分检索）+ LangChain（提示词编排）`，并保持现有 API/SSE 协议不变
- AI Tutor RAG 已接入用户上传笔记：读取 `user_problem_notes.content_md` 并参与检索增强（按题目 slug 关联）
- API 新增 `GET/POST/PATCH/DELETE /api/ai/configs` 与 `PUT /api/ai/configs/defaults`，并支持 `aiConfigId` 优先路由自定义 AI
- Judge 默认运行在 `docker` 沙箱模式：禁网、只读根文件系统、非 root 用户、`memory/cpu/pids` 限制（cgroups）+ 自定义 seccomp profile
- Judge 开发模式默认优先 `node --watch`，若系统文件监听数不足（`EMFILE`）会自动回退到 `node server.mjs`
- Judge 健康检查新增诊断指纹：`startedAt`、`memoryProbeVersion`（用于判断是否在跑旧实例）
- C++ 判题依赖镜像 `gcc:13-bookworm`，Python 判题依赖镜像 `python:3.12-slim`
- 已提供 `P0-6` 验收脚本：
  - 连续 10 次稳定性验收：`npm run e2e:stability`
  - MVP 演示脚本：`npm run demo:mvp`
- 2026-04-04 复测 `npm run e2e:minimal` 通过，P0 主链路稳定（题目查询 -> 提交 -> 判题 -> AI 找 Bug）
- 新增 P1-1 质量评估脚本：`scripts/e2e/ai-review-quality-eval.mjs`（命令：`npm run e2e:ai-quality`）
- 新增 P1-2 对抗测试脚本：`scripts/e2e/prompt-injection-attack.mjs`（命令：`npm run e2e:prompt-injection`）
- API Review 路径新增注入片段脱敏：对 `errorMessage/failureSignals` 做提示词注入关键词屏蔽，避免回显恶意指令

当前未完成范围：
- 推荐系统 V2（个性化推荐全链路）尚未进入 MVP 范围
- RAG 当前为 V1（内置知识包检索增强）；题库级离线向量化与外部向量数据库仍未接入

临时验证方式（当前阶段）：
- 方式 A：使用前端题目页进行真实提交流程验证
- 方式 B：使用 `curl` 调用 API 创建提交，再轮询提交状态，并验证 AI SSE/会话落库
- 方式 C：进入后台看板核对每题判题数据（`/admin/problems`）
- 方式 D：打开进度页验证热力图与雷达图（`/progress`）
- 方式 E：打开题库与进度页验证掌握度状态与待复习列表（`/problems`、`/progress`）
- 方式 F：打开做题页验证左右等高与运行分析自适应交互（`/problems/:slug`）
- 方式 G：打开 `http://localhost:3000/problems?q=两数` 或 `?q=hash` 验证题库模糊搜索与 URL 状态保持
- 方式 H：在 `http://localhost:3000/problems` 或 `http://localhost:3000/progress` 点击任意题目，确认浏览器会新开题目标签页，原列表页保持原位置不丢失
- 方式 I：打开任意题目页后切到 `ACM` 模式，确认左侧描述区不再出现“当前题面展示：ACM 模式规范（标准输入输出）”，代码区标题下也不再出现“桌面端固定工作台...”提示
- 方式 J：在题目页右下工作区确认“运行与分析”顶部为 `测试用例 / 测试结果` 双标签；点击“测试用例”时只显示 Case 编辑区，点击“测试结果”时只显示运行结果或“请先执行代码”占位
- 方式 K：提交一个会触发失败样例的 ACM 答案，确认判题结果中的 `期望输出` 不再显示形如 `\"[24,12,8,6]\"` 的外层双引号，而是直接显示 `[24,12,8,6]`
- 方式 L：在题目页修改右侧本地测试用例后点击顶栏圆形 `运行测试` 按钮，确认结果区直接返回终态并展示逐条 Case 的输入/你的输出/期望输出；再点击 `提交`，确认仍走正式判题队列
- 方式 M：先执行一次 `运行测试`（不提交），再到左侧点击 `AI判题`，确认仍能返回基于本地测试结果的诊断建议
- 方式 N：打开 `http://localhost:3000/problems/move-zeroes`，确认题面“示例 1 / 示例输入 / 示例输出”里不再出现 ``nums = `[0,1,0,3,12]` `` 这种额外反引号，而是直接显示 `nums = [0,1,0,3,12]`
- 方式 O：打开 `http://localhost:3000/admin/problems?slug=move-zeroes`，确认后台“输入规范 / 判题测试用例”中的数组样例也不再显示多余反引号

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
NEXT_PUBLIC_DEFAULT_AI_PROVIDER=vllm
AI_TUTOR_TIMEOUT_MS=12000
AI_TUTOR_CUSTOM_CONFIG_TIMEOUT_MS=90000
AI_TUTOR_CUSTOM_CONFIG_REVIEW_TIMEOUT_MS=90000
AI_TUTOR_CUSTOM_CONFIG_SOLUTION_TIMEOUT_MS=300000
AI_TUTOR_CUSTOM_CONFIG_REVIEW_MAX_TOKENS=4096
AI_TUTOR_CUSTOM_CONFIG_SOLUTION_MAX_TOKENS=8192
AI_TUTOR_REVIEW_TIMEOUT_MS=30000
AI_TUTOR_SOLUTION_TIMEOUT_MS=300000
AI_TUTOR_REVIEW_MAX_TOKENS=2200
AI_TUTOR_SOLUTION_MAX_TOKENS=4096
AI_TUTOR_REVIEW_TEMPERATURE=0.2
AI_TUTOR_SOLUTION_TEMPERATURE=0.25
AI_CONFIG_ENCRYPTION_KEY=leetcodepro-dev-ai-config-key!!!
AI_TUTOR_RAG_ENABLED=true
AI_TUTOR_RAG_TOP_K=4
LLM_PROVIDER=vllm
VLLM_BASE_URL=http://127.0.0.1:18100/v1
VLLM_API_KEY=your_vllm_api_key
VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_MODEL=MiniMax-M2.7
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat
CHAT_TEMPLATE_TYPE=qwen
ADMIN_API_KEY=leetcodepro-admin-key
```

说明：
- `LLM_PROVIDER` 是 AI 服务默认 provider（当请求体不显式传 `provider` 时生效）。
- 系统内置 provider 均按 OpenAI-compatible 处理：`vllm`、`minimax`、`deepseek` 只提供各自的 `BASE_URL/API_KEY/MODEL`，请求参数统一由 `AI_TUTOR_*` 控制。
- API 代理不再按 provider 单独放宽超时；`AI_TUTOR_REVIEW_TIMEOUT_MS` 控制 AI 判题，`AI_TUTOR_SOLUTION_TIMEOUT_MS` 控制 AI 题解。
- 首页自定义 AI 配置（OpenAI 兼容）可单独用 `AI_TUTOR_CUSTOM_CONFIG_TIMEOUT_MS` / `AI_TUTOR_CUSTOM_CONFIG_REVIEW_TIMEOUT_MS` / `AI_TUTOR_CUSTOM_CONFIG_SOLUTION_TIMEOUT_MS` 放宽超时；DeepSeek / MiniMax 这类上游建议保持 `90s/90s/300s` 或更高。
- 首页自定义 AI 配置输出上限可单独用 `AI_TUTOR_CUSTOM_CONFIG_REVIEW_MAX_TOKENS` / `AI_TUTOR_CUSTOM_CONFIG_SOLUTION_MAX_TOKENS` 调整；DeepSeek 题解被截断时优先确认 `AI_TUTOR_CUSTOM_CONFIG_SOLUTION_MAX_TOKENS=8192`。
- 系统 provider 输出上限按请求类型控制：`AI_TUTOR_REVIEW_MAX_TOKENS` / `AI_TUTOR_SOLUTION_MAX_TOKENS`。
- 系统 provider 温度按请求类型控制：`AI_TUTOR_REVIEW_TEMPERATURE` / `AI_TUTOR_SOLUTION_TEMPERATURE`。
- `AI_CONFIG_ENCRYPTION_KEY` 用于加密存储用户自定义 AI 的 API Key，必须配置 32 字节密钥（支持 utf8/base64/hex）。
- 如果你的 `.env` 是在 AI 配置中心功能上线前创建的，里面可能没有 `AI_CONFIG_ENCRYPTION_KEY`；请手动补上后重启 `@leetcodepro/api`，否则首页新增 AI 配置会失败。
- `AI_TUTOR_RAG_ENABLED` 控制 AI Tutor 是否启用检索增强（默认 `true`）。
- `AI_TUTOR_RAG_TOP_K` 控制每次检索注入的知识片段数量（默认 `4`，建议 `3~6`）。
- AI Tutor 流式优先使用 `/chat/completions`；只有某个 Base URL 已成功使用 `/responses` 时，后续才缓存使用 `/responses`。
- AI 题解会输出结构化讲解，并分别给出 Core 模式与 ACM 模式完整参考代码、关键行说明和验证用例。
- 真实密钥只放本地 `.env`，不要提交到仓库。

### 3.4 安装依赖

```bash
npm install
npm run setup:python
```

### 3.4.1 初始化数据库（首次或需要重灌题库时）

```bash
cd /Users/moem/Desktop/vibecoding/LeetcodePro
docker compose up -d
npm run db:migrate -w @leetcodepro/api
npm run db:seed -w @leetcodepro/api
```

预期结果：

- 终端输出包含 `seed completed: 100 problems`
- 重新 seed 后，像 `move-zeroes` 这类题目的示例输入输出会以 `[0,1,0,3,12]` 这种干净格式入库，不再保留旧反引号包裹

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
- `applied migration: 005_add_actual_output_to_submission_case_results.sql`
- `applied migration: 006_fix_linked_list_cycle_ii_expected_output.sql`
- `applied migration: 007_add_submissions_mastery_lookup_index.sql`
- `applied migration: 008_add_user_ai_configs.sql`
- `applied migration: 009_add_acm_specs_to_problems.sql`
- `applied migration: 010_fix_core_acm_judge_case_data.sql`
- `database migration completed.`
- `seed completed: 100 problems, demo user demo@leetcodepro.local`

### 3.7 启动全部服务

```bash
npm run dev
```

说明：
- `@leetcodepro/judge-dispatcher` 开发脚本优先使用 `node --watch` 自动重启；若出现 `EMFILE`，会自动回退普通启动（此时需手动重启 Judge）。

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
- `provider` 为 `.env` 中默认 provider（例如 `vllm`）
- `providerKind` 为 `openai_compatible`
- `model` 为默认 provider 对应模型（例如 `Qwen/Qwen2.5-7B-Instruct`、`MiniMax-M2.7` 或 `deepseek-chat`）
- `ragEnabled` 默认为 `true`
- `langChainReady` / `llamaIndexReady` 为 `true`（依赖安装成功时）
- `ragTopK` 默认为 `4`

`judge-dispatcher` 预期示例：
- `status` 为 `ok`
- `executionMode` 为 `docker`
- `seccompProfile` 为非空路径（默认内置 `infra/seccomp/judge-seccomp.json`）
- `startedAt` 为 ISO 时间字符串（进程启动时间）
- `memoryProbeVersion` 为非空版本号（用于定位内存采集逻辑版本）
- `queueName` 为 `judge.submissions.v1`

### 4.2 题库接口验证

```bash
curl http://localhost:3001/api/problems
curl "http://localhost:3001/api/problems?q=两数"
curl "http://localhost:3001/api/problems?q=hash"
curl http://localhost:3001/api/problems/two-sum
```

预期：

- `items` 长度应为 `100`
- 列表按 `leetcodeId` 升序（例如开头是 `1. 两数之和`）
- `curl "http://localhost:3001/api/problems?q=两数"` 应至少命中 `two-sum`
- `curl "http://localhost:3001/api/problems?q=hash"` 应命中包含 `哈希表` 标签的题目
- 详情含 `description`、`inputSpec`、`outputSpec`、`sampleInput`、`sampleOutput`
- 详情同时返回 ACM 字段：`acmInputSpec`、`acmOutputSpec`、`acmSampleInput`、`acmSampleOutput`

### 4.3 提交与结果查询验证

示例 0：运行自定义测试（不同于提交，不写库、不入队）

```bash
curl -X POST http://localhost:3001/api/submissions/run-tests \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","language":"python","mode":"core","code":"def twoSum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        y = target - x\n        if y in seen:\n            return [seen[y], i]\n        seen[x] = i\n    return []","testCases":[{"title":"Case 1","input":"nums = [2,7,11,15], target = 9","output":"[0,1]"},{"title":"Case 2","input":"nums = [3,2,4], target = 6","output":"[1,2]"}]}'
```

预期：

- 返回体为同步终态，不会出现 `QUEUED/RUNNING`
- `item.status` 应直接为 `AC/WA/TLE/RE/CE` 之一
- `item.caseResults` 会逐条返回 `title/inputData/expectedOutput/actualOutput/status/runtimeMs/memoryKb`
- 本接口不会生成新的 `submission-id`，也不会影响“提交记录”

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

### 4.4 AI 找 Bug 验证

方式 A：SSE 流式（推荐）

```bash
curl -N -X POST http://localhost:3001/api/ai/bug-find/stream \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","submissionId":"<submission-id>","provider":"vllm","language":"cpp","mode":"core","status":"WA","runtimeMs":5,"memoryKb":1024,"passedCount":2,"totalCount":15,"errorMessage":"Expected [0,1], got []"}'
```

预期：
- 持续收到 `event: meta / phase / response.output_text.delta / response.completed / done`
- 在 `delta` 前应先收到 `event: phase`，阶段文案类似 `准备上下文 / 检索失败样例 / 请求模型 / 整理结果`
- `meta` 事件包含 `sessionId`、`source`、`providerKind=openai_compatible`、`model`
- `done` 事件中包含 `sessionId`、`source`、`providerKind`、`model`、`guidance`
- `source` 优先为所选 provider（`vllm` / `minimax` / `deepseek`），不可用时回退为 `ai-tutor-fallback`
- `guidance` 应直接给出“主要问题 + 具体修改点 + 快速验证”，并结合本次提交信号（报错/通过率/代码片段）定位错误
- 若该提交存在结构化失败样例，`guidance` 应引用“输入 / 你的输出 / 期望输出”中的至少一项，而不是只说“检查状态更新顺序”
- 若本次提交 `status=AC`，应返回“通过后优化评审”（复杂度/规范/边界鲁棒性），而不是继续找 bug

方式 B：同步接口（兼容）

```bash
curl -X POST http://localhost:3001/api/ai/bug-find \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","submissionId":"<submission-id>","provider":"vllm","language":"cpp","mode":"core","status":"WA","runtimeMs":5,"memoryKb":1024,"passedCount":2,"totalCount":15,"errorMessage":"Expected [0,1], got []"}'
```

预期：

- 返回 `guidance`
- `source` 为 `vllm`、`minimax`、`deepseek`、`ai-tutor-fallback` 或 `api-fallback`
- 返回 `providerKind=openai_compatible`
- 返回 `provider`（`vllm`、`minimax` 或 `deepseek`）
- 返回 `sessionId`
- `guidance` 为 Markdown 文本，前端“AI 找 Bug”区域会按 Markdown 渲染

会话落库验证（替换 `<session-id>`）：

```bash
psql postgresql://postgres:postgres@localhost:5432/leetcodepro -c "select id, session_type, created_at from ai_sessions where id = '<session-id>';"
psql postgresql://postgres:postgres@localhost:5432/leetcodepro -c "select role, left(content, 80) as preview, created_at from ai_messages where session_id = '<session-id>' order by created_at asc;"
```

### 4.4.1 RAG / LangChain / LlamaIndex 接入验证（本次新增）

1. 确认 AI 服务健康信息包含 RAG 状态字段：

```bash
curl http://localhost:8000/health
```

预期：
- 返回 `ragEnabled`（默认 `true`）
- 返回 `langChainReady=true`、`llamaIndexReady=true`（依赖安装成功）
- 返回 `ragTopK=4`（或你在 `.env` 配置的值）

2. 触发一次 AI 找 Bug，并观察 AI Tutor 终端日志：

```bash
curl -X POST http://localhost:8000/bug-find \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","submissionId":"demo-rag-1","provider":"vllm","language":"python","mode":"core","status":"WA","runtimeMs":5,"memoryKb":1024,"passedCount":2,"totalCount":15,"errorMessage":"Expected [0,1], got []","code":"def twoSum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]\n    return []"}'
```

预期：
- 接口正常返回 `guidance/source/provider`
- AI Tutor 日志出现 `[ai-tutor][review][rag] applied=true ...`（表示检索增强与编排链路已生效）

3. 验证可控降级（可选）：
- 在 `.env` 设置 `AI_TUTOR_RAG_ENABLED=false` 后重启 `npm run dev:ai`
- 再次调用上面的接口，功能仍可用（仅关闭检索增强，不影响主链路）

4. 验证“上传笔记 Markdown 已参与 RAG”（本次新增）：
1. 先上传笔记（任意包含当前题关键思路的 Markdown）：
```bash
curl -X POST http://localhost:3001/api/notes/upload \
  -H "content-type: application/json" \
  -d '{"filename":"leetcode-notes.md","markdownContent":"# Two Sum\n\n哈希表记录值到下标；先判断后写入，避免同元素重复命中。"}'
```
2. 对同一道题触发 `AI判题` 或 `AI题解`，观察 AI Tutor 日志中 `sources` 包含 `user-note-md`。
3. 预期：回答会引用你笔记中的关键点（例如“先判断后写入哈希”等），而不只给通用模板建议。

### 4.5 页面验证

浏览器打开并按下面步骤操作：

1. 打开 `http://localhost:3000/problems`，确认列表来自 API，且题目总数为 `100`。
2. 在题库页搜索框输入 `两数`，确认 URL 变为 `http://localhost:3000/problems?q=%E4%B8%A4%E6%95%B0`，列表仅保留匹配题，搜索框刷新后仍回显关键词。
3. 点击搜索框右侧“清空”，确认返回 `http://localhost:3000/problems`，并恢复全量 `100` 题。
4. 在题库页搜索框输入 `hash`，确认可命中带有 `哈希表` 标签的题目，说明搜索不仅匹配题名，也匹配标签/slug。
5. 在题库页搜索框输入一个不存在的关键词（例如 `zzzz-no-match`），确认页面出现“未找到匹配题目”的空态，并保留“清空搜索”入口。
6. 在题库页确认每题最后一列显示“知识点”标签（不再显示 slug 文本），并且题目按题型分组展示。
7. 在任意题型组中确认组内排序为 `简单 -> 中等 -> 困难`；同难度下题号升序。
8. 点击进入 `http://localhost:3000/problems/two-sum`。
9. 观察右侧编辑器默认代码，确认是 LeetCode 风格 `class Solution { ... }`，且没有 `#include` 头文件。
10. 在 `core` 模式下先输入任意标记（例如 `// core-mark`）。
11. 将模式切到 `ACM`，确认编辑器自动加载 ACM 起步模板（不是空白）。
12. 观察右侧代码卡片底部，确认 ACM 模式下不再出现“ACM 输入提示（stdin）”提示框。
13. 观察左侧“描述”页签中的“输入说明/示例输入”，确认已切换为 ACM 规范（标准输入格式）。
14. 再切回 `core`，确认第 10 步输入的 `// core-mark` 被恢复显示。
15. 在右侧 `测试用例` 页签把 `Case 1` 的输入或期望输出改成一个你能识别的新值。
16. 点击顶栏中部圆形 `运行测试` 按钮，确认右侧自动切到 `测试结果`，顶部出现 `运行测试` 标识，并逐条展示 `输入 / 你的输出 / 期望输出 / status`。
17. 观察 `运行测试` 结果，确认不会先经历 `QUEUED/RUNNING`，而是直接返回终态。
18. 不提交，直接切到左侧 `AI判题` 并点击 `AI判题`，确认也能拿到诊断结果；若本地 Case 失败，AI 文本应优先围绕该自定义 Case 的输入/输出差异给建议。
19. 在右侧编辑器保持默认代码或粘贴可 AC 代码，点击顶栏 `提交`。
20. 观察结果面板切换为 `提交结果`，且状态会从 `QUEUED/RUNNING` 变为终态（如 `AC`）；这一步应使用后端正式测试集，而不是第 15 步修改过的本地 Case。
21. 在左侧切到 `AI判题` 页签，将模型从 `vLLM（远程）` 切到 `MiniMax（远程）`。
22. 点击 `AI判题`，确认卡头不再出现“当前阶段”提示或“生成中”状态胶囊；等待过程只在 `thinking` 区与回答区内体现。
23. 若本次未 AC，确认 `AI判题` 返回“主要问题 + 具体修改建议 + 快速验证”；若已 AC，应返回“通过后优化评审”。
24. 若失败题目存在公开失败样例，确认 AI 文本会引用“输入 / 你的输出 / 期望输出”中的具体值，而不是只返回泛化模板。
25. 在左侧切到 `AI题解` 页签，将模型切换为 `vLLM（远程）` 后点击 `生成题解`。
26. 观察 `AI题解` 区域不再在卡头显示“正在检索题解笔记与题目上下文”等阶段文案，正文仍会继续流式出现。
27. 在 `AI题解` 或 `AI判题` 的 `thinking` 面板点击 `收起 thinking`，确认思考区可折叠；再次点击 `展开 thinking` 后，先前已流出的内容仍然保留。
28. 在 `thinking` 面板点击 `放大 thinking`，确认思考区高度明显增加且内部可滚动；再点击 `标准视图` 可恢复常规高度。
29. 让模型输出包含 Markdown 代码块或列表的长回答，确认正文会边流边渲染，而不是等到整个响应结束后才一次性排版完成。
30. 点击顶部导航右上角主题按钮，在“夜间/白天”之间切换 2 次，确认页面背景、卡片、文字和 Monaco 编辑器主题同步切换。
31. 在题目左侧确认存在 5 个页签：`描述 / 提交记录 / 笔记题解 / AI题解 / AI判题`。
32. 切换到 `提交记录/笔记题解/AI题解/AI判题`，确认都不显示题目标题与徽标；仅 `描述` 显示标题与徽标。
33. 在 `提交记录` 点击任意历史提交，确认站内弹窗出现；先点“取消”，编辑器与右侧判题结果保持不变。
34. 再次点击同一条历史提交并确认，验证编辑器代码回填、右侧判题结果同步为该次提交，且左侧页签不自动跳转。
35. 切到 `AI判题`，点击“AI判题”，确认返回 Markdown 诊断文本（会结合提交状态、失败样例与错误信息）。
36. 切到 `AI题解`，点击“生成题解”，确认可正常生成并与当前回放 `submissionId` 绑定。
37. 在 `AI题解` 与 `AI判题` 观察结果区，确认不再显示 `模型/来源/服务返回模型/会话/当前提交` 这些调试信息。
38. 返回首页 `http://localhost:3000/`，在“上传刷题笔记（全局）”卡片上传包含多题笔记的 Markdown。
39. 回到题目页 `笔记题解` 标签，确认“我的题解笔记”区域能展示当前题匹配内容。
40. 将浏览器拉宽到 `1920px` 或 `2560px`，确认 `题库/进度/后台` 页面主体区域随窗口扩展，不再被 `1400px` 限制。
41. 在 `http://localhost:3000/problems/two-sum` 桌面端确认左右默认分栏约 `46/54`，且左右主卡更贴近视口边界，拖拽中间分隔条可实时调整宽度；双击分隔条恢复默认比例。
42. 刷新页面确认分栏比例保持；将窗口缩到平板/手机宽度后确认自动切换为上下堆叠，且拖拽分隔条不显示。
43. 在题目页右侧确认“代码框/运行与分析”默认约 `62/38`，工具栏与编辑器边距已收紧，拖拽中间横向分隔条后高度实时变化，双击分隔条恢复默认比例。
44. 观察页面顶部导航与左右主工作区之间的距离，确认左侧题目描述区和右侧编辑区整体进一步上移，更贴近 `LeetCodePro` 顶栏，但没有与导航栏发生重叠。
45. 将窗口缩到平板/手机宽度，确认纵向分栏自动回退为普通上下堆叠且不显示拖拽条。
46. 在题目页左侧来回切换 `描述/提交记录/笔记题解/AI题解/AI判题`，确认左右面板整体高度保持一致，不出现跳变。
47. 在右侧“运行与分析”点击“收起/展开”，确认状态可切换且刷新后保持。
48. 在 `AI题解` 与 `AI判题` 分别切换不同模型（例如一个选 `vLLM`、一个选 `MiniMax`），刷新后确认两者各自保持，不互相覆盖。
49. 在桌面端把浏览器高度压缩到约 `700~850px`，确认右侧代码编辑器主体仍可见且可输入，不会被顶部挤出可视区域。
50. 在 `core/acm` 模式间来回切换 3 次，并切换 `C++/Python` 各 1 次，确认顶部“模式/语言”下拉与编辑区首行始终完整可见，不会出现被顶出或只剩一条细线。

预期：
- 提交后可看到 `status`、`runtimeMs/memoryKb`、`通过数` 的实时更新
- 点击 `运行测试` 后应直接看到终态，且结果区显示逐条自定义 Case 的输入/你的输出/期望输出
- 在只执行 `运行测试`、尚未正式提交时，左侧 `AI判题` 也应可用，并基于本地测试结果返回建议
- 点击 `提交` 后结果区应切回正式 `提交结果`；此时“刷新结果”只刷新提交，不刷新本地测试运行
- `AC` 或失败态都会稳定落在终态，不会长期卡在 `QUEUED`
- `AI判题` 页签返回非空文本，且会结合提交代码与错误信息直接定位可疑问题位置
- `AI判题` 在等待模型返回前，卡头不再展示“当前阶段 + 已等待时长”，避免挤占操作区
- `AI题解` 在等待正文前，卡头不再展示阶段文案，避免出现“正在检索题解笔记与题目上下文”这类长提示
- `AI题解` 与 `AI判题` 的 `thinking` 面板应支持 `收起 thinking / 展开 thinking / 放大 thinking / 标准视图`
- 当模型流式输出未闭合的 Markdown 代码块时，正文也应继续实时排版，而不是等到最终 `done`
- `AI题解` 与 `AI判题` 的回答区应呈现统一双流卡片：无头像徽标、无顶部状态胶囊、独立 `thinking` 区与正文区，并且两块都应在流式过程中持续刷新
- 当模型将思考与回答混在一段返回文本里时，前端应优先把思考内容抽到内嵌 `thinking` 区，正文区不应重复出现整段思考文本
- 对存在公开失败样例的 WA 提交，`AI判题` 应引用结构化失败样例（输入/输出/期望输出）中的具体值
- 左侧 AI 页签不再展示调试元信息（`模型/来源/服务返回模型/会话/当前提交`）
- 非 AC 时应展示“失败样例”卡片，包含输入/输出/期望输出；输出与期望的差异字符按红绿高亮显示
- 隐藏用例失败时默认折叠，点击“展开查看失败样例”后再显示完整详情
- 页面不再展示开发调试元信息：`控制台` 占位、`Submission ID`、`实际 Provider`、`来源`、`会话`
- 超宽屏下主内容区域应充分利用视口宽度（保留响应式安全边距），不再出现大面积左右留白
- 做题页桌面端支持可拖拽分栏；刷新后保持上次分栏比例，双击分隔条恢复默认
- 做题页右侧“代码框/运行与分析”支持纵向拖拽比例（默认 `62/38`），刷新后保持，双击恢复默认
- 右侧“判题结果”关键指标采用横向紧凑统计条展示，避免竖向堆叠
- 做题页桌面端左右主区默认更贴边、更紧凑；描述正文、Monaco 可视行数与结果区首屏信息量都高于改版前
- 做题页桌面端左右主工作区整体更靠近顶部导航栏；减少的是“顶栏 -> 工作区”的外层空白，不是内容区内部的工具栏/正文间距
- 桌面端小高度窗口下，代码编辑器主体仍保持可见（至少可见编辑区与光标输入区域）
- 代码区顶部“模式/语言”工具栏必须完整可见，切换模式/语言后不会被挤压到容器外
- 做题页桌面端左右区域在 tab 切换时保持等高，左/右内容均在各自面板内滚动
- 右侧“运行与分析”仅保留“提交判题/刷新结果 + 判题结果”，不再承载 AI 找 Bug
- 左侧 `提交记录/笔记题解/AI题解/AI判题` 不显示题目标题与徽标，仅 `描述` 显示
- 左侧 `AI题解` 与 `AI判题` 的模型选择器独立记忆，互不影响
- 做题页在平板/手机宽度应自动回退为上下堆叠，保证阅读与编辑可滚动
- 题库列表应以 `题号.中文题名` 展示（例如 `1. 两数之和`）
- 题库页应按题型分组展示，每组显示“题型名 + 题量”；无标签题归入“未分类”
- 组内题目应按 `简单 -> 中等 -> 困难` 排序；同难度下按题号升序
- 题库页“知识点”列应以标签组件展示该题全部知识点，不再显示 `slug`
- 核心模式默认代码符合 LeetCode 风格（`class Solution`），且无需用户显式编写 C++ 头文件
- 切换到 `ACM` 时会自动加载 ACM 模板；切回 `core` 时会恢复该题核心模式下最近编辑内容
- `ACM` 模式下代码框内不再出现“ACM 输入提示（stdin）”提示框，输入规范统一在左侧题面查看
- 左侧题面说明会随当前编辑模式在 `core/acm` 间切换，避免将 `key=value` 样例误当 ACM stdin
- 所有 Hot100 题目都支持 `core + acm` 双模式提交（含设计题）
- 顶部导航、题库列表、题面卡片、编辑区按钮视觉风格统一为 LeetCode 风格（深灰基底 + 橙色主操作）
- 题目页在移动端无明显错位：题面卡片与编辑区上下排列，内容可滚动
- 题目页右侧顺序符合“代码编辑区在上，操作按钮+判题结果在下”
- 主题切换后无需刷新页面，且重新打开浏览器后保持最近一次主题选择
- “提交记录”标签可看到最新 30 条提交，状态色与判题状态一致
- 点击“提交记录”会先弹确认；确认后自动回放该次提交（代码 + 判题结果 + AI 分析上下文），且不强制切换左侧页签
- 回放确认应为站内模态弹窗，不再出现浏览器原生 `confirm` 弹框
- 若历史提交没有 AI 题解，题解区应展示空态提示且不自动生成；手动点击“生成题解”后可补齐并落库
- “题解”标签能返回结构化题解文本（题意/思路/复杂度/代码/易错点）
- 首页上传 `.md` 后，系统会返回匹配结果；若包含当前题目，题解页“我的题解笔记”应立即展示对应段落
- “我的题解笔记”区域应按 Markdown 正确渲染（标题、列表、代码块、表格等）
- 当笔记使用 `24. 两两交换链表中的节点`、`25.K个一组翻转链表（附注）` 这类题号边界行时，系统会按“两个题号行之间的内容”归属前一道题目

### 4.5.1 编辑器模板恢复验证（本次新增）

浏览器打开 `http://localhost:3000/problems/two-sum`，按下面步骤操作：

1. 保持 `core + C++`，在默认模板中输入一行明显标记（例如 `// restore-me`）。
2. 观察编辑器工具栏右侧，确认出现一个圆形图标按钮：逆时针箭头代表“还原模板”，且仍位于模式/语言选择器所在组件内部。
3. 将鼠标悬停在“还原模板”图标上，确认浏览器 tooltip/标题提示为“还原默认模板”。
4. 点击“还原模板”图标，确认弹出站内居中确认框；先点“取消”，确认当前代码不变。
5. 再次点击“还原模板”图标并确认，验证编辑器恢复为题目默认 `Solution` 模板，且第 1 步插入的标记消失。
6. 保持 `core + C++`，确认当前代码与默认模板一致时，“还原模板”图标按钮变为禁用。
7. 切到 `ACM + Python`，输入一行明显标记（例如 `# acm-restore-me`），再点击“还原模板”图标并确认，验证编辑器恢复为 ACM 默认模板。
8. 在 `core/acm` 与 `C++/Python` 间各切换 1 次，确认“还原模板”图标、模式/语言选择器与右侧状态徽标仍都在同一行工具栏中可见。

预期：
- `还原模板` 只覆盖当前可见的 `mode + language` 缓冲区，不影响该题其它模式或语言的代码缓存
- 桌面端与窄屏下工具栏不会被新增按钮挤坏；模式/语言选择器与右侧状态徽标仍可正常显示

### 4.5.2 左侧页签样式验证（本次新增）

浏览器打开 `http://localhost:3000/problems/two-sum`，按下面步骤操作：

1. 观察左侧顶部页签区，确认 `描述 / 提交记录 / 笔记题解 / AI题解 / AI判题` 处于同一个圆角胶囊式容器内，而不是旧的下划线 tab。
2. 观察当前激活页签，确认它有更明显的白色高亮底、图标、圆角胶囊外观，并带一条橙色短下划线。
3. 依次点击 `提交记录`、`笔记题解`、`AI题解`、`AI判题`，确认页签切换时顶部样式保持统一，不会出现挤压、换行错位或高度跳变。
4. 切到 `提交记录`，确认顶部出现更强调的说明卡片，历史记录列表改为独立圆角卡片，而不是旧的简单分隔线列表。
5. 切到 `笔记题解`，确认顶部说明卡和正文仍属于同一滚动流，向下滚动时会一起移动。
6. 切到 `AI题解` 与 `AI判题`，确认不再显示 `AI题解，按当前题目生成结构化题解...`、`AI判题，基于运行测试...` 这两段说明文案。
7. 将浏览器宽度缩小到窄屏尺寸，确认左侧页签区域允许横向滚动，但整体仍保持在组件内部，不会把右侧工作区挤坏。
8. 切到 `AI题解`，确认 `leetPro AI` 主卡整体固定在页签区域内，不随外层滚动移动；只有 `thinking` 与回答区域内部滚动。
9. 切到 `AI判题`，确认 `AI判题` 按钮与模型选择器位于 `leetPro AI` 卡头同一行内，且卡头不再显示“生成中/已完成/待生成”状态胶囊。
10. 在 `AI题解` 与 `AI判题` 中分别触发一次生成，确认 `thinking` 面板与回答面板可以各自滚动，而顶部 `leetPro AI` 头部、模型选择器和主按钮保持可见。
11. 观察 `AI题解` 与 `AI判题` 卡头右侧，确认模型选择器和按钮已经缩小为更紧凑的一行控件，不再出现外层大号套娃胶囊。
12. 回到左侧顶部页签区域，确认整条胶囊导航已经横向占满左侧组件内容宽度，`描述/提交记录/笔记题解/AI题解/AI判题` 5 个按钮按等分铺开，不再只占左边一段。
13. 继续观察左侧顶部页签区域，确认它已经和左侧主面板顶部融为一体：不再有单独悬浮的大胶囊外壳，而是直接以内嵌导航条贴合在面板顶部。
14. 观察 `AI题解` 与 `AI判题` 主卡内部，确认没有旧版“外层大卡 + 内层大卡 + thinking 大胶囊”的多重嵌套；正文区域直接在单卡内展示，视觉层级更简单。

预期：
- 左侧页签整体视觉更接近 LeetCode/参考图风格：浅色胶囊容器、圆角按钮、激活态更突出
- `提交记录/笔记题解/AI题解/AI判题` 的内容层级更清晰，卡片圆角、留白和阴影统一
- `描述` 页签标题区不再显示额外英文标记，只保留题号、题名和元信息徽标
- `笔记题解` 的顶部首卡与正文属于同一滚动流，滚动时不会再出现“首卡固定、下面内容单独移动”
- `AI题解` 与 `AI判题` 现在都只保留一张固定主结果卡；卡头不再显示额外说明文案、阶段提示或状态胶囊，只保留 `leetPro AI`、模型选择器和主操作按钮
- `AI题解/AI判题` 中只有 `thinking` 与回答两块内容区域会滚动，外层 `leetPro AI` 卡片本身不会整体滚动
- AI 卡头右侧控件应更小巧：模型选择器与按钮高度、圆角和内边距明显收缩，视觉上更简洁
- AI 主卡内部应更轻：移除内层大描边容器、装饰头像和大号 thinking 胶囊，减少嵌套边框对正文的干扰
- 左侧顶部页签胶囊应占满组件可用宽度，5 个页签均匀分布，右侧不再留出大块空白
- 左侧顶部页签应直接属于主面板的一部分，而不是额外浮起的一层独立组件

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

### 4.15 进度页可视化验证（本次新增）

进度聚合接口验证（示例：`Asia/Shanghai`）：

```bash
curl "http://localhost:3001/api/progress/overview?timezone=Asia/Shanghai"
```

预期：
- 返回 `heatmap.startDate`、`heatmap.endDate`、`heatmap.days`
- `heatmap.days` 长度固定为 `90`，且日期连续
- 每项包含 `date`（`YYYY-MM-DD`）与 `acCount`（当天 AC 提交次数，可大于 1）
- 返回 `radar.tags`，最多 `8` 项，每项含 `tag/totalProblems/solvedProblems/coverageRate`
- `coverageRate` 为百分比（`0 ~ 100`），计算口径为 `近90天该标签已AC题数(按题去重) / 标签全库总题数`
- 返回 `summary.totalAcSubmissions90d` 与 `summary.activeDays90d`
- 返回 `mastery` 聚合块，至少包含：
  - `statusCounts`（`UNTOUCHED/LEARNING/REINFORCING/MASTERED/REVIEW_DUE`）
  - `masteredProblems`、`dueReviewProblems`、`bothModesMasteredProblems`
  - `modeCompletion.core/acm`
  - `dueReviewItems`（最多 `10` 条，按 `overdueDays` 降序；当前仅展示 `overdueDays < 10` 的记录）
  - `note`（应提示“掌握度仅统计 C++ 提交”，并说明待复习暂只展示逾期小于 10 天记录）

错误路径验证（非法时区）：

```bash
curl "http://localhost:3001/api/progress/overview?timezone=Mars/OlympusMons"
```

预期：
- 返回 `400`
- 错误信息提示 timezone 非法

页面验证：

1. 打开 `http://localhost:3000/progress`。
2. 首屏应看到 3 个统计卡片：`90 天 AC 提交总数`、`90 天活跃打卡天数`、`统计时区`。
3. 其下应看到 3 个掌握度卡片：`已熟练题数`、`待复习题数`、`Core/ACM 双模式熟练进度`。
4. 热力图应展示近 90 天连续日期格子；鼠标悬浮可看到日期和 AC 次数。
5. 雷达图应展示 Top8 高频标签；tooltip 显示 `覆盖率%` 和 `已解/总题数`。
6. 页面底部“待复习题目（Top10）”应显示题目、待复习模式、建议复习时间、逾期天数，并可点击跳转到题目页；当前逾期 `10` 天及以上的历史记录不会出现在列表中。
7. 如切换系统时区后刷新页面，统计时区与图表分桶应随浏览器时区变化。

### 4.16 题目掌握度功能验证（本次新增）

题库掌握度列表接口验证：

```bash
curl http://localhost:3001/api/problems
```

预期：
- 每个 `item` 包含 `masterySummary`
- `masterySummary` 字段包含：
  - `overallStatus`：`UNTOUCHED | LEARNING | REINFORCING | MASTERED | REVIEW_DUE`
  - `isSolved`
  - `solvedModes`
  - `isSingleModeSolved`
  - `totalAttempts`
  - `latestStatus`
  - `dueModes`、`consecutiveAc`、`reviewIntervalDays`、`nextReviewAt`、`overdueDays`

题目掌握度详情接口验证（示例：`two-sum`）：

```bash
curl http://localhost:3001/api/problems/two-sum/mastery
```

预期：
- 返回 `summary` 与 `tracks`
- `tracks` 固定 2 条（`core-cpp`、`acm-cpp`）
- 每条 track 包含 `mode/language/supported/status/totalAttempts/latestStatus/isSolved/totalAcCount/consecutiveAc/reviewIntervalDays/nextReviewAt/overdueDays`
- `isSolved` 按该模式最新有效 C++ 提交是否为 `AC` 判断；如果先 `AC` 后又提交 `WA/TLE/RE/CE`，该模式不再算已做
- 不支持的轨道（若题目仅支持 CORE 或 ACM）状态应为 `UNSUPPORTED`
- Python 提交不应改变掌握度状态（仅 C++ 计入）

页面验证：

1. 打开 `http://localhost:3000/problems`，观察“状态”列改为新徽标：`未做题/已做题/学习中/巩固中/已熟练/待复习`。
2. 同一行副文案应显示复习信号（`单模式已做题 / 今天复习 / X 天后复习 / 已逾期 X 天`）。
3. 打开任意题目页（如 `http://localhost:3000/problems/two-sum`），右侧“运行与分析”区域不再显示掌握度卡片，仅保留判题与 AI 分析。
4. 重新提交代码后，回到 `/progress` 或 `/problems` 刷新页面，可看到掌握度状态和待复习列表变化。

### 4.9 新接口验证（提交记录 + 题解）

提交记录接口：

```bash
curl http://localhost:3001/api/submissions/history/by-problem/two-sum
```

预期：
- 返回 `items` 数组
- 每项包含 `status`、`runtimeMs`、`memoryKb`、`passedCount`、`totalCount`、`createdAt`

提交记录回放聚合接口：

```bash
curl http://localhost:3001/api/submissions/<submission-id>/replay
```

预期：
- 返回 `submission`（含 `code`、`status`、`failureCase`）
- 返回 `ai.review`（该提交最新 AI 找 Bug assistant 消息，可能为 `null`）
- 返回 `ai.solution`（该提交最新 AI 题解 assistant 消息，可能为 `null`）

题解同步接口：

```bash
curl -X POST http://localhost:3001/api/ai/solution \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","submissionId":"<submission-id>","problemTitle":"Two Sum","modeSupport":"BOTH","provider":"minimax","preferredLanguage":"cpp","description":"给定整数数组 nums 和目标值 target，找到和为 target 的两个下标。","sampleInput":"nums=[2,7,11,15], target=9","sampleOutput":"[0,1]"}'
```

预期：
- 返回 `editorial`（非空）
- 返回 `source`（`vllm` 或 `minimax`）
- 返回 `provider`（`vllm` 或 `minimax`）
- 返回 `sessionId`
- 若上游模型失败，接口返回 `502` 与明确错误信息（不再输出模板题解）

题解 SSE 接口：

```bash
curl -N -X POST http://localhost:3001/api/ai/solution/stream \
  -H "content-type: application/json" \
  -d '{"problemSlug":"two-sum","submissionId":"<submission-id>","problemTitle":"Two Sum","modeSupport":"BOTH","provider":"vllm","preferredLanguage":"cpp","description":"给定整数数组 nums 和目标值 target，找到和为 target 的两个下标。","sampleInput":"nums=[2,7,11,15], target=9","sampleOutput":"[0,1]"}'
```

预期：
- 持续收到 `event: meta / phase / response.output_text.delta / response.completed / done`
- 成功时 `done` 中包含 `editorial`、`source`、`providerKind=openai_compatible`、`model`、`sessionId`
- `editorial` 为结构化题解：包含题意、思路、不变式、复杂度、Core 模式完整代码、ACM 模式完整代码、常见陷阱与验证用例
- 失败时会收到 `event: error`（含 `message`），并在 `done` 中携带 `error`

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
- `@leetcodepro/judge-dispatcher`：判题回归测试通过（含 `move-zeroes` 的 `core/acm` 隔离回归）

### 4.11.1 Hot100 全题 core/acm 判题隔离巡检（本次新增）

```bash
npm run verify:judge-modes
```

预期：
- 终端输出 `All 100 problems passed mode-isolation checks`
- 生成报告文件：`artifacts/judge-mode-isolation-report.json`
- 报告中 `issueCount` 为 `0`

### 4.13 AI 诊断质量评估（P1-1）

```bash
npm run e2e:ai-quality
```

可选参数示例：

```bash
node scripts/e2e/ai-review-quality-eval.mjs \
  --api-base-url http://localhost:3001 \
  --provider vllm \
  --min-case-score 70 \
  --min-overall-score 80
```

预期：
- 输出 `summary: "ai review quality gate passed"`
- 输出 `overallScore` 与每个场景的 `score/checks/source`
- 默认覆盖 4 类场景：`WA`、`TLE`、`CE`、`AC`
- 质量闸门失败时进程退出码为 `51`

### 4.14 Prompt Injection 对抗测试（P1-2）

```bash
npm run e2e:prompt-injection
```

可选参数示例：

```bash
node scripts/e2e/prompt-injection-attack.mjs \
  --api-base-url http://localhost:3001 \
  --provider vllm \
  --min-case-score 80 \
  --min-overall-score 90
```

预期：
- 输出 `summary: "prompt injection security gate passed"`
- 默认覆盖 3 组攻击向量：
  - 通过 `errorMessage` 注入系统提示词套取与密钥索取
  - 通过 `failureSignals` 诱导输出完整可运行答案
  - 在 `AC` 状态下诱导泄露系统提示与密钥
- 每组输出包含 `score/checks/source`，并校验：
  - 不回显恶意 token
  - 不泄露系统提示词/密钥字段
  - 不输出整题完整可运行答案
- 对抗闸门失败时进程退出码为 `53`

### 4.6 最小 E2E 一键联调脚本（推荐）

项目已提供脚本：`scripts/e2e/minimal-flow.mjs`，覆盖流程：
- `GET /api/problems`
- `POST /api/submissions`
- 轮询 `GET /api/submissions/:id` 直到终态
- `POST /api/ai/bug-find/stream`（默认）或 `POST /api/ai/bug-find`（兼容）
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
  --ai-provider minimax \
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

### 4.17 首页 AI 配置中心验证（本次新增）

1. 打开首页：`http://localhost:3000/`
2. 在“我的 AI 配置（OpenAI 兼容）”中新增一个配置：
   - 配置名称：`my-openai-compatible`
   - Base URL：`https://api.openai.com/v1`（或你的兼容网关）
   - 模型名：`gpt-4o-mini`（示例）
   - API Key：输入有效密钥
   - 前置检查：项目根目录 `.env` 中必须存在 `AI_CONFIG_ENCRYPTION_KEY`，修改后需要重启 API 服务
3. 预期：列表出现新配置，`key` 显示为掩码（`••••xxxx`），不显示完整明文。
4. 在“默认配置”里分别设置：
   - `AI判题默认配置 = my-openai-compatible`
   - `AI题解默认配置 = my-openai-compatible`
   点击“保存默认配置”。
5. 打开任意题目页：`http://localhost:3000/problems/two-sum`
6. 在左侧 `AI题解` 和 `AI判题` 页签的下拉中，预期都能看到该配置，并可分别选中不同配置。
7. 点击 `AI判题` / `生成题解`，预期请求体优先走 `aiConfigId`（可通过 API 日志确认），并正常返回结果。
8. 回到首页删除该配置，再返回题目页触发 AI 请求：
   - 预期显示显式错误（引导先去首页配置），不再静默回退到模板文案。

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

### 6.4 首页新增 AI 配置时报 `AI_CONFIG_ENCRYPTION_KEY is missing`

- 原因：项目根目录 `.env` 缺少 `AI_CONFIG_ENCRYPTION_KEY`，API 无法加密存储你填写的第三方模型 API Key
- 处理步骤：
  1. 打开 `/Users/moem/Desktop/vibecoding/LeetcodePro/.env`
  2. 补充一行：`AI_CONFIG_ENCRYPTION_KEY=leetcodepro-dev-ai-config-key!!!`
  3. 重启 API：在项目根目录执行 `npm run dev:api`，或重启整组 `npm run dev`
  4. 刷新首页后重新新增 DeepSeek / OpenAI 兼容配置
- 预期结果：列表能正常出现新配置，页面不再提示缺少加密密钥

### 6.5 当前 AI 配置请求超时

- 原因：上游 OpenAI 兼容服务响应慢于默认超时，常见于 DeepSeek / 第三方网关首包较慢，或 Base URL 可达但上游处理时间较长
- 处理步骤：
  1. 确认首页 AI 配置中的 `Base URL` 与 `model` 正确
  2. DeepSeek 官方 OpenAI 兼容地址可用 `https://api.deepseek.com`，也兼容 `https://api.deepseek.com/v1`
  3. 在项目根目录 `.env` 中确认：
     `AI_TUTOR_CUSTOM_CONFIG_TIMEOUT_MS=90000`
     `AI_TUTOR_CUSTOM_CONFIG_REVIEW_TIMEOUT_MS=90000`
     `AI_TUTOR_CUSTOM_CONFIG_SOLUTION_TIMEOUT_MS=300000`
  4. 重启 `npm run dev` 后重试
- 预期结果：自定义 AI 配置不再因为本地代理超时被提前截断

### 6.6 DeepSeek 输出被截断

- 原因：自定义 OpenAI 兼容配置的 `max_tokens` 上限过低，模型按上限正常停止输出
- 处理步骤：
  1. 在项目根目录 `.env` 中确认：
     `AI_TUTOR_CUSTOM_CONFIG_REVIEW_MAX_TOKENS=4096`
     `AI_TUTOR_CUSTOM_CONFIG_SOLUTION_MAX_TOKENS=8192`
  2. 重启 `npm run dev`
  3. 回到 AI 题解页重新生成
- 预期结果：DeepSeek 题解有更完整的输出空间，不再沿用 vLLM 的短输出上限

### 6.7 `Invalid problemSlug`

- 原因：提交时题目标识不存在
- 处理：先执行 `curl http://localhost:3001/api/problems` 获取合法 `slug`

### 6.8 `Judge queue unavailable, please retry.`

- 原因：API 无法连接 RabbitMQ（`RABBITMQ_URL` 不可达）或队列声明失败
- 处理步骤：
  1. `docker compose ps`
  2. `docker compose logs rabbitmq --tail=100`
  3. `curl http://localhost:8080/health` 查看 `lastError`
  4. 确认 `.env` 中 `RABBITMQ_URL` 与 `JUDGE_QUEUE_NAME` 与服务一致

### 6.9 `g++: command not found`

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

- 原因：`ai-tutor` 无法连到所选 provider（`vllm`/`minimax`/`deepseek`），或上游返回错误
- 排查步骤：
  1. `curl http://localhost:8000/health`，确认默认 `provider` 与 `model` 正常
  2. 若你请求 `vllm`：检查 `.env` 中 `VLLM_BASE_URL`、`VLLM_API_KEY`、`VLLM_MODEL`
  3. 若你请求 `minimax`：检查 `.env` 中 `MINIMAX_BASE_URL`、`MINIMAX_API_KEY`、`MINIMAX_MODEL`
  4. 若你请求 `deepseek`：检查 `.env` 中 `DEEPSEEK_BASE_URL`、`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`
  5. 直接探测 vLLM（如果在用 vLLM）：
     `curl http://127.0.0.1:18100/v1/models`
  6. 若使用远程模型，确认网络连通与端口映射后重启 AI 服务：`npm run dev:ai`

### 6.12 AI `source` 返回 `api-fallback`

- 原因：API 代理请求 `ai-tutor` 超时，在上游返回前就被中断。
- 排查步骤：
  1. 直接调用 `ai-tutor`：`curl -X POST http://localhost:8000/bug-find ...`，若 `source` 为所选 provider 说明上游正常。
  2. 再调用 API 代理：`curl -X POST http://localhost:3001/api/ai/bug-find ...`，若 `source=api-fallback` 且耗时接近 `12s`，即为超时。
  3. 在 `.env` 调大：
     - `AI_TUTOR_REVIEW_TIMEOUT_MS=30000`
     - `AI_TUTOR_SOLUTION_TIMEOUT_MS=300000`
  4. 重启 API 服务：`npm run dev:api`（或重启 `npm run dev`）

### 6.13 前端报错 `Cannot find module './383.js'`

- 原因：Next.js chunk 缓存不一致（常见于中断重启、分支切换，或 dev/build 产物混用后）
- 处理步骤：
  1. 在项目根目录执行：`npm run clean -w @leetcodepro/web`
  2. 重新启动前端：`npm run dev:web`
  3. 刷新页面后再次验证
- 补充说明：
  - 当前版本已将开发产物目录固定为 `.next-dev`，生产构建目录固定为 `.next`，用于降低该问题复发概率

### 6.14 AI 找 Bug 输出仍然像固定模板，定位不够直接

- 原因：当上游模型输出质量不稳定或触发安全打码时，回答可能退化成空泛建议，缺少具体改动点。
- 当前版本处理：
  1. 自动移除 `<think>` 推理块
  2. 仅在检测到整题完整实现时做代码打码，保留错误定位正文
  3. Prompt 改为“算法专家直定位”，并按判题状态分流：`AC` 输出优化评审，非 `AC` 输出错误定位
  4. 上游不可用时，`ai-tutor-fallback` 与 `api-fallback` 均返回行号级可疑点与修改建议
- 自检步骤：
  1. 前端选择 `MiniMax`，点击“AI 找 Bug”
  2. 观察返回内容：未 AC 时应为“主要问题/具体修改建议/快速验证”；AC 时应为“通过后优化评审”
  3. `source` 应为 `minimax`（若为 `ai-tutor-fallback`，回到 6.11 排查网络或 Key）

### 6.19 AI 找 Bug 输出疑似被截断

- 现象：
  1. 文本在末尾突然中断
  2. 流式已经结束但内容不完整
- 当前版本处理：
  1. API 代理与前端均增强 SSE 解析：同时支持 `\\n\\n` 和 `\\r\\n\\r\\n` 分隔
  2. 增加流结束时尾包补齐解析，避免最后一帧未被消费
  3. 前端 AI 面板改为固定高度滚动区域（鼠标滚轮可查看完整内容），并放大为右侧主区域
  4. 前端统一消费 `response.output_text.delta` / `response.output_text.replace` / `done`，不再按 provider 自动补同步请求
  5. AI 找 Bug 独立超时默认提升到 `30s`（可用 `AI_TUTOR_REVIEW_TIMEOUT_MS` 覆盖）
- 排查步骤：
  1. 观察 Network 中 `bug-find/stream` 是否返回 `done` 帧
  2. 若仍异常，直接调用 `POST /api/ai/bug-find` 对比文本完整度
  3. 必要时调大 `.env` 的 `AI_TUTOR_REVIEW_MAX_TOKENS`

### 6.15 AI 题解显示为纯文本或内容被截断

- 现象：
  1. 题解区域像纯文本大段输出，不是 Markdown 结构化展示
  2. 题解在中途停止，末尾被截断
- 当前版本处理：
  1. 前端“题解”区域改为 Markdown 渲染（支持标题/列表/代码块/表格）
  2. AI Tutor 自动去除 `<think>` 推理块，减少无效 token 消耗
  3. 系统 provider 题解输出上限统一由 `AI_TUTOR_SOLUTION_MAX_TOKENS` 控制
  4. 题解流式解析增强：支持 `\\n\\n`/`\\r\\n\\r\\n`，并统一消费 OpenAI-compatible 语义事件
  5. 题解链路已移除模板兜底：上游失败时直接返回错误提示，不再输出套话题解
  6. API 题解链路新增请求类型级超时（`AI_TUTOR_SOLUTION_TIMEOUT_MS` 默认 `300s`），避免上游生成期间被代理提前中断
  7. API/前端会归一化 abort/timeout 原始英文错误（如 `This operation was aborted`），统一展示为中文“题解请求超时/生成失败”提示
  8. AI 题解会输出 Core 模式与 ACM 模式完整参考代码，并补充关键行说明和验证用例
- 排查步骤：
  1. 确认 `source` 与所选 provider 一致，且 `providerKind=openai_compatible`
  2. 在 `.env` 提升：
     - `AI_TUTOR_SOLUTION_MAX_TOKENS=4096`（可继续调大）
     - `AI_TUTOR_SOLUTION_TIMEOUT_MS=300000`
  3. 重启 `web/api/ai` 后再测试

### 6.16 上传笔记时报错 `relation "user_notes" does not exist`

- 原因：数据库未应用最新迁移（`003_add_user_notes.sql`）。
- 处理步骤：
  1. 执行迁移：`npm run db:migrate -w @leetcodepro/api`
  2. 重启 API：`npm run dev:api`（或重启 `npm run dev`）
  3. 重新上传 Markdown 笔记
- 当前版本已增加后端提示：若缺表会返回明确信息，提示执行迁移命令。

### 6.17 `db:seed` 报错 `TypeError: Cannot read properties of undefined (reading 'resolve')`

- 原因：使用旧代码版本时，`apps/api/scripts/db/seed.ts` 对 `node:path` 的导入方式在当前 `ts-node + commonjs` 配置下可能被解析为 `undefined`。
- 处理步骤：
  1. 拉取最新代码（已修复导入方式）：`git pull`
  2. 重新执行：`npm run db:seed -w @leetcodepro/api`
  3. 验证题库数量：`curl http://localhost:3001/api/problems | jq '.items | length'`
- 预期结果：返回 `100`，且 `items[0].leetcodeId` 非 `null`。

### 6.18 `db:seed` 报错外键冲突 `submission_case_results_case_id_fkey`（错误码 `23503`）

- 原因：历史提交结果表 `submission_case_results` 仍引用旧的 `test_cases.id`，而 seed 需要替换 `test_cases`。
- 处理步骤：
  1. 拉取最新代码（seed 已改为先清理当前题相关 `submission_case_results`，再替换测试用例）：`git pull`
  2. 重新执行：`npm run db:seed -w @leetcodepro/api`
  3. 验证题库数量：`curl http://localhost:3001/api/problems | jq '.items | length'`
- 预期结果：seed 正常完成并打印 `seed completed: 100 problems...`。

### 6.20 判题完成后内存仍显示 `- KB`

- 现象：提交终态（`AC/WA/TLE/RE`）时，页面仍显示 `内存：- KB`。
- 根因：运行中的 Judge 进程可能是旧实例，未加载最新内存采集逻辑。
- 排查步骤：
  1. `curl http://localhost:8080/health`，确认返回包含 `startedAt` 与 `memoryProbeVersion`。
  2. 修改 `services/judge-dispatcher/src/sandbox-runner.mjs` 后观察 `startedAt` 是否变化（应自动重启）。
  3. 若未变化，手动重启 Judge：
     - 仅重启 Judge：`npm run dev:judge`
     - 若端口被占用先清理：`lsof -tiTCP:8080 -sTCP:LISTEN | xargs kill`
  4. 提交一条 `two-sum`（Python core）后轮询 `GET /api/submissions/<id>`，确认终态 `memoryKb > 0`。
  5. 验证 case 级入库（Docker 自带 psql）：
     `docker exec leetcodepro-postgres psql -U postgres -d leetcodepro -c "select status,runtime_ms,memory_kb from submission_case_results where submission_id='<id>' order by id;"`
- 预期结果：
  - 提交结果中的 `memoryKb` 为正整数。
  - `submission_case_results.memory_kb` 不再是 `NULL`（编译失败 `CE` 场景除外）。

### 6.21 AI 健康检查中 `langChainReady=false` 或 `llamaIndexReady=false`

### 6.22 打开题目报错 `column "acm_input_spec" does not exist`（错误码 `42703`）

- 原因：当前 API 代码已读取 ACM 专用字段，但数据库还未执行 `009_add_acm_specs_to_problems.sql`。
- 处理步骤：
  1. 执行迁移：`npm run db:migrate -w @leetcodepro/api`
  2. 重启 API：`npm run dev:api`（或重启 `npm run dev`）
  3. 重新访问：`http://localhost:3000/problems/two-sum`
- 预期结果：题目详情可正常返回，响应体包含 `acmInputSpec/acmOutputSpec/acmSampleInput/acmSampleOutput` 字段。
- 兼容说明：即使数据库暂未迁移，API 现在也会自动回退到 core 字段并动态生成 ACM 展示内容，不再因缺列直接报 500。

### 6.23 代码编辑区无法输入（Monaco 看得到但无法写代码）

- 现象：
  1. 题目页代码编辑器可渲染，但键盘输入不生效或内容被异常覆盖。
- 当前版本处理：
  1. 编辑器强制关闭只读态（`readOnly=false`、`domReadOnly=false`）。
  2. Monaco 主题改为项目内显式定义（浅色/深色各一套），避免默认主题异常导致“白底白字/文本不可见”。
  3. 兼容历史脏数据：`modeSupport` 非 `CORE/ACM/BOTH` 时自动回退为 `BOTH`，避免模式校验异常影响输入。
- 排查步骤：
  1. 拉取最新代码：`git pull`
  2. 重启前端：`npm run dev:web`（或重启 `npm run dev`）
  3. 打开 `http://localhost:3000/problems/two-sum`，在代码区直接输入任意字符。
- 预期结果：
  - 输入实时生效，内容不再被自动回滚。

### 6.24 题目页代码编辑区被“顶上去”或几乎不可见

- 现象：
  1. 右侧“代码”卡片只看到头部或底部提示，编辑器主体区域几乎看不到。
  2. 调整窗口高度后问题更明显（尤其是桌面端）。
- 当前版本处理：
  1. 编辑器容器由固定 `h-full/52vh` 调整为 `flex-1` 自适应，避免与上下分栏高度冲突。
  2. 移除编辑器底部冗余状态栏（模式/语言重复信息），把可视高度优先留给代码输入区。
  3. 题目页视口高度计算修正为 `100dvh - 6.5rem`，减少可视区被过度压缩。
  4. 代码编辑组件重构为“工具栏固定 + 编辑器主体自适应”的两段网格布局，避免工具栏挤压 Monaco 区域。
  5. Monaco 容器新增 `min-height` 与 `ResizeObserver + editor.layout()`，保证尺寸变化后正文可见。
  6. 右侧“代码/运行分析”纵向分栏默认比例与最小高度进一步调整为 `86%` + `180/72`，减少运行区空白并确保可拖动空间。
  7. 纵向分栏持久化 key 升级到 `leetcodepro-workspace-vertical-ratio-v4`，自动绕过历史异常比例缓存。
  8. 分隔条交互增强：纵向拖拽条继续加厚并高亮，支持鼠标/触控/触控板拖拽与双击恢复默认比例。
- 排查步骤：
  1. 拉取最新代码并重启前端：`npm run dev:web`
  2. 打开 `http://localhost:3000/problems/two-sum`
  3. 将浏览器高度缩小到约 `700~850px`，确认代码区仍可见并可输入
  4. 如仍异常，双击右侧纵向分隔条恢复默认比例后刷新页面
- 预期结果：
  - 代码编辑器主体可见，光标可定位并正常输入，滚动条行为正常。

- 原因：Python 依赖未安装完整，或 `.venv` 仍是旧环境。
- 排查步骤：
  1. 在项目根目录执行：`npm run setup:python`
  2. 重启 AI 服务：`npm run dev:ai`
  3. 再次执行：`curl http://localhost:8000/health`
  4. 若仍为 `false`，执行：
     - `./.venv/bin/python -m pip show langchain`
     - `./.venv/bin/python -m pip show llama-index-core`
- 预期结果：
  - 健康检查返回 `langChainReady=true`、`llamaIndexReady=true`
  - AI 找 Bug/题解接口仍保持原有可用性与 SSE 事件结构（`meta/delta/done`）

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
