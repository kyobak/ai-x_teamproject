# REQ-LAU — 세탁실

| ID | 유형 | 요구사항 | 구현 | 테스트 |
|---|---|---|---|---|
| REQ-LAU-01 | 이벤트 | WHEN 진동 세기가 임계값을 연속 30초 이상 넘으면, '사용 중' 으로 바꾸고 감지 시각 + 기본 코스(50분)의 예상 종료 시각을 표시해야 한다. | `logic/laundry.process_sample` | `test_req_lau_01_*` |
| REQ-LAU-02 | 이벤트 (T 미확정) | WHEN '사용 중' 기기에서 무진동이 T분(초깃값 5) 연속되면 '사용 가능' 으로 바꿔야 한다. | 〃 | `test_req_lau_02_*` |
| REQ-LAU-03 | 조건 | IF 예상 종료 시각이 지났는데 진동이 계속되면, '사용 중' 을 유지하고 '동작 중' 으로 표시해야 한다. | `logic/laundry.display_info` | `test_req_lau_03_*` |
| REQ-LAU-04 | 이벤트 | WHEN 대기열이 있는 기기가 '사용 가능' 으로 바뀌면 1순위에게 5초 이내 알림을 보내야 한다. | `services.process_queue` → SSE `queue_called` → 배너/Notification | `test_req_lau_04_*` |
| REQ-LAU-05 | 조건 | IF 호출된 대기자가 5분 안에 사용을 시작하지 않으면 순번을 만료하고 다음을 호출해야 한다. | `logic/queue.expired_calls`, 주기 작업 | `test_req_lau_05_*` |
| REQ-LAU-06 | 상시 | 예상 종료 시각을 추정값으로 표시해야 하며 확정처럼 보이게 해서는 안 된다. | `display_info` 문구, `MachineCard` | `test_req_lau_06_*` |
| REQ-LAU-07 | 조건 | IF 센서 신호가 30분 이상 없으면 '상태 불명' 으로 표시하고 호출 대상에서 제외해야 한다. | `mark_stale_if_needed`, `process_queue` | `test_req_lau_07_*` |
