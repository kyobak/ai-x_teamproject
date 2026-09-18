# REQ-VIS — 영상 기반 혼잡도

| ID | 유형 | 요구사항 | 구현 | 테스트 |
|---|---|---|---|---|
| REQ-VIS-01 | 상시 | 엣지 모듈은 카메라 프레임을 디스크에 기록하거나 네트워크로 전송하지 않아야 한다. | `vision/run_video.py`(imwrite 없음), `models.VisionMetricIn extra=forbid` | `test_req_vis_01_*` |
| REQ-VIS-02 | 이벤트 | WHEN 대기 구역 인원이 갱신되면, 시스템은 인원 ÷ 분당 처리 인원의 예상 대기시간을 10초 이내에 대시보드에 반영해야 한다. | `routers/vision.py` → SSE 즉시 발행 | `test_req_vis_02_*` |
| REQ-VIS-03 | 조건 | IF 검출 신뢰도가 기준 미만이거나 엣지 신호가 60초 이상 끊기면, THEN 제보·예측값으로 대체하고 그 사실을 표시해야 한다. | `logic/wait_time.resolve_status`, 화면 `SourceNote` | `test_req_vis_03_*` |
| REQ-VIS-04 | 상시 (수치 미확정) | 평가용 영상 세트에서 줄 인원 MAE ≤ N명. 잠정 N=2, 스파이크 후 확정. 미달 시 3단계 분류 정확도로 대체. | `vision/eval/eval_counts.py` | (평가 데이터 확보 후) |
| REQ-VIS-05 | 조건 | IF 줄 구역과 통과선이 한 시야에 없으면, THEN 시간대별 평균 처리율 상수를 쓰고 추정 기반임을 표시해야 한다. | `config.FALLBACK_THROUGHPUT_BY_HOUR`, `zone.json pass_line=null` | `test_req_vis_05_*` |
