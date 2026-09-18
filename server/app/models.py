"""
요청/응답 스키마 (pydantic).

FastAPI 는 이 클래스들로 요청 본문을 검증하고(잘못된 값이면 422 응답) /docs 에 자동 문서를 만듭니다.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class VisionMetricIn(BaseModel):
    """엣지 기기(vision/run_video.py)가 보내는 숫자. 프레임·좌표는 받을 필드가 없습니다 (REQ-VIS-01).
    extra="forbid": 정의되지 않은 필드(예: image, frame)가 오면 422 로 거부합니다. 저장 금지를 API 수준에서도 강제."""
    model_config = ConfigDict(extra="forbid")
    resource_id: str
    people_count: int = Field(ge=0)
    throughput_per_min: float | None = Field(default=None, ge=0, description="통과선이 시야에 없으면 None")
    confidence: float = Field(ge=0, le=1)
    device_id: str = "edge-demo"
    avg_dwell_sec: float | None = Field(default=None, ge=0, description="구역 안 평균 체류 시간(초). 추적 ID 로 계산")
    zone_type: str | None = Field(default=None, pattern=r"^(queue|room)$", description="queue=대기줄, room=실내 재실")


class VibrationSampleIn(BaseModel):
    """진동 센서(또는 sensors/simulate_washer.py)가 보내는 샘플."""
    resource_id: str
    magnitude: float = Field(ge=0, description="|가속도| - 1g, 단위 g")
    ts: str | None = Field(default=None, description="ISO8601. 생략하면 서버 수신 시각")


class QueueJoinIn(BaseModel):
    device_id: str


class QueueActionIn(BaseModel):
    device_id: str


class ReportIn(BaseModel):
    resource_id: str
    level: int = Field(ge=1, le=5, description="1 여유 ~ 5 매우 혼잡")
    device_id: str


class AdminStatusIn(BaseModel):
    resource_id: str
    state: str | None = None               # 세탁기: available|in_use|unknown
    occupancy_level: str | None = None     # relaxed|normal|crowded
    occupancy_count: int | None = None     # 오픈스페이스/주차 잔여 등 숫자


class PushSubscribeIn(BaseModel):
    device_id: str
    subscription: dict          # 브라우저 PushSubscription.toJSON() 그대로 {endpoint, keys:{p256dh, auth}}


class CheckinIn(BaseModel):
    device_id: str


class ResourceIn(BaseModel):
    """관리자 자원 등록. id 는 영문 소문자·숫자·하이픈만."""
    id: str = Field(pattern=r"^[a-z0-9-]{3,40}$")
    kind: str = Field(pattern=r"^(laundry|space|shuttle|cafeteria|parking)$")
    zone: str
    name: str
    capacity: int | None = None
    source: str = "admin"       # vision | sensor | qr | admin | report
    extra: dict = {}


class AuthIn(BaseModel):
    nickname: str = Field(min_length=2, max_length=20)
    password: str = Field(min_length=4, max_length=64)


class PrefsIn(BaseModel):
    """내 정보 페이지. 전부 선택 항목이며 학번·실명은 없습니다."""
    dorm: str | None = None             # injae | changui | haengbok | none
    favorite_cafeteria: str | None = None
    default_stop: str | None = None     # 셔틀 기본 정류장 자원 id
    notify_queue: bool = True
    notify_shuttle: bool = False
    lang: str = "ko"
