from pathlib import Path

from fastapi import APIRouter, Request

router = APIRouter()

LOG_PATH = Path(__file__).resolve().parents[3] / ".cursor" / "debug-fc4923.log"


@router.post("/debug/agent-log")
async def agent_log(request: Request) -> dict[str, bool]:
    body = await request.body()
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("ab") as log_file:
        log_file.write(body.strip() + b"\n")
    return {"ok": True}
