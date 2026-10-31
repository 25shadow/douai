# AI 游戏互动路由实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一个统一、可测试的直播事件路由运行时，让每条弹幕按活动游戏语义进入游戏、AI 主播或原文朗读中的合适路径，同时保持游戏外现有行为。

**Architecture:** 在直播连接与仿真入口之后加入标准化事件和 `interactionRouter`，由活动游戏逐条返回认领状态及语音/AI 意图。游戏只负责确定性规则和语义声明；核心运行时执行 AI 策略、生命周期校验和输出调度；`voiceManager` 继续作为唯一语音队列。游戏交互策略复用现有 SQLite 项目配置，不引入插件加载或平行配置存储。

**Tech Stack:** Vue 3、TypeScript、Node.js `node:test`、Python `unittest`、SQLite、现有 TTS 与 OpenAI 兼容 AI 服务。

**Spec:** `docs/superpowers/specs/2026-10-29-ai-game-interaction-routing-design.md`

## 全局约束

- OBS 控制、OBS 场景切换和 OBS 前置条件均不在范围内。
- 第一阶段沿用静态 `gameRegistry`；不加入第三方动态插件、市场、签名或沙箱。
- AI 不得直接修改游戏分数、胜负、题目阶段或其他权威状态。
- 游戏命令一旦认领，默认不得再进入通用 AI 主播回应或弹幕原文朗读。
- 普通聊天在游戏运行期间默认不原文朗读；AI 主播回应与原文朗读互斥，除非用户显式配置双路。
- AI 不回应、超时、异常或服务不可用时不隐式回退为原文朗读。
- 无活动游戏时继续使用现有全局语音和 AI 互动设置及其行为。
- 真实直播与仿真事件必须经过同一条路由入口；去重、节流、安全、优先级和输出仍由核心运行时管理。
- 新增游戏级策略需带版本和保守默认值；不得静默更改旧的全局设置。
- 游戏停止、切换或直播会话结束后，旧 AI 结果和旧实例待播任务不得继续输出。

## 文件边界

- `src/game/interactionTypes.ts`：标准事件、游戏事件结果、交互策略和输出意图的共享类型。
- `src/game/interactionRouter.ts`：事件逐条路由、游戏策略解析、去重及 AI/播报意图调度；不持有平台连接。
- `src/game/gameRegistry.ts`：静态游戏注册表；把批量 `handleMessages` 契约改为逐事件 `handleEvent`。
- `src/stores/liveStore.ts`：连接与仿真会话生命周期；把真实、仿真事件交给同一入口。
- `src/services/liveSimulation.ts`：只构造仿真标准消息；不直接导入游戏 store 获取命令设置。
- `src/game/quiz/quizStore.ts`、`src/game/versus/versusStore.ts`：保留确定性规则，将消息处理结果和原本直接执行的游戏播报改成结构化返回值/意图。
- `src/voice/liveAnnouncements.ts`、`src/voice/voiceManager.ts`：接收路由决策及带实例归属的语音输出，支持实例取消和已过期输出拒绝。
- `src/voice/voiceConfig.ts`、`voice_config.py`：只维护现有全局语音配置；游戏级策略放在项目级 `gameInteractionConfig`，避免混入全局语音偏好。
- `src/services/configApi.ts`、`config_server.py`：读写游戏级交互配置，并为 AI 游戏代理提供独立、受约束的请求端点。
- `src/views/VoiceConfigView.vue` 或单独游戏配置视图：提供按游戏 ID 配置普通弹幕、AI 主播、原文朗读及非聊天事件策略的 UI。
- 测试使用现有 `node:test` 和 Python `unittest`；测试路由时用注入的 AI、时钟及输出执行器，不依赖真实网络、TTS 或直播间。

---

### Task 1：定义逐事件契约并实现可注入的路由核心

