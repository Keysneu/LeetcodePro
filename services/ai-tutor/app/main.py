from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel


app = FastAPI(title="LeetCodePro AI Tutor", version="0.1.0")


class ReviewRequest(BaseModel):
    problemSlug: str | None = None
    code: str | None = None
    status: str | None = None
    errorMessage: str | None = None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"service": "ai-tutor", "status": "ok"}


@app.post("/review")
async def review(payload: ReviewRequest) -> dict[str, Any]:
    if payload.status == "AC":
        guidance = (
            "你的代码已经通过，下一步尝试思考是否可以降低空间复杂度，"
            "并解释关键边界条件为什么成立。"
        )
    else:
        hint = payload.errorMessage or "暂无错误信息"
        guidance = (
            f"先从失败样例入手。当前线索：{hint}。"
            "请你手动推演一遍每次循环后的变量变化，再定位第一个偏离预期的位置。"
        )

    return {
        "guidance": guidance,
        "style": "socratic",
        "allow_full_solution": False,
    }
