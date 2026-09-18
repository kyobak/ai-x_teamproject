"""
학식 메뉴 크롤러 (뼈대).

아직 실제 URL 을 넣지 않았습니다. 이유: 크롤링 전에 대상 페이지의 robots.txt 와 이용 조건을 확인해야 합니다(계획서 준비 체크리스트).
확인이 끝나면 fetch_menu() 안을 채우고, GitHub Actions 스케줄(.github/workflows) 이나 cron 으로 하루 한 번 실행합니다.

실행:  .venv/bin/python jobs/crawl_menu.py --db server/data/app.db
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import date

MENU_URL = None  # TODO: robots.txt 확인 후 채우기


def fetch_menu(resource_id: str) -> list[dict]:
    """실제 크롤링 자리. 지금은 예시 값을 돌려줍니다."""
    if MENU_URL is None:
        return [{"name": "(크롤링 미연결) 오늘의 메뉴", "price": 0}]
    # 예: html = requests.get(MENU_URL, timeout=10).text; BeautifulSoup 으로 파싱 ...
    raise NotImplementedError


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="server/data/app.db")
    args = ap.parse_args()
    conn = sqlite3.connect(args.db)
    today = date.today().isoformat()
    for rid in ("cafeteria-1", "cafeteria-2"):
        items = fetch_menu(rid)
        conn.execute("INSERT OR REPLACE INTO menus(resource_id, date, items) VALUES (?,?,?)",
                     (rid, today, json.dumps(items, ensure_ascii=False)))
    conn.commit()
    print("menus updated for", today)


if __name__ == "__main__":
    main()
