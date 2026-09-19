/**
 * 서버에서 오는 "데이터 문자열"(식당·건물·메뉴 이름, 출처 설명, 운영 시간, 오류 메시지)의 영어 번역.
 *
 * 왜 서버가 아니라 화면에서 번역하나: 서버는 여러 사용자에게 같은 데이터를 SSE 로 뿌리므로, 사람마다 다른 언어를 고르면
 * 화면 쪽에서 바꾸는 편이 단순합니다. 서버 문장은 종류가 정해져 있어(시드 데이터 + 고정 문구) 사전 하나로 충분합니다.
 *
 * 방식: 긴 구절부터 순서대로 치환합니다. ("학생식당 A코스" 가 "학생식당" 보다 먼저 바뀌어야 뜻이 맞으므로)
 * 사전에 없는 새 한글이 들어오면 그 부분만 한글로 남습니다 → 이 파일에 한 줄 추가하면 됩니다.
 */
const PHRASES: Record<string, string> = {
  // ---- 출처·상태 설명 (server/app/services.py, logic/wait_time.py) ----
  "카메라 실측 (줄 인원 ÷ 분당 처리 인원)": "Measured by camera (people in line ÷ served per min)",
  "인원은 카메라 실측, 처리율은 시간대 평균 상수 (추정)": "Count by camera, service rate from hourly average (estimate)",
  "카메라 신호 없음 · 수동 입력은 30분간 유효": "No camera signal · manual input valid for 30 min",
  "카메라 신호 없음 · 최근 30분 제보 평균": "No camera signal · average of reports in the last 30 min",
  "카메라 신호 없음 · 요일·시간대 과거 평균": "No camera signal · historical average for this time slot",
  "카메라 재실 인원 계수 (앉은 사람 포함, 영상 저장 없음)": "Camera occupancy count (incl. seated people, no video stored)",
  "관리자 수동 입력 (30분간 유효)": "Manual admin input (valid 30 min)",
  "관리자 수동 입력 (목업)": "Manual admin input (mock)",
  "데이터 없음 (Could 범위)": "No data",
  "카메라 신호 없음": "No camera signal",
  "카메라 연결 전": "before camera hookup",
  "센서 연결 전": "before sensor hookup",
  "주차관제 연동 전": "before parking-system hookup",
  "진동 센서 실측": "Vibration sensor",
  "데이터 없음": "No data",
  // ---- 서버 오류 메시지 (routers/*.py) ----
  "이미 사용 중인 닉네임입니다": "That nickname is already taken",
  "닉네임 또는 비밀번호가 틀립니다": "Wrong nickname or password",
  "세션이 만료되었습니다. 다시 로그인하세요": "Session expired. Please log in again",
  "줄 서기는 로그인 후 이용할 수 있습니다": "Please log in to join the queue",
  "로그인이 필요합니다": "Login required",
  "이미 이 기기 대기열에 등록되어 있습니다": "You are already in this machine's queue",
  "같은 장소에는 10분에 한 번만 제보할 수 있습니다": "You can report the same place once every 10 minutes",
  "관리자 PIN 이 틀립니다": "Wrong admin PIN",
  "호출된 티켓이 없습니다": "You have not been called yet",
  "서버에 연결할 수 없습니다": "Cannot reach the server",
  "백엔드가 켜져 있는지 확인하세요.": "Check that the backend is running.",
  // ---- 식당·매장 ----
  "푸드코트 (학생복지관)": "Food Court (Student Welfare Bldg)",
  "창의관 푸드코트": "Changui Hall Food Court",
  "창업보육센터식당": "Business Incubator Cafeteria",
  "창의인재원식당": "Changui Residence Cafeteria",
  "교직원식당": "Faculty Cafeteria",
  "학생식당": "Student Cafeteria",
  "창의관식당": "Changui Hall Cafeteria",
  "33떡볶이&꼬마김밥": "33 Tteokbokki & Mini Gimbap",
  "더베이크 한양대에리카점": "The Bake (Hanyang ERICA)",
  "오가다 안산상록구직영점": "Ogada (Ansan Sangnok)",
  "행복한 짬뽕": "Happy Jjamppong",
  "한양베이커리": "Hanyang Bakery",
  "bhc 치킨": "bhc Chicken",
  "바비든든": "Babi Deunden",
  "바르바커피": "Barba Coffee",
  "리플커피": "Ripple Coffee",
  "그라찌에": "Grazie",
  "스타벅스": "Starbucks",
  "산쪼메": "Sanjjome",
  "이모네": "Imone",
  "매장별 상이 (대체로 10:00~19:30)": "Varies by store (mostly 10:00–19:30)",
  "매장별 상이": "Varies by store",
  "(매장명 확인 필요)": "(names to be confirmed)",
  "매장": "Store",
  "식당": "Food",
  "카페": "Café",
  "편의점": "Convenience",
  // ---- 메뉴 코스 (복지포털 데이터) ----
  "창업보육센터식당 오늘의 백반": "Incubator set meal of the day",
  "창업보육센터식당 저녁 백반": "Incubator dinner set meal",
  "창의관 아침 백반": "Changui breakfast set meal",
  "창의관 저녁 정식": "Changui dinner set",
  "창의관 중식 A코스": "Changui lunch course A",
  "창의관 중식 B코스 (일품)": "Changui lunch course B (one-dish)",
  "학생식당 A코스 (뚝배기)": "Student Cafeteria course A (hot pot)",
  "학생식당 B코스 (양식)": "Student Cafeteria course B (Western)",
  "학생식당 토스트 세트": "Student Cafeteria toast set",
  "교직원 일식 돈부리": "Faculty Japanese donburi",
  "교직원 한식 뷔페": "Faculty Korean buffet",
  // ---- 메뉴 항목 ----
  "쌈채소 및 쌈장": "Lettuce wraps & ssamjang", "돼지고기 김치찌개": "Pork kimchi stew", "매콤 닭갈비 볶음": "Spicy stir-fried dakgalbi",
  "갓 구운 계란말이": "Fresh rolled omelette", "수제 등심돈까스": "Handmade pork loin cutlet", "소고기 미역국": "Beef seaweed soup",
  "부대찌개 정식": "Budae-jjigae set", "매콤 제육덮밥": "Spicy pork rice bowl", "따뜻한 계란국": "Warm egg soup",
  "우삼겹 불고기": "Beef brisket bulgogi", "양배추 샐러드": "Cabbage salad", "딸기잼/버터": "Strawberry jam/butter",
  "대구 맑은탕": "Clear cod soup", "양송이 스프": "Mushroom soup", "치즈 돈까스": "Cheese pork cutlet", "수제 가츠동": "Handmade katsudon",
  "우동 샐러드": "Udon salad", "맑은 무국": "Clear radish soup", "모닝 토스트": "Morning toast", "브라운 소스": "Brown sauce",
  "시금치나물": "Seasoned spinach", "단무지무침": "Seasoned pickled radish", "오삼불고기": "Squid & pork bulgogi", "어묵볶음": "Stir-fried fish cake",
  "두부조림": "Braised tofu", "숙주나물": "Seasoned bean sprouts", "된장찌개": "Doenjang stew", "계란말이": "Rolled omelette",
  "배추김치": "Napa cabbage kimchi", "삶은 계란": "Boiled egg", "라면사리": "Ramen noodles", "미소시루": "Miso soup",
  "흰쌀밥": "White rice", "잡곡밥": "Multigrain rice", "마카로니": "Macaroni", "요구르트": "Yogurt", "모닝빵": "Dinner roll",
  "조미김": "Seasoned laver", "겉절이": "Fresh kimchi", "깍두기": "Radish kimchi", "시리얼": "Cereal", "단무지": "Pickled radish",
  "샐러드": "Salad", "쌀밥": "Rice", "쌈무": "Pickled radish wraps", "락교": "Pickled scallions", "김치": "Kimchi", "우유": "Milk",
  // ---- 셔틀 ----
  "셔틀콕·창의인재원": "Shuttlecock & Changui Residence",
  "한대앞역": "Hanyang Univ. at Ansan Stn.",
  "창의인재원": "Changui Residence",
  "셔틀콕": "Shuttlecock",
  "예술인APT": "Artists' APT",
  // ---- 세탁실·오픈스페이스·주차 ----
  "인재관 세탁실": "Injae Hall laundry", "창의관 세탁실": "Changui Hall laundry", "행복관 세탁실": "Haengbok Hall laundry",
  "세탁기": "Washer", "건조기": "Dryer",
  "융합교육관": "Convergence Education Bldg", "경상관": "Business & Economics Bldg", "솔성관": "Solseong Hall",
  "제1공학관": "Engineering Bldg I", "제1과학기술관": "Science & Technology Bldg I", "체육관": "Gymnasium", "디자인교육관": "Design Education Bldg",
  "오픈스페이스2": "Open Space 2", "오픈스페이스": "Open Space", "상휴": "Student Lounge (Sanghyu)", "IC-PBL 꿈의 둥지": "IC-PBL Dream Nest",
  "해동학술정보실": "Haedong Study Room", "북카페": "Book Café", "디자인라운지": "Design Lounge", "팀룸 제외": "excl. team rooms",
  "정문 주차장": "Main Gate Parking", "정문": "Main Gate",
  // ---- 건물·위치 ----
  "창의관 1층 구내식당 내": "Changui Hall 1F (in cafeteria)", "버스승강장 및 휴게실": "Bus stop & lounge", "ERICA컨벤션센터": "ERICA Convention Center",
  "학생복지관": "Student Welfare Bldg", "창업보육센터": "Business Incubator", "교직원 전용": "Faculty only", "창의관": "Changui Hall",
  // ---- 운영 시간 표현 ----
  "18:30배식대마감": "serving ends 18:30", "학기중": "Semester", "방학기간": "Vacation", "방학중": "Vacation", "평일운영": "weekdays",
  "일요일,공휴일 휴무": "closed Sun & holidays", "일요일 휴무": "closed Sun", "주말, 공휴일": "Weekends & holidays", "토, 공휴일": "Sat & holidays",
  "휴식시간": "Break", "운영시간 정보 없음": "Hours not listed", "월~토요일": "Mon–Sat", "월-금": "Mon–Fri", "월~금": "Mon–Fri", "월-목": "Mon–Thu",
  "월~목": "Mon–Thu", "월-토": "Mon–Sat", "월~토": "Mon–Sat", "오전": "AM", "오후": "PM", "조식": "Breakfast", "중식": "Lunch", "석식": "Dinner",
  "확인 필요": "to be confirmed", "대체로": "mostly", "금": "Fri", "토": "Sat",
};
// 긴 구절이 먼저 바뀌도록 길이 역순 정렬 (한 번만 계산)
const KEYS = Object.keys(PHRASES).sort((a, b) => b.length - a.length);
const HANGUL = /[가-힣]/;

/** 한글 데이터 문자열 → 영어. 층·시각 표현은 규칙으로 바꿉니다 ("2층"→"2F", "지하1층"→"B1", "8시30분"→"8:30"). */
export function translateData(s: string | null | undefined): string {
  if (!s || !HANGUL.test(s)) return s ?? "";
  let out = s;
  for (const k of KEYS) if (out.includes(k)) out = out.split(k).join(PHRASES[k]);
  out = out.replace(/지하\s?(\d+)층/g, "B$1").replace(/(\d+)층/g, "$1F").replace(/(\d+)시(\d+)분/g, "$1:$2").replace(/(\d+)시/g, "$1:00")
    .replace(/(\d+)명/g, "$1").replace(/(\d+)분/g, "$1 min");
  return out;
}
