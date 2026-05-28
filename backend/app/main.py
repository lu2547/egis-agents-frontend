from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import CapabilitySet, Course, DashboardSummary, LeaderboardEntry

app = FastAPI(title="养老险GPT API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5177", "http://127.0.0.1:5177"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pension-gpt"}


@app.get("/api/dashboard", response_model=DashboardSummary)
def dashboard() -> DashboardSummary:
    return DashboardSummary(
        platform_name="养老险GPT",
        learning_progress=78,
        active_agents=12,
        published_skills=36,
        weekly_points=2021,
    )


@app.get("/api/courses", response_model=list[Course])
def courses() -> list[Course]:
    return [
        Course(
            id="course-foundation",
            title="养老险业务基础训练营",
            content_type="MD + PPT",
            progress=78,
            lesson_count=12,
        ),
        Course(
            id="course-annuity",
            title="企业年金方案顾问课",
            content_type="PPT",
            progress=45,
            lesson_count=8,
        ),
        Course(
            id="course-compliance",
            title="合规销售与风险提示",
            content_type="MD",
            progress=92,
            lesson_count=6,
        ),
    ]


@app.get("/api/capability-sets", response_model=list[CapabilitySet])
def capability_sets() -> list[CapabilitySet]:
    return [
        CapabilitySet(
            id="rag-policy",
            name="养老金政策检索",
            description="面向养老险制度、政策、产品材料的 RAG 检索能力。",
            skill_count=4,
        ),
        CapabilitySet(
            id="ppt-training",
            name="培训课件生成",
            description="将 MD、案例、测验题转换为培训 PPT 与讲师备注。",
            skill_count=5,
        ),
        CapabilitySet(
            id="agent-coach",
            name="坐席话术陪练",
            description="用于客户咨询、异议处理、合规提醒的对话式陪练。",
            skill_count=3,
        ),
    ]


@app.get("/api/leaderboards/weekly", response_model=list[LeaderboardEntry])
def weekly_leaderboard() -> list[LeaderboardEntry]:
    return [
        LeaderboardEntry(rank=1, name="林知远", team="团险培训部", score=9821, delta="+12%"),
        LeaderboardEntry(rank=2, name="周安宁", team="养老金运营", score=8750, delta="+8%"),
        LeaderboardEntry(rank=3, name="陈思齐", team="华东分公司", score=8216, delta="+5%"),
        LeaderboardEntry(rank=4, name="李青禾", team="客户成功部", score=7904, delta="+4%"),
    ]
