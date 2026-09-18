// 세탁기 진동 센서 펌웨어 초안 (ESP32 + MPU6050 가속도 센서). 5주차 실측 전이라 미검증 코드입니다.
//
// 동작: 100Hz 로 가속도를 읽어 |a| - 1g 의 절댓값을 10초 동안 평균 내고, 10초마다 서버에 POST 합니다.
// 서버가 시작/종료를 판정하므로 펌웨어는 "진동 세기 숫자" 만 보냅니다 (판정 규칙을 한 곳(server/app/logic/laundry.py)에 두기 위해).
// 필요한 라이브러리: Adafruit MPU6050, WiFi, HTTPClient
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "...";
const char* WIFI_PASS = "...";
const char* API = "http://192.168.0.10:8000/api/sensors/vibration";  // 서버 노트북 IP
const char* DEVICE_KEY = "dev-edge-key";
const char* RESOURCE_ID = "laundry-changui-w1";

Adafruit_MPU6050 mpu;
const int SAMPLE_HZ = 100;
const int REPORT_SEC = 10;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  mpu.begin();
  mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  double acc = 0; int n = 0;
  unsigned long until = millis() + REPORT_SEC * 1000UL;
  while (millis() < until) {
    sensors_event_t a, g, t;
    mpu.getEvent(&a, &g, &t);
    double mag = sqrt(a.acceleration.x*a.acceleration.x + a.acceleration.y*a.acceleration.y + a.acceleration.z*a.acceleration.z) / 9.81;
    acc += fabs(mag - 1.0);  // 중력 1g 를 뺀 진동 성분
    n++;
    delay(1000 / SAMPLE_HZ);
  }
  double magnitude = n ? acc / n : 0;
  HTTPClient http;
  http.begin(API);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  String body = String("{\"resource_id\":\"") + RESOURCE_ID + "\",\"magnitude\":" + String(magnitude, 3) + "}";
  int code = http.POST(body);
  Serial.printf("mag=%.3f -> HTTP %d\n", magnitude, code);
  http.end();
}