**Files:**
- Create: `src/game/interactionTypes.ts`
- Create: `src/game/interactionRouter.ts`
- Create: `src/game/__tests__/interactionRouter.test.ts`
- Modify: `src/game/gameRegistry.ts`

**Interfaces:**
- 标准输入为 `RoutedLiveEvent`，包含 `eventId: string`、`source: 'live' | 'simulation'`、`receivedAt: number`、`sessionId: string` 和 `message: DyMessage`。
- 游戏逐事件接口为 `handleEvent(event: RoutedLiveEvent, context: GameEventContext): GameEventResult`；游戏规则同步执行并返回结果，不在模块内调用 AI 或 TTS。
- `GameEventResult` 至少包含 `claimed: boolean`、`speechIntents: SpeechIntent[]` 和 `aiIntents: AiIntent[]`；所有数组默认为空。
- 首版策略类型固定为 `ignore | ai_host | read_sampled | game_defined`；礼物/点赞/关注/进场/分享策略使用显式事件类别值，不接受任意字符串。
- 路由器工厂接受 `getActiveGame`、配置读取、AI 执行、语音意图提交、全局播报和时钟等依赖，便于单测替换真实服务。

- [ ] **Step 1: 为契约和最小路由行为写失败测试**

测试至少覆盖：无活动游戏时沿用全局聊天路由；游戏命令已认领时不调用通用 AI 或原文朗读；未认领弹幕按 `ignore`、`ai_host`、`read_sampled`、`game_defined` 分流；一次事件不会默认同时走 AI 与原文朗读。

- [ ] **Step 2: 运行路由测试并确认失败原因是缺少新接口**

运行：

```powershell
node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-transform-types --test src/game/__tests__/interactionRouter.test.ts
```

预期：FAIL，因路由类型与工厂尚不存在，而非测试运行器语法错误。

- [ ] **Step 3: 新建事件、策略和意图类型**

在 `interactionTypes.ts` 定义 `RoutedLiveEvent`、`GameEventContext`、`GameEventResult`、`SpeechIntent`、`AiIntent`、`ChatRoutePolicy` 和非聊天事件策略。事件来源只允许 `live`、`simulation`；事件 ID、会话 ID、游戏实例 ID 均用字符串；语音意图包括 `eventId`、`instanceId`、文本、场景、优先级和有效期。

- [ ] **Step 4: 实现纯路由判定和依赖注入执行器**

在 `interactionRouter.ts` 中实现 `createInteractionRouter(dependencies)` 和 `routeEvent(event)`。每条事件先按 `eventId` 去重，再调用当前运行游戏的 `handleEvent`，之后依据认领结果、游戏策略或全局策略分发意图。核心路由不解析游戏规则，不在策略失败时改走其他聊天输出路径。

- [ ] **Step 5: 将注册表接口切换为逐事件处理并保持旧模块可编译**

在 `gameRegistry.ts` 将 `handleMessages(messages)` 替换为 `handleEvent(event, context)`；此任务期间为 quiz/versus 加返回空结果的兼容适配，下一任务再迁入实际规则结果。注册表仍使用静态 `registeredGames`，并能按稳定 ID 查询活动模块。

- [ ] **Step 6: 运行新测试和类型检查**

运行：

```powershell
node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-transform-types --test src/game/__tests__/interactionRouter.test.ts
pnpm type-check
```

预期：路由行为测试 PASS，应用仍可编译。

### Task 2：让答题、阵营对抗、真实直播和仿真共用逐事件路由

**Files:**
- Modify: `src/game/interactionRouter.ts`
- Modify: `src/game/gameRegistry.ts`
- Modify: `src/game/quiz/quizStore.ts`
- Modify: `src/game/versus/versusStore.ts`
- Modify: `src/stores/liveStore.ts`
- Modify: `src/services/liveSimulation.ts`
- Create: `src/game/__tests__/liveEventPipeline.test.ts`
- Modify: `src/game/quiz/__tests__/liveSimulation.test.ts`

