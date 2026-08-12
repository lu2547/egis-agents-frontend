# MeetingAssistant 智能会议管理 · 技术设计

> 前端：egis-agent-frontend（Vue 3 + TDesign + Vite，Playground 子面板）
> 后端：egis-training-agent（meeting_agent，AGUI 协议，端口 48081）

## 一、总体架构

```
用户 ──▶ Playground（PlaygroundView.vue）
            └─▶ MeetingAssistantPanel.vue（嵌入式面板）
                  ├─ 表单操作 ──▶ api.ts（axios）──▶ /api/meeting/*      ──▶ egis-training-agent
                  ├─ 助手对话 ──▶ streamAgentMessage（fetch SSE）──▶ /api/chat（AGUI）──▶ meeting_agent
                  └─ 实时提醒 ──▶ EventSource ──▶ /api/notifications/*/stream ──▶ 通知服务
```

三条通道统一经 Vite dev proxy 转发到 `API_PORT=48081`（.env 配置），生产环境由后端静态托管 dist。

## 二、前端模块设计

### 2.1 目录结构

```
frontend/src/views/
├── PlaygroundView.vue                 # 功能选择 + 面板挂载（feature registry）
└── playground/meeting/
    ├── MeetingAssistantPanel.vue      # 会议管理面板（整页迁移 + 嵌入改造）
    └── api.ts                         # 会议域 API + SSE 封装
```

### 2.2 Playground 集成

- `PlaygroundView` 以 feature 数组注册功能卡片，`active` 切换 `v-if` 渲染对应面板
- MeetingAssistant 由原「即将上线」占位改为挂载 `MeetingAssistantPanel`
- `.pg-content` 采用 flex 列布局 + `flex: 1 1 auto; min-height: 0`，保证面板 `height: 100%` 可正确撑满

### 2.3 MeetingAssistantPanel 组件设计

原独立 SPA 页面改造为嵌入面板的关键调整：

| 项       | 原实现                   | 改造后                                                                              |
| -------- | ------------------------ | ----------------------------------------------------------------------------------- |
| 根容器   | `min-height: 100vh` 整页 | `height: 100%` flex 列，溢出隐藏                                                    |
| 主布局   | body 滚动                | `.layout` 内部滚动，筛选栏 sticky                                                   |
| 聊天浮层 | `position: fixed` 全屏   | `position: absolute` 限制在面板内                                                   |
| 生命周期 | 页面级                   | `onMounted` 拉数据 + 建 SSE，`onUnmounted` 关闭 EventSource（随 v-if 切换正确释放） |

状态划分：

- `filters`（reactive）：日期/时段/人数/设备筛选条件
- `rooms` / `reservations`（ref）：查询结果，`availableCount` 派生
- `booking`（reactive）+ `bookingVisible`：预定对话框状态机
- 聊天域：`chatMessages` / `chatSessionId` / `chatLoading`，消息模型 `{role, kind: answer|error, title?, content}`

### 2.4 交互流程

**预定流程**：打开对话框 → 表单校验 → `POST /api/meeting/reservations` → 成功 toast + 关闭 + `refreshAll()`；失败读取 `error.response.data.detail`。

**助手对话流程**：
1. 用户消息入列，创建空 assistant 占位消息
2. `POST /api/chat`（AGUI SSE），按行解析 `event:` / `data:`
3. `text_message_content` 增量拼接（跳过 `content_kind === 'a2ui'`）；`run_finished` 以完整 message 收尾；`run_error` 置错误样式
4. finally 中 `refreshAll()`，保证 Agent 侧操作（订/取消）后页面数据同步

**通知流程**：
1. `onMounted` 建立 `EventSource(/api/notifications/meeting_agent/{user}/stream)`
2. `connected` 事件触发后补拉未读（`listNotifications`），逐条回放
3. 新通知去重（`notification_id` Set）；若对应会议已取消则静默标记已读
4. 有效提醒：打开聊天面板 → 推送提醒卡片 → 标记已读 → 刷新数据

## 三、接口设计

| 通道 | 接口                                             | 方法     | 说明                                                                                     |
| ---- | ------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------- |
| REST | `/api/meeting/rooms`                             | GET      | 参数：date/start_time/end_time/capacity/equipment；返回 rooms（含 available、conflicts） |
| REST | `/api/meeting/reservations`                      | GET/POST | 列表（status=booked）/ 创建预定                                                          |
| REST | `/api/meeting/reservations/{id}`                 | DELETE   | body.reason，取消预定                                                                    |
| SSE  | `/api/chat`                                      | POST     | agent_id=meeting_agent, stream=true, protocol=agui, run_mode=flash                       |
| REST | `/api/notifications/meeting_agent/{user}`        | GET      | 未读通知列表                                                                             |
| REST | `/api/notifications/meeting_agent/{user}/read`   | POST     | 批量标记已读                                                                             |
| SSE  | `/api/notifications/meeting_agent/{user}/stream` | GET      | connected / new_notification 两类事件                                                    |

### AGUI 事件处理表

| 事件                    | 处理                                  |
| ----------------------- | ------------------------------------- |
| `text_message_content`  | 增量追加 delta（a2ui 类型跳过）       |
| `run_finished`          | 用完整 message 覆盖，保证最终一致     |
| `run_error`             | 消息置 error 样式，展示 error_message |
| 其他（thinking/tool_*） | 忽略（flash + minimal 模式）          |

请求上下文固定注入：`run_mode: flash`、`user:display_mode: minimal`、`frontend: egis-agent-frontend`。

## 四、代理与部署

vite.config.ts proxy（统一指向 `API_HOST:API_PORT`，默认 localhost:48081）：

- `/api/chat`、`/api/playground`（既有）
- `/api/meeting`、`/api/notifications`（本次新增）

## 五、异常与边界

- 后端不可用：REST 失败走 axios 错误提示；SSE fetch 非 200 抛出并在气泡内展示
- 面板切换：v-if 卸载触发 `onUnmounted`，EventSource 显式 close，无连接泄漏
- 通知与取消竞态：展示前复查预定是否仍存在，已取消则不弹
- 流式解析：按 `\n` 切行维护 buffer，处理跨包分片与尾部残留 data

## 六、后续演进

- a2ui 富交互卡片渲染（当前跳过，预留 content_kind 分支）
- 聊天历史持久化（当前仅内存态，随面板关闭重置）
- 参会人从组织架构选择替代手工输入
