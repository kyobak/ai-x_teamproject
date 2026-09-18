# ADR-0001: 백엔드는 FastAPI + SQLite (Supabase 대신)

- 상태: 채택 (2026-09-18)
- 맥락: 계획서 권장 스택은 Supabase(Postgres, Realtime). 대안으로 FastAPI + PostgreSQL + WebSocket 을 적어 둠.

## 결정
프로토타입 단계에서는 **FastAPI + SQLite + SSE** 를 쓴다.

## 이유
1. **시연 조건**: "노트북 한 대, 와이파이 하나" 로 휴대폰에서 열려야 한다. Supabase 는 계정·프로젝트·비밀키·인터넷이 필요하다.
2. **이해 가능성**: 팀원 4명이 발표에서 코드를 설명해야 한다. ORM 없는 표준 sqlite3 + 평범한 SQL 이 가장 읽기 쉽다.
3. **비전 모듈이 어차피 Python**: 판정 로직(진동 상태기계, 대기시간)을 같은 언어로 두면 테스트를 한 곳에서 돌린다.
4. **이전 비용이 낮음**: 스키마는 계획서 데이터 모델 그대로. Postgres 로 옮길 때 `db.py` 의 DDL 과 연결 코드만 바꾸면 된다.

## 결과
- 실시간은 Supabase Realtime 대신 `events.py` 의 SSE 브로드캐스트.
- RLS(행 단위 보안)는 없다. 배포 시 관리자 API 인증과 CORS 제한을 추가해야 한다.
- 동시 접속 수십 명 수준까지는 SQLite WAL 모드로 충분.