**Interfaces:**
- `routeLiveMessages(messages, source, sessionId)` 为批次中的每个 `DyMessage` 单独生成 `RoutedLiveEvent` 并按原顺序调用 `routeEvent`。
- quiz/versus 的 `handleEvent` 将当前消息处理结果返回为 `GameEventResult`；规则处理仍在 game store 的确定性函数里完成。
- `createSimulationMessage(index, gameId, commands?)` 通过显式可选的命令参数构造仿真数据；不得从 `@/game/...Store` 导入运行态游戏设置。

- [ ] **Step 1: 为命令认领和两类入口一致性写失败测试**

添加断言：答题进行中 A/B/C/D 有效答案被认领；无效答案和普通闲聊不被误认领；认领事件不进入 AI/原文朗读；真实来源和仿真来源对同一消息得到相同游戏与播报路由结果；相同事件 ID 第二次路由不重复更新状态。

- [ ] **Step 2: 让 quiz 逐条返回认领结果**

将 `handleQuizMessages` 拆出单消息规则处理函数并返回是否已作为游戏输入处理。有效答案在答题阶段被认领；点赞、礼物继续由游戏规则处理并被相应事件策略观察；不满足阶段或规则的普通聊天保持未认领。答案解析和分数结算仍使用既有 `parseQuizAnswer`、`submitAnswer` 等确定性逻辑。

- [ ] **Step 3: 让 versus 逐条返回认领结果**

将 `handleVersusMessages` 拆出单消息处理函数并报告加入阵营/提交答案等命令是否认领。保持当前红蓝队命令、A-D 答题、礼物和点赞规则不变；未构成游戏命令的聊天不得被标记为已消费。

- [ ] **Step 4: 统一直播接入与会话失效**

在 `liveStore.ts` 创建真实直播 session ID，并将每批直播消息传入 router；断开、控制台重连或游戏实例变化时递增/替换生命周期标识。移除原先“先批量派发给游戏，再独立逐条通用播报”的双路径调用。

- [ ] **Step 5: 将仿真消息改为同一管线**

仿真开始时建立单独 session ID；每次生成的事件经同一 `routeLiveMessages(..., 'simulation', sessionId)` 处理。把红蓝阵营演示命令作为参数传给 `createSimulationMessage`，删除 `liveSimulation.ts` 对 `versusStore` 的运行态导入，避免服务层与游戏 store 循环耦合。

- [ ] **Step 6: 运行游戏规则、管线测试和类型检查**

运行：

```powershell
node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-transform-types --test src/game/__tests__/liveEventPipeline.test.ts src/game/quiz/__tests__/quizRules.test.ts src/game/quiz/__tests__/liveSimulation.test.ts
pnpm type-check
```

预期：所有测试 PASS；`liveSimulation.test.ts` 不再因 Node 无法解析 `@/game` 别名而失败。

### Task 3：集中提交语音意图并隔离 AI 主播异步结果

**Files:**
- Modify: `src/game/interactionTypes.ts`
- Modify: `src/game/interactionRouter.ts`
- Modify: `src/game/quiz/quizStore.ts`
- Modify: `src/game/versus/versusStore.ts`
- Modify: `src/voice/liveAnnouncements.ts`
- Modify: `src/voice/voiceManager.ts`
- Create: `src/voice/__tests__/interactionLifecycle.test.ts`
- Modify: `src/voice/__tests__/voiceManager.test.ts`
- Modify: `src/voice/__tests__/liveAnnouncements.test.ts`

