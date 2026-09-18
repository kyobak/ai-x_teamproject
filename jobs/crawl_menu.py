"""
학식 메뉴 크롤러.

대상: 한양대 ERICA 복지포털(HY-SQUARE) https://life.hanyang.ac.kr
- 식단 페이지 본문은 로그인 뒤에만 보입니다. 대신 페이지가 불러오는 공개 데이터 파일
  /theme/assets/js/mock-data.js 에 식당별 조·중·석식 메뉴가 들어 있어 그것을 읽습니다.
- robots.txt 는 없고(404), 파일 하나를 하루 한 번 받는 정도라 서버 부담이 없습니다.
- 사이트가 실제 DB 연동으로 바뀌면 이 파일이 사라질 수 있습니다. 그때는 fetch_menus() 만 바꾸면 됩니다.

파싱: 파일이 JSON 이 아니라 JavaScript 라, node 가 있으면 node 로 평가하고 없으면 정규식으로 대충 뽑습니다.

실행:  .venv/bin/python jobs/crawl_menu.py            # jobs/data/campus_food.json 갱신 + DB menus 갱신
       .venv/bin/python jobs/crawl_menu.py --dry-run  # 파일만 갱신
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
import subprocess

import requests   # urllib 대신 requests: macOS 의 python.org 파이썬은 루트 인증서가 없어 urllib 이 SSL 오류를 냅니다
from datetime import date
from pathlib import Path

URL = "https://life.hanyang.ac.kr/theme/assets/js/mock-data.js"
DATA = Path(__file__).parent / "data" / "campus_food.json"
# 우리 자원 id ↔ 사이트 식당 이름. 사이트에 없는 식당은 메뉴가 비어 있게 됩니다.
RESOURCE_TO_RESTAURANT = {"cafeteria-1": "학생식당", "cafeteria-2": "창의관식당", "cafeteria-3": "교직원식당", "cafeteria-4": "창업보육센터식당"}


def fetch_js() -> str:
    r = requests.get(URL, headers={"User-Agent": "Mozilla/5.0 (team09 menu bot)"}, timeout=20)
    r.raise_for_status()
    return r.text


def parse_with_node(js: str) -> list[dict]:
    code = "const M=(function(){" + js + "; return HY_MOCK;})(); process.stdout.write(JSON.stringify(M.cafeteria.menus));"
    out = subprocess.run(["node", "-e", code], capture_output=True, text=True, timeout=30)
    if out.returncode != 0:
        raise RuntimeError(out.stderr[:300])
    return json.loads(out.stdout)


def parse_with_regex(js: str) -> list[dict]:
    """node 가 없을 때의 대안. 메뉴 객체 하나씩 정규식으로 뽑습니다(구조가 바뀌면 깨질 수 있음)."""
    menus = []
    for block in re.findall(r"\{\s*id:\s*\d+,\s*restaurant:.*?imageUrl:\s*null,?\s*\}", js, flags=re.S):
        g = lambda k: (re.search(rf'{k}:\s*"([^"]*)"', block) or [None, None])[1]
        items = re.findall(r'"([^"]+)"', (re.search(r"items:\s*\[(.*?)\]", block, flags=re.S) or [None, ""])[1])
        price = re.search(r"price:\s*(\d+)", block)
        menus.append({"restaurant": g("restaurant"), "course": g("course"), "mealTime": g("mealTime"),
                      "items": items, "price": int(price[1]) if price else 0})
    return menus


def fetch_menus() -> list[dict]:
    js = fetch_js()
    return parse_with_node(js) if shutil.which("node") else parse_with_regex(js)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="server/data/app.db")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    menus = fetch_menus()
    by_rest: dict[str, list] = {}
    for m in menus:
        by_rest.setdefault(m["restaurant"], []).append(
            {"course": m["course"], "mealTime": m["mealTime"], "items": m["items"], "price": m["price"]})
    data = json.loads(DATA.read_text(encoding="utf-8")) if DATA.exists() else {}
    data.update({"_fetched": date.today().isoformat(), "restaurants": [{"name": k, "menus": v} for k, v in by_rest.items()]})
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(menus)}개 메뉴, 식당 {list(by_rest)} → {DATA}")
    if args.dry_run:
        return
    conn = sqlite3.connect(args.db)
    today = date.today().isoformat()
    for rid, rest in RESOURCE_TO_RESTAURANT.items():
        items = [{"name": m["course"], "price": m["price"], "meal": m["mealTime"], "items": m["items"]} for m in by_rest.get(rest, [])]
        conn.execute("INSERT OR REPLACE INTO menus(resource_id, date, items) VALUES (?,?,?)",
                     (rid, today, json.dumps(items, ensure_ascii=False)))
    conn.commit()
    print("DB menus 갱신 완료:", today)


if __name__ == "__main__":
    main()
