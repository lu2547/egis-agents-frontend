import type { AgentModeInfo } from './types';

/** 模式 fallback（断网/后端未就绪时兑底；正常数据源为 GET /agents 动态拉取）。 */
export const CODING_MODES: AgentModeInfo[] = [
    {
        mode: 'build',
        agent_id: 'coding',
        name: '构建',
        description: '读代码、改代码、执行命令',
        readonly: false
    },
    {
        mode: 'plan',
        agent_id: 'coding-plan',
        name: '规划',
        description: '只读调研与方案产出，不做任何修改',
        readonly: true
    },
    {
        mode: 'bid',
        agent_id: 'bid',
        name: '标书',
        description: '生成标书文档框架：章节结构与内容要点',
        readonly: false
    }
];

/** fallback 模式映射（仅静态兑底用；动态场景用 useCodingChat 的 modes）。 */
export const codingModeMap = Object.fromEntries(CODING_MODES.map((item) => [item.mode, item]));

/** 多租户 workspace 用户标识（与对话 ChatView 保持一致）。 */
export const CODING_USER_ID = 'egis-agent-frontend-user';

/** 空态示例提示 */
export const CODING_EXAMPLES = [
    '给 README 增加 Installation 章节',
    '找出项目里的 TODO 注释并汇总',
    '解释这个项目的目录结构与启动方式'
];

/** 从绑定串提取展示路径（"local:/a/b" → "/a/b"）。 */
export const bindingDisplayPath = (workspaceRoot: string) =>
    workspaceRoot.startsWith('local:') ? workspaceRoot.slice('local:'.length) : workspaceRoot;