**Interfaces:**
- `SpeechIntent` 使用 `owner: 'game:<id>:<instanceId>' | 'ai-host:<sessionId>' | 'live-events'` 归属；`voiceManager` 暴露 `clearOwner(owner)` 并通过 `speak(text, { scene, owner })` 提交，路由器不能绕过它直接调用语音适配器。
- AI 主播生成请求携带 session ID 和生命周期代次；在 AI 返回后、文本发布前和语音入队前分别校验 session/instance 是否仍有效。
- `generateAiReply` 和新增 AI 游戏动作服务均接受 `AbortSignal`；会话/游戏实例失效时发出 abort，另设请求超时，避免只忽略回调但仍持续占用网络与模型资源。
- 游戏停止/切换时取消对应 owner 的排队和当前语音；会话失效时取消该会话 AI 主播的语音意图。

- [ ] **Step 1: 为取消、过期回调和统一输出写失败测试**

测试覆盖：AI 请求等待期间游戏停止后返回，不发文字也不入语音队列；旧游戏 owner 的待播语音可清除且不影响系统语音；重复 `eventId` 或重复意图只输出一次；低优先级意图遵守队列上限，关键结果按配置优先级保留。

- [ ] **Step 2: 将游戏 store 内的直接播报改为返回意图**

把 quiz `announce` 以及 versus 中题目、答案、胜负、点赞反馈等直接 `speak()` 调用改为构造 `SpeechIntent`，随对应 `GameEventResult` 返回。保留每条意图的场景、文本、原优先级语义和游戏开关；不在 game store 中入队。

- [ ] **Step 3: 在 router 中集中校验并提交语音意图**

为每个游戏运行实例创建稳定 `instanceId`；路由器检查事件去重、实例仍活动、有效期未过后，才调用统一提交器。游戏停止或更换实例时清除该实例 owner；不得清理其他游戏、全局事件或系统提示。

- [ ] **Step 4: 为 AI 主播请求加入会话代次与取消**

将 `announceLiveMessage` 内 AI 生成逻辑移入路由执行层或由其接收一个显式生命周期校验器。AI 请求超时/失败依现有兜底策略处理；每条异步回调在更新上下文、发文本、提交语音之前都校验代次。失败或 AI 空回复仅使用明确配置的兜底行为，不调用弹幕原文朗读。

- [ ] **Step 5: 映射统一优先级并保留现有 voiceManager 执行权**

将规格优先级映射到现有场景优先级（系统提示 > 游戏关键结果 > AI 主播 > 事件反馈 > 采样朗读）；必要时在 `voiceManager` 增加显式优先级字段，但继续执行现有去重、冷却、队列长度和播放超时。将全局、AI、游戏播报统一为带 owner 的队列项。

- [ ] **Step 6: 运行语音、AI 生命周期测试与类型检查**

运行：

```powershell
node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-transform-types --test src/voice/__tests__/voiceManager.test.ts src/voice/__tests__/liveAnnouncements.test.ts src/voice/__tests__/aiInteraction.test.ts src/voice/__tests__/interactionLifecycle.test.ts
pnpm type-check
```

预期：新旧队列、AI 限流和生命周期测试 PASS；不产生过期输出。

### Task 4：增加按游戏隔离的互动策略与兼容持久化

**Files:**
- Modify: `src/game/interactionTypes.ts`
- Modify: `src/game/interactionRouter.ts`
- Modify: `src/services/configApi.ts`
- Modify: `config_server.py`
- Modify: `src/views/VoiceConfigView.vue`
- Create: `src/services/__tests__/gameInteractionConfig.test.ts`
- Create: `tests/test_config_server.py`

**Interfaces:**
- `ProjectConfig.gameInteractionConfig` 的值以 `version` 和 `games: Record<GameModuleId, GameInteractionOverride>` 组织；游戏默认策略来自模块元数据，只有明确保存的覆盖项写入 `games`。
- 普通聊天设置互斥选择 `ignore | ai_host | read_sampled | game_defined`；含采样间隔/比例、允许 AI 主播、允许原文朗读及显式双路选项。
- 礼物、点赞、关注/进场/分享等策略分别表达 `game_only | game_and_global | global_only | ignore`。
- 配置保存在现有 SQLite `project_config` 新增的 JSON 列中；缺失列或旧配置时读出带默认值的配置，不覆盖旧语音全局设置。

