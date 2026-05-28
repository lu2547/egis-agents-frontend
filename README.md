# egis-agents-frontend

养老险GPT 前端项目，面向企业养老险业务场景，提供学习、知识检索、智能对话与 Agent Playground 的统一工作台。项目采用 Vue 3 + TDesign 风格构建，后端对接 [egis-agents](../egis-agents) 的 AGUI/SSE 对话协议与智能体能力。

---

## 架构概览

```
egis-agents-frontend/
├── frontend/                         # Vue 3 + Vite 前端应用
│   ├── src/
│   │   ├── components/
│   │   │   └── AppShell.vue          # 顶部栏与左侧导航框架
│   │   ├── views/
│   │   │   ├── HomeView.vue          # 首页工作台
│   │   │   ├── ChatView.vue          # 对话页面模板与样式
│   │   │   ├── chat/                 # 对话页可维护逻辑模块
│   │   │   │   ├── constants.ts      # Agent 与资料库静态配置
│   │   │   │   ├── markdown.ts       # Markdown 渲染
│   │   │   │   ├── scope.ts          # 资料范围 / tag / file 选择
│   │   │   │   ├── stream.ts         # AGUI SSE 事件解析
│   │   │   │   ├── todo.ts           # todo_write 计划展示逻辑
│   │   │   │   ├── types.ts          # 页面类型定义
│   │   │   │   └── useChat.ts        # 会话状态与流式请求
│   │   │   ├── KnowledgeView.vue     # 知识库页面
│   │   │   ├── LearningView.vue      # 学习中心页面
│   │   │   └── PlaygroundView.vue    # Playground 页面
│   │   ├── router.ts                 # 前端路由
│   │   └── styles.css                # 全局样式
│   ├── vite.config.ts                # Vite 配置与后端代理
│   └── package.json
├── backend/                          # FastAPI 后端骨架（平台业务 API 预留）
├── docs/                             # 实施计划与迭代说明
└── enterprise-ai-training-platform-design.md
```

---

## 功能总览

### 首页工作台

养老险GPT 的第一屏工作台，参考 Alpha派/PaiWork 风格设计。

- **一键唤醒 Agent**：智能问答、年金业务助手、IT 智能问答、消保智能问答
- **Playground Banner**：展示“Playground 功能即将上线，尽情期待”
- **左侧导航**：首页、对话、知识库、学习、Playground
- **响应式布局**：紧凑卡片与自适应内容区

### 对话页

对接 `egis-agents` 后端智能体，使用 AGUI/SSE 协议接收流式消息。

- **Agent 切换**：通用 Agent 与年金 Agent 分区展示
- **资料范围选择**：互联网搜索、公共库、属主库、个人库
- **精准资料筛选**：按库选择 tag tree 和文件
- **计划过程展示**：监听 `todo_write` 的 `frontend_digest`，展示步骤状态跳转
- **Markdown 输出**：支持标题、列表、粗体、代码块、表格等常见 Markdown
- **AGUI 兼容**：兼容 raw AGUI、enterprise envelope 与 `response.ui.component`

### 知识库

知识库页面用于承载后续资料管理能力。

- 公共库：养老险制度库、产品资料库、投研资料库
- 属主库：培训部知识库、消保合规库、IT 服务库
- 个人库：我的上传、我的会议、我的收藏
- tag tree 与文件级精准指定能力已在对话页资料范围弹窗中先行验证

### 学习平台

用于企业养老险 AI 培训场景。

- Markdown / PPT 课程学习
- 新人培训、合规问答、企业年金方案顾问课
- 测验、任务进度与学习记录能力预留

### Playground

面向业务人员的 Agent 发布与能力编排入口。

- 选择能力集
- 自定义 Skills
- 验证通过后发布 Agent
- 当前处于 UI 占位与流程规划阶段

---

## 与 egis-agents 后端联动

前端对话页通过 Vite proxy 调用后端 `/api/chat`，请求体包含：

```json
{
  "agent_id": "intelligent_qa",
  "message": "用户问题",
  "session_id": "可选会话 ID",
  "stream": true,
  "protocol": "agui",
  "user_id": "egis-agents-frontend-user",
  "context": {
    "selected_frontend_agent": "it-qa",
    "frontend": "egis-agents-frontend",
    "retrieval_scope": {
      "internet_search": true,
      "library_ids": [],
      "tag_ids": [],
      "file_ids": []
    }
  }
}
```

前端重点处理以下流式事件：

| 事件 / 数据                  | 用途                                  |
| ---------------------------- | ------------------------------------- |
| `frontend_digest.todo_write` | 计划卡片与步骤状态刷新                |
| `text_message_content`       | reasoning / thinking 流式增量展示     |
| `response.content.delta`     | AGUI 内容增量兼容                     |
| `run_finished`               | 最终答案与完成态兑底                  |
| `run_error`                  | 错误展示                              |

---

## 本地启动

### 前端

```bash
cd frontend
npm install
npm run dev
```

默认开发地址：

```text
http://localhost:5177/
```

构建：

```bash
npm run build
```

### 后端骨架

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

实际智能体对话能力由同级 `egis-agents` 服务提供。

---

## 开发约定

- 页面视觉优先保持 Alpha派/PaiWork 风格：紧凑、专业、清晰
- 对话页复杂逻辑放在 `frontend/src/views/chat/` 下，避免继续膨胀 `ChatView.vue`
- 后端流式协议以 AGUI 为主，企业封装格式通过 `stream.ts` 兼容
- 资料范围状态统一从 `scope.ts` 输出，避免模板中散落业务判断
- `todo_write` 是计划状态唯一来源，前端不伪造完整步骤，只在计划未到达前展示轻量运行态

---

## 关联文档

- `enterprise-ai-training-platform-design.md`：养老险GPT 平台需求分析与总体设计
- `docs/implementation-plan.md`：实施计划
- `docs/next-steps.md`：下一步迭代任务
- `../egis-agents/README.md`：后端智能体服务说明
