import type { CodingMode } from './types';

/** build / plan 模式定义（agent_id 对齐后端 agent.json）。 */
export const CODING_MODES: Array<{
    mode: CodingMode;
    agentId: string;
    name: string;
    description: string;
}> = [
        {
            mode: 'build',
            agentId: 'coding',
            name: '构建',
            description: '读代码、改代码、执行命令'
        },
        {
            mode: 'plan',
            agentId: 'coding-plan',
            name: '规划',
            description: '只读调研与方案产出，不做任何修改'
        }
    ];

export const codingModeMap = Object.fromEntries(CODING_MODES.map((item) => [item.mode, item]));

/** 多租户 workspace 用户标识（与对话 ChatView 保持一致）。 */
export const CODING_USER_ID = 'egis-agent-frontend-user';

/** 空态示例提示 */
export const CODING_EXAMPLES = [
    '给 README 增加 Installation 章节',
    '找出项目里的 TODO 注释并汇总',
    '解释这个项目的目录结构与启动方式'
];

/** slash 命令面板：输入 / 开关时的提示与示例。 */
export const LOCAL_DIR_EXAMPLE = '/Users/frankie/Documents/note/llm-wiki';

/** 绑定串构造：本地目录 → "local:<绝对路径>"。 */
export const localBinding = (dir: string) => `local:${dir.trim()}`;

/** 从绑定串提取展示路径（"local:/a/b" → "/a/b"）。 */
export const bindingDisplayPath = (workspaceRoot: string) =>
    workspaceRoot.startsWith('local:') ? workspaceRoot.slice('local:'.length) : workspaceRoot;
