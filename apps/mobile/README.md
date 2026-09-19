# Android 앱 (APK)

배포된 웹앱(https://erica-wait.vercel.app)을 **Capacitor** 앱 껍데기 안에서 여는 방식입니다.

왜 이 방식인가
- 화면·기능 코드는 웹앱 하나뿐이라, 웹을 고치면 앱도 자동으로 최신이 됩니다 (APK 를 다시 만들 필요 없음).
- 카메라(`/camera`)·가속도(`/sensor`)도 앱 안 웹뷰에서 그대로 동작합니다. `AndroidManifest.xml` 에 CAMERA 권한이 있습니다.
- 한계: 앱을 닫은 상태의 Web Push 알림은 웹뷰에서 오지 않습니다. 앱이 열려 있을 때의 "내 차례" 배너는 동작합니다.

## 만드는 법 (처음 한 번 준비)
```bash
brew install openjdk@21
brew install --cask android-commandlinetools
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
sdkmanager --licenses                      # 구글 Android SDK 라이선스 동의 (본인이 직접)
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

## 빌드
```bash
cd apps/mobile && npm install
npm run apk                                # → dist/erica-wait.apk, 그리고 apps/web/public/erica-wait.apk 로 복사
```
디버그 서명 APK 라 휴대폰에서 "출처를 알 수 없는 앱 설치" 를 허용하면 설치됩니다. 스토어 등록용은 서명 키를 만들어 `assembleRelease` 로 빌드해야 합니다.

## 아이콘 바꾸기
`assets/brand/app-icon-source.webp` 를 바꾼 뒤 `.venv/bin/python apps/mobile/make_icons.py`.

## 받는 곳
배포 사이트 맨 아래 "Android 앱 다운로드 (APK)" 링크, 또는 https://erica-wait.vercel.app/erica-wait.apk
휴대폰에서 받은 뒤 설치할 때 "출처를 알 수 없는 앱" 허용을 물으면 허용하세요.
