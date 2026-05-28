import {
  ChatBubbleHelpIcon,
  EducationIcon,
  FileWordIcon,
  UserSafetyIcon
} from 'tdesign-icons-vue-next';
import type { AgentOption, ScopeGroup } from './types';

export const agents: AgentOption[] = [
  {
    id: 'general-qa',
    backendAgentId: 'intelligent_qa',
    title: '智能问答',
    desc: '政策制度、产品规则随问随答',
    badge: 'Hot',
    icon: ChatBubbleHelpIcon,
    tone: 'qa',
    examples: ['解释企业年金领取流程', '产品规则里缴费比例怎么约定']
  },
  {
    id: 'annuity-business',
    backendAgentId: 'annuity_query',
    title: '年金业务助手',
    desc: '方案、纪要、话术一键成稿',
    badge: 'New',
    icon: FileWordIcon,
    tone: 'doc',
    examples: ['生成企业年金客户沟通话术', '整理一份客户会议纪要']
  },
  {
    id: 'it-qa',
    backendAgentId: 'intelligent_qa',
    title: 'IT智能问答',
    desc: '课程、测验、课件快速编排',
    badge: 'New',
    icon: EducationIcon,
    tone: 'train',
    examples: ['把新人培训做成 20 分钟测验', '企业年金课程怎么拆章节']
  },
  {
    id: 'consumer-protection',
    backendAgentId: 'intelligent_qa',
    title: '消保智能问答',
    desc: '风险提示、适当性与留痕检查',
    badge: 'New',
    icon: UserSafetyIcon,
    tone: 'safe',
    examples: ['检查这段话术的适当性风险', '生成消保风险提示清单']
  }
];

export const agentMap = Object.fromEntries(agents.map((agent) => [agent.id, agent]));

export const scopeGroups: ScopeGroup[] = [
  {
    id: 'public',
    title: '公共库',
    libraries: [
      {
        id: 'public-policy',
        name: '养老险制度库',
        tags: [
          { id: 'tag-policy', name: '政策制度', children: [{ id: 'tag-payment', name: '缴费规则' }, { id: 'tag-receive', name: '领取规则' }] },
          { id: 'tag-annuity-product', name: '企业年金产品' }
        ],
        files: [
          { id: 'file-policy-2026', name: '企业年金政策汇编.pdf', tagId: 'tag-policy' },
          { id: 'file-account-rule', name: '账户管理规则.docx', tagId: 'tag-payment' }
        ]
      },
      {
        id: 'public-product',
        name: '产品资料库',
        tags: [{ id: 'tag-product', name: '产品说明' }, { id: 'tag-fee', name: '费用与账户' }],
        files: [
          { id: 'file-product-book', name: '养老险产品手册.pdf', tagId: 'tag-product' },
          { id: 'file-faq', name: '产品常见问答.md', tagId: 'tag-fee' }
        ]
      },
      {
        id: 'public-research',
        name: '投研资料库',
        tags: [{ id: 'tag-market', name: '市场观察' }, { id: 'tag-company', name: '公司研究' }],
        files: [{ id: 'file-market-weekly', name: '养老金市场周报.pdf', tagId: 'tag-market' }]
      }
    ]
  },
  {
    id: 'owner',
    title: '属主库',
    libraries: [
      {
        id: 'owner-training',
        name: '培训部知识库',
        tags: [{ id: 'tag-course', name: '课程体系' }, { id: 'tag-exam', name: '测验题库' }],
        files: [
          { id: 'file-newcomer-guide', name: '新人培训手册.pptx', tagId: 'tag-course' },
          { id: 'file-course-outline', name: '年金课程大纲.md', tagId: 'tag-course' }
        ]
      },
      {
        id: 'owner-compliance',
        name: '消保合规库',
        tags: [{ id: 'tag-risk', name: '风险提示' }, { id: 'tag-trace', name: '销售留痕' }],
        files: [{ id: 'file-consumer-rule', name: '消保话术检查清单.xlsx', tagId: 'tag-risk' }]
      },
      {
        id: 'owner-it',
        name: 'IT服务库',
        tags: [{ id: 'tag-system', name: '系统操作' }, { id: 'tag-incident', name: '常见故障' }],
        files: [{ id: 'file-it-faq', name: 'IT问答知识库.md', tagId: 'tag-system' }]
      }
    ]
  },
  {
    id: 'personal',
    title: '个人库',
    libraries: [
      {
        id: 'personal-upload',
        name: '我的上传',
        tags: [{ id: 'tag-upload-report', name: '上传报告' }, { id: 'tag-upload-plan', name: '方案材料' }],
        files: [{ id: 'file-my-plan', name: '客户年金方案草稿.docx', tagId: 'tag-upload-plan' }]
      },
      {
        id: 'personal-meeting',
        name: '我的会议',
        tags: [{ id: 'tag-meeting-note', name: '会议纪要' }, { id: 'tag-followup', name: '待跟进' }],
        files: [{ id: 'file-meeting-0527', name: '05-27 客户沟通纪要.md', tagId: 'tag-meeting-note' }]
      },
      {
        id: 'personal-favorite',
        name: '我的收藏',
        tags: [{ id: 'tag-favorite', name: '收藏资料' }],
        files: [{ id: 'file-favorite-policy', name: '重点制度摘录.pdf', tagId: 'tag-favorite' }]
      }
    ]
  }
];
