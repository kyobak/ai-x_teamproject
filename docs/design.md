# UI/UX 디자인 (Figma)

- Figma 파일: https://www.figma.com/design/DfNWMFeY7cNgnY3bB54BHu (팀 굳건 소유 팀 드라이브)
- 페이지 `v2 · Coinbase 가이드 + Jalnan2`: 현재 웹앱과 같은 디자인의 5화면 (375×812). `v1 · 초기 와이어프레임` 은 비교용.
- 디자인 가이드 원본: [design/DESIGN-coinbase.md](design/DESIGN-coinbase.md). Figma 변수 컬렉션 `Tokens` 와 웹앱 `globals.css` 의 `@theme` 이 같은 값.

## 가이드 → 우리 앱 적용 규칙
| 가이드 | 우리 앱 |
|---|---|
| 캔버스 순백, 브랜드 파랑 하나만 드물게 | 배경 `#ffffff`, `#0052ff` 는 주요 버튼·활성 탭·강조 숫자에만. 카드 하나에 파랑 한 번 |
| 카드 24px 라운드 + 헤어라인, 그림자 없음 | `.card` (`#dee1e6` 1px) |
| 버튼은 알약, 높이 44 | `.pill h-11` |
| 의미색(up/down)은 글자색만 | 여유 `#05b169` / 보통 `#f4b000` / 혼잡 `#cf202f` 를 배지의 점과 글자에만, 배경은 `#eef0f3` |
| 다크 히어로 + 떠 있는 제품 카드 | 홈 상단: `#0a0b0d` 밴드 위 `#16181c` 카드에 "가장 빠른 학식" |
| 숫자는 모노 | 메뉴 가격·시간표는 `font-mono` (JetBrains Mono → 없으면 시스템 모노) |
| 디스플레이 서체는 400 굵기, 자간 음수 | 잘난체 2 는 단일 굵기. 자간 -1% |

## 폰트: 잘난체 2 (Jalnan2)
- 웹앱: `apps/web/public/fonts/Jalnan2.otf` + `Jalnan2TTF.ttf`, `globals.css` 의 `@font-face`. 제목·큰 숫자·버튼·탭에만 쓰고 본문은 시스템 한글 서체 (잘난체는 굵은 제목용이라 작은 본문엔 가독성이 떨어짐).
- Figma: **Figma 는 로컬에 설치된 폰트만 씁니다.** 각자 `assets/fonts/Jalnan2.otf` 를 더블클릭 → "서체 설치" 후 Figma 를 재시작하세요. 현재 v2 프레임은 Jalnan2 가 Figma 에 잡히기 전이라 **Noto Sans KR Black 을 임시로** 쓰고 있습니다. 설치 후 아래 스크립트를 Figma MCP `use_figma` 로 실행하면 전부 교체됩니다:
```js
const page = figma.root.children.find(p => p.name.startsWith("v2")); await figma.setCurrentPageAsync(page);
await figma.loadFontAsync({family:"Jalnan2", style:"Regular"});
const texts = page.findAllWithCriteria({types:["TEXT"]}).filter(t => t.fontName.family==="Noto Sans KR" && t.fontName.style==="Black");
for (const t of texts) t.fontName = {family:"Jalnan2", style:"Regular"};
return {changed: texts.length};
```
(스타일 이름이 "Regular" 가 아니면 `figma.listAvailableFontsAsync()` 로 확인)

## 남은 디자인 작업
- 컴포넌트화(Badge, Card, MachineCard, BottomNav)와 변수 바인딩 — 지금은 프레임에 색을 직접 칠함
- 체크인 화면, 휴대폰 센서 화면, 빈 상태/오류 상태 프레임 추가
- 다크 모드
