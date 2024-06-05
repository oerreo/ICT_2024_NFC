#include <Wire.h>
#include <Adafruit_PN532.h>

#define IRQ_PIN   2    // 인터럽트 요청 핀
#define RESET_PIN 3    // 리셋 핀

Adafruit_PN532 nfc(IRQ_PIN, RESET_PIN);


void setup(void) {
  Serial.begin(115200);
  Serial.println("Hello!");

  nfc.begin();

  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) {
    Serial.print("PN53x 보드를 찾지 못했습니다");
    while (1); // 멈춤
  }

  // 정상 데이터를 얻었으므로 출력
  Serial.print("칩 발견: PN5"); Serial.println((versiondata >> 24) & 0xFF, HEX);
  Serial.print("펌웨어 버전: "); Serial.print((versiondata >> 16) & 0xFF, DEC);
  Serial.print('.'); Serial.println((versiondata >> 8) & 0xFF, DEC);

  // 보드를 RFID 태그를 읽도록 설정
  nfc.SAMConfig();

  Serial.println("NFC 카드를 기다리는 중...");
}

void loop(void) {
  uint8_t success;
  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };  // 반환된 UID를 저장할 버퍼
  uint8_t uidLength;                        // UID의 길이 (ISO14443A 카드 유형에 따라 4 또는 7 바이트)

  // NFC 카드가 나타나기를 기다림
  success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength);

  if (success) {
    // 카드에 대한 기본 정보 표시
    Serial.println("NFC 카드를 발견했습니다!");
    Serial.print("UID 길이: "); Serial.print(uidLength, DEC); Serial.println(" 바이트");
    Serial.print("UID 값: ");
    for (uint8_t i = 0; i < uidLength; i++) {
      Serial.print(" 0x"); Serial.print(uid[i], HEX);
    }
    Serial.println("");
    // 계속하기 전에 1초 대기
    delay(1000);
  }
}


