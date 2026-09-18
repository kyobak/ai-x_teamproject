/**
 * 익명 기기 ID. 학번·이름 대신 이 값으로 대기열 티켓과 제보를 구분합니다 (REQ-SYS-01).
 * 브라우저 localStorage 에만 저장되므로 서버는 "누구" 인지 알 수 없고, 앱 데이터를 지우면 새 ID 가 됩니다.
 */
const KEY = "erica-wait-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "no-storage";   // 사생활 보호 모드 등 저장소 접근 불가 시
  }
}
