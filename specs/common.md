# REQ-RPT / REQ-SYS — 공통

| ID | 유형 | 요구사항 | 구현 | 테스트 |
|---|---|---|---|---|
| REQ-RPT-01 | 조건 | IF 한 기기가 같은 자원에 10분 안에 두 번째 제보를 보내면 거부하고 재제보 가능 시각을 안내해야 한다. | `routers/reports.py` (429 + retry_at) | `test_req_rpt_01_*` |
| REQ-SYS-01 | 상시 | 시스템은 학번, 이름, 위치 좌표를 저장하지 않아야 한다. | 익명 UUID, 제보 기기 해시, GPS 미사용 | `test_req_sys_01_*` |