- [ ] **Step 1: 定义 gameInteractionConfig 默认值、版本和校验测试**

为 `quiz`、`versus` 设置保守默认值：聊天 `ignore`，普通原文朗读关闭，AI 主播按现有全局 AI 开关受控；游戏命令认领高于聊天配置；非聊天事件按当前“游戏处理并保留已启用全局播报”的行为提供兼容默认值。测试错误版本、未知游戏 ID、越界采样值和不允许的双路配置均被拒绝或归一化。

- [ ] **Step 2: 将默认值与明确覆盖合并到路由决策**

为每个模块提供 `interactionDefaults`；路由器解析 `gameInteractionConfig.games[id]` 覆盖。解析结果不得修改全局 `voiceConfig.chat` 或 `aiInteraction`；安全黑名单、平台限制、AI 速率和会话频率上限始终取全局更严格值。

- [ ] **Step 3: 在 SQLite/API 中新增兼容字段**

在 `config_server.py:init_db()` 为 `project_config` 增加 `game_interaction_config` JSON 列；`read_config()` 对旧数据返回模块默认配置；`PUT /api/config` 校验并保存新字段。不得清空或重写 `voice_config`、既有 `quiz_config`、AI API Key 或直播配置。前端 `ProjectConfig` 和默认配置同步添加 `gameInteractionConfig`。

- [ ] **Step 4: 添加策略控制界面**

在智能朗读工作台增加按游戏切换的游戏互动策略区域，提供互斥策略控件、原文采样限制、AI 主播开关、双路显式开关和礼物/点赞/关注事件选项。保存走现有项目配置 API；首次启用显示模块默认值，不自动改写历史全局聊天设置。

- [ ] **Step 5: 测试旧配置迁移与配置往返**

测试没有 `gameInteractionConfig` 的 API 响应可读、保存后读回值一致；缺省配置不改变旧 `voiceConfig`；单个游戏策略覆盖不会污染另一个游戏或无游戏全局模式。

- [ ] **Step 6: 运行配置和后端测试**

运行：

```powershell
node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-transform-types --test src/services/__tests__/gameInteractionConfig.test.ts src/game/__tests__/interactionRouter.test.ts
python -m unittest
pnpm type-check
```

`tests/test_config_server.py` 至少验证：旧数据库缺少 `game_interaction_config` 时初始化成功且保留全局配置；新配置可经 `read_config()` 往返；非法策略返回 400 且不覆写存量配置。

预期：配置往返、旧数据兼容、路由覆盖测试和 Python 单元测试通过。

### Task 5：验证 AI 主播与 AI 游戏代理是不同权限和输出通道

**Files:**
- Modify: `src/game/interactionTypes.ts`
- Modify: `src/game/interactionRouter.ts`
- Modify: `src/game/gameRegistry.ts`
- Modify: `src/services/configApi.ts`
- Modify: `config_server.py`
- Create: `src/game/aiAgent.ts`
- Create: `src/game/__tests__/aiAgent.test.ts`
- Create: `src/services/__tests__/aiGameAction.test.ts`
- Modify: `tests/test_config_server.py`

**Interfaces:**
- AI 主播意图使用 `AiHostIntent`，输入观众消息与主播互动策略，输出仅为可选自然语言回应。
- AI 游戏代理意图使用 `AiGameAgentIntent`，输入最小必要状态、`stateVersion` 和模块给出的 `legalActions`；返回值必须是 `{ action: string }` 中的一个合法动作。
- `GameModuleDefinition` 只为确实支持 AI 代理的模块提供 `getAgentContext()` 和 `applyAgentAction(action, expectedStateVersion)`；应用动作前再次通过 `isLegalAction` 和版本号检查。
- AI 游戏代理与 AI 主播使用不同请求类型、上下文、限流预算和 owner；代理输出不直接进入 TTS。

