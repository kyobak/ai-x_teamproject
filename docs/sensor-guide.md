# 세탁기 진동 센서 구매·연동 가이드

세탁기 "사용 중/사용 가능" 은 **기기 외벽의 진동**으로 판정합니다(계획서 확정안). 판정 규칙은 전부 서버(`server/app/logic/laundry.py`)에 있고,
센서는 **"10초 평균 진동 세기" 숫자 하나**만 보내면 됩니다. 그래서 어떤 하드웨어를 쓰든 서버는 바뀌지 않습니다.

## 0. 사기 전에: 휴대폰으로 먼저 검증 (0원)
웹앱의 **관리 → "휴대폰을 진동 센서로"** (`/sensor`) 화면을 안 쓰는 스마트폰에서 열고, 세탁기 옆면에 테이프로 붙이면
가속도계 값이 ESP32 와 똑같은 형식으로 서버에 들어갑니다. 5주차 "한 사이클 로깅"은 이걸로 먼저 하세요.
Android Chrome 은 바로 되고, iPhone 은 HTTPS 에서만 동작 센서 권한을 줍니다(노트북 IP 로 열면 안 됨 → ngrok 등으로 HTTPS 터널).

## 1. 추천 구성 (기기 1대당 약 1.5만 원)

| 부품 | 추천 모델 | 대략 가격 | 이유 |
|---|---|---|---|
| 마이크로컨트롤러 | **ESP32 DevKit V1** (또는 ESP32-C3 SuperMini) | 6,000~10,000원 | Wi-Fi 내장, Arduino IDE 지원, 3.3V I2C |
| 가속도 센서 | **MPU-6050 모듈 (GY-521)** | 2,000~4,000원 | 가장 흔하고 라이브러리(Adafruit MPU6050) 풍부. ±2g 범위로도 세탁기 진동 충분 |
| 대안 센서 | ADXL345 (GY-291) | 3,000~5,000원 | 저전력. 배터리 구동 시 유리 |
| 전원 | USB 보조배터리(5V) 또는 5V 어댑터 | 있는 것 사용 | 세탁실 콘센트가 없으면 보조배터리. 10초 주기 전송 + 슬립이면 10,000mAh 로 며칠 |
| 부착 | 벨크로 테이프, 3M 양면테이프, 지퍼백(방수) | 2,000원 | 세탁기 옆면 상단(탈수 진동이 큰 면) |
| 케이블 | 점퍼선 암-암 4개, micro-USB/USB-C 케이블 | 1,000원 | |

구매처 예: 디바이스마트, 엘레파츠, 메카솔루션, 알리익스프레스(배송 2주). 학과 실습실에 ESP32·MPU6050 재고가 있는지 먼저 물어보세요.

## 2. 배선 (I2C, 4가닥)

```
MPU-6050 (GY-521)      ESP32 DevKit
   VCC  ─────────────  3V3
   GND  ─────────────  GND
   SCL  ─────────────  GPIO 22
   SDA  ─────────────  GPIO 21
```
(ESP32-C3 SuperMini 는 SDA=GPIO 8, SCL=GPIO 9. 펌웨어의 `Wire.begin(SDA, SCL)` 로 지정)

## 3. 펌웨어 올리기 (`sensors/firmware/esp32_mpu6050.ino`)
1. Arduino IDE 설치 → 환경설정 → 추가 보드 매니저 URL 에 `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
2. 보드 매니저에서 **esp32 by Espressif** 설치, 보드: "ESP32 Dev Module"
3. 라이브러리 매니저에서 **Adafruit MPU6050**, **Adafruit Unified Sensor** 설치
4. `.ino` 상단 5줄 수정: `WIFI_SSID`, `WIFI_PASS`, `API`(서버 노트북 IP, 예 `http://192.168.0.10:8000/api/sensors/vibration`), `DEVICE_KEY`(server/.env 의 `EDGE_API_KEY`), `RESOURCE_ID`(`laundry-w1` 등)
5. 업로드 → 시리얼 모니터(115200)에 `mag=0.012 -> HTTP 200` 이 10초마다 찍히면 성공

## 4. 서버 쪽에서 확인
- `http://<노트북IP>:8000/docs` → `POST /api/sensors/vibration` 이 200 을 돌려주는지
- 웹앱 세탁실 카드의 "센서 수신 n초 전" 이 갱신되는지
- `GET /api/resources/laundry-w1/history` 로 최근 진동 값 확인 (사이클 로깅 결과)

## 5. 5주차 실측으로 정할 값 (`server/app/config.py`)
| 값 | 어떻게 정하나 |
|---|---|
| `VIB_THRESHOLD` | 빈 세탁기에서 10분 로깅한 최댓값의 2~3배. 옆 기기가 돌 때 값이 넘으면 올리기 |
| `VIB_START_SECONDS` | 급수 뒤 세탁이 시작되기까지의 시간보다 짧게 (기본 30초) |
| `VIB_END_MINUTES` (T) | 한 사이클 로깅에서 "가장 긴 무진동 구간" + 1분 (기본 5분) |
| `DEFAULT_CYCLE_MINUTES` | 표준 코스 실측 시작→탈수 종료 (기본 50분) |

## 6. 흔한 문제
- **값이 0 만 나옴**: SDA/SCL 이 바뀜, 또는 모듈 주소가 0x69 (AD0 핀 HIGH). `mpu.begin(0x69)`
- **HTTP -1**: 노트북 방화벽이 8000 포트를 막음, 또는 휴대폰 핫스팟처럼 기기 간 통신을 막는 네트워크
- **옆 기기 진동 혼입**: 센서를 세탁기 옆면이 아니라 **문 쪽 상단**으로, 그리고 임계값 상향
- **전원 문제로 재부팅 반복**: MPU6050 을 5V 가 아니라 3V3 에 연결했는지 확인
