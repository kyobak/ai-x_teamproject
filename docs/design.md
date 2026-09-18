# UI/UX 디자인 (Figma)

- Figma 파일: https://www.figma.com/design/DfNWMFeY7cNgnY3bB54BHu (팀 굳건 소유 팀 드라이브)
- 화면 5개: `01 Home · 대시보드`, `02 학식 상세`, `03 세탁실 · 가상 대기열`, `04 셔틀 (Should)`, `05 관리 · 수동 입력` (375×812, iPhone 기준)
- 색 토큰은 Figma 변수 컬렉션 `Tokens` 와 웹앱(Tailwind 클래스)이 같은 값을 씁니다.

## 디자인 토큰

| 토큰 | 값 | 웹앱 사용처 |
|---|---|---|
| color/brand | #0E4A84 | 테마색, 그래프 선 |
| color/bg | #F8FAFC | 페이지 배경 (`bg-slate-50`) |
| color/surface | #FFFFFF | 카드 |
| color/ink | #0F172A | 본문 (`text-slate-900`) |
| color/muted | #64748B | 보조 텍스트 (`text-slate-500`) |
| color/relaxed | #10B981 / soft #ECFDF5 | 여유 (`emerald`) |
| color/normal | #F59E0B / soft #FFFBEB | 보통 (`amber`) |
| color/crowded | #F43F5E / soft #FFF1F2 | 혼잡 (`rose`) |
| color/in-use | #2563EB | 세탁기 사용 중 (`blue-600`) |

## UX 원칙 (계획서 → 화면)
1. **숫자보다 단계 먼저**: 카드 상단에 여유/보통/혼잡 배지, 그 아래 큰 숫자("약 2분"). 색만으로 구분하지 않고 글자를 항상 같이 표시.
2. **출처를 숨기지 않음**: 모든 수치 밑에 `● 카메라 실측 · n초 전` 또는 `◐ 시간대 예측 · 카메라 신호 없음`. 추정값이 실측처럼 보이면 안 됨(REQ-VIS-03, REQ-LAU-06).
3. **계산식을 화면에**: 학식 상세의 `8 ÷ 16 = 0.5` 블록. "인원 ≠ 대기시간" 을 설명하는 발표 장면.
4. **엄지 도달 범위**: 하단 탭 4개(홈·세탁실·셔틀·관리), 주요 버튼은 카드 하단.
5. **호출은 놓치지 않게**: 푸시 + 앱 상단 초록 배너 + 카드의 맥동하는 "내 차례! 사용 시작" 버튼. iOS 푸시 제약의 대체 경로.
6. **실물 우선 원칙 문구**: 세탁실 첫 줄에 "앱은 안내 도구이며 먼저 온 사람이 우선".

## 남은 디자인 작업
- 컴포넌트화(Badge, Card, MachineCard, BottomNav)와 변수 바인딩 — 지금은 프레임에 색을 직접 칠함
- 빈 상태/오류 상태(서버 연결 안 됨) 화면
- 다크 모드, 영어 UI(Could)