- [ ] **Step 1: 为 AI 代理动作校验写单元测试**

使用测试替身模块验证：合法动作由模块确定性应用；不在 `legalActions` 中的动作被拒绝；状态版本变化后拒绝旧动作；AI 请求超时或游戏停止后不应用动作；代理结果不会被当作 AI 主播文本播报。

- [ ] **Step 2: 实现可独立测试的代理结果校验器**

在 `aiAgent.ts` 定义并实现请求输入限制、返回 JSON 提取、动作枚举校验、超时和 `AbortSignal` 检查。校验器只返回合法动作候选，不接收游戏 store 写入函数，不直接修改分数、状态或胜负。

- [ ] **Step 3: 增加独立服务端 AI 游戏动作端点**

在 `config_server.py` 增加 `/api/ai/game-action`，沿用现有模型连接配置和 OpenAI 兼容 HTTP 调用，但要求传入有界的 `legalActions` 与状态摘要；明确提示模型只能从给定集合选择并返回 JSON。拒绝空动作集、超长上下文和非法响应。`src/services/configApi.ts` 增加对应客户端方法并透传 `AbortSignal`，网络错误不回退到主播回应或朗读输入文本。

- [ ] **Step 4: 将代理能力挂到模块契约并以测试替身验证**

为支持代理的模块声明上下文、合法动作和带版本的应用接口；router 调用代理执行器，之后只把通过模块校验的动作交回 `applyAgentAction`。不改写现有 quiz/versus 胜负逻辑，不在此任务增加动态插件系统或新的玩家游戏 UI。

- [ ] **Step 5: 运行代理、安全边界和端到端路由测试**

在 `tests/test_config_server.py` 覆盖新端点对空合法动作集、超长上下文和模型非法动作文本的拒绝；模拟模型 HTTP 返回，不连接真实 AI 服务。

运行：

```powershell
node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-transform-types --test src/game/__tests__/*.test.ts src/services/__tests__/*.test.ts src/voice/__tests__/*.test.ts
python -m unittest
pnpm type-check
pnpm build-only
```

预期：合法动作边界、AI 主播/代理分离、真实与仿真同路由、过期输出取消和构建检查均通过。测试不得调用真实 AI 服务或 TTS。

## 端到端验收清单

- [ ] quiz 收到有效 A/B/C/D 时只按游戏规则更新状态，不触发通用 AI 或原文朗读。
- [ ] quiz/versus 普通聊天严格按该游戏配置处理；无游戏时维持原全局配置。
- [ ] AI 主播回应与原文朗读默认互斥；AI 不回应、超时或失败不会暗中朗读弹幕。
- [ ] 礼物/点赞游戏效果与全局事件播报可分别配置，并以事件 ID 去重。
- [ ] 直播消息和仿真消息产生相同路由结果。
- [ ] 停止/切换游戏或断开会话后，旧 AI 请求、文本发布和语音意图均失效。
- [ ] AI 游戏代理只能提出当前合法动作；非法动作、旧状态动作和超时结果均不改变游戏状态。
- [ ] 旧版 SQLite 配置保留全局语音/AI 设置；游戏级默认值首次出现不会静默覆盖旧偏好。
- [ ] 所有测试、类型检查、生产构建和 `git diff --check` 通过。

## 计划自检

- 规格的事件标准化、逐事件游戏语义、全局/游戏级策略、非聊天事件、语音意图、优先级、生命周期和仿真一致性分别由 Tasks 1–4 覆盖。
- AI 主播与 AI 游戏代理的上下文隔离、合法动作集合、状态版本和失败关闭由 Task 5 覆盖。
- 不新增第三方插件加载；采用现有静态注册表。
- 测试执行器、数据库、前后端配置和现有 TTS 队列均明确纳入，不存在“以后再补”的占位步骤。
