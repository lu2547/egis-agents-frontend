from pydantic import BaseModel, Field


class DashboardSummary(BaseModel):
    platform_name: str
    learning_progress: int = Field(ge=0, le=100)
    active_agents: int = Field(ge=0)
    published_skills: int = Field(ge=0)
    weekly_points: int = Field(ge=0)


class Course(BaseModel):
    id: str
    title: str
    content_type: str
    progress: int = Field(ge=0, le=100)
    lesson_count: int = Field(ge=0)


class CapabilitySet(BaseModel):
    id: str
    name: str
    description: str
    skill_count: int = Field(ge=0)


class LeaderboardEntry(BaseModel):
    rank: int = Field(ge=1)
    name: str
    team: str
    score: int = Field(ge=0)
    delta: str
