#include <MFRC522.h>
#include <EthernetENC.h>
#include "Talkie.h"
#include "Vocab_US_Large.h"

// alert will be triggered when distance in cm is higher than this value
const int DISTANCE_THRESHOLD = 10;
// time (in seconds) permitted for reading the RFID card to prevent the alert from being triggered
const int RFID_TIMEOUT = 30;
// must send alive signal to the API every ALIVE_TIMEOUT milliseconds
const int ALIVE_TIMEOUT = 30000;

// RFID
const int RST_PIN = 5;
const int SS_PIN = 4;
MFRC522 mfrc522(SS_PIN, RST_PIN);

// ultrasonic sensor
const int trig = 7;
const int echo = 6;

const int buzzer = 3;

// ethernet
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
//
// if you don't want to use DNS (and reduce your sketch size)
// use the numeric IP instead of the name for the server:
//IPAddress server(74,125,232,128);  // numeric IP for Google (no DNS)
//char server[] = "www.google.com";    // name address for Google (using DNS)
IPAddress server(192, 168, 1, 5);  // `char server[] = "localhost";` won't work
//IPAddress server(146,190,50,117);
//
// Set the static IP address to use if the DHCP fails to assign
IPAddress ip(192, 168, 0, 199);
IPAddress myDns(192, 168, 0, 1);
//
EthernetClient client;

Talkie voice(true, false);

unsigned long lastAliveSignalTime;

void setup() {
  Serial.begin(9600);

  pinMode(trig, OUTPUT);
  pinMode(echo, INPUT);

  SPI.begin();
  mfrc522.PCD_Init();
  delay(4);

  Serial.println("Trying DHCP");
  if (Ethernet.begin(mac) == 0) {
    Serial.println(F("DHCP failed"));

    if (Ethernet.hardwareStatus() == EthernetNoHardware) {
      Serial.println(F("No hardware"));
      while (true) {
        delay(1);  // do nothing, no point running without Ethernet hardware
      }
    }

    if (Ethernet.linkStatus() == LinkOFF) {
      Serial.println(F("No cable"));
    }

    // try to configure using static IP address instead of DHCP
    Serial.print(F("Static IP: "));
    Serial.println(ip);
    Ethernet.begin(mac, ip, myDns);
  } else {
    Serial.print(F("DHCP IP: "));
    Serial.println(Ethernet.localIP());
  }
  delay(1000); // give the Ethernet a second to initialize

  httpRequest("alive");

  successTone();
}

void loop() {
  if (millis() - lastAliveSignalTime > ALIVE_TIMEOUT) {
    httpRequest("alive");
  }

  int distance = get_distance();
  Serial.print(F("Distance: "));
  Serial.print(distance);
  Serial.println(F("cm"));

  if (distance > DISTANCE_THRESHOLD) {
    for (int countdown = RFID_TIMEOUT; countdown >= 1; countdown--) {
      Serial.print(F("Waiting for RFID card ("));
      Serial.print(countdown);
      Serial.println(F(" seconds left)"));

      // increase frequency incrementally to signal urgency
      tone(buzzer, 100 + RFID_TIMEOUT * (RFID_TIMEOUT + 1 - countdown), 50);
      delay(100);
      //
      sayNumber(countdown);
      delay(1000);

      if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
        String uid = get_rfid_card_uid(mfrc522.uid.uidByte, mfrc522.uid.size);

        if (uid == "93 79 54 24") {
          Serial.println(F("OK"));
          successTone();
          return;
        } else {
          Serial.println(F("Wrong"));
          failureTone();
          delay(1000);
        }
      }
    }

    httpRequest("alert");

    while (get_distance() > DISTANCE_THRESHOLD) {
      Serial.println(F("Waiting for door to get closed"));
      delay(1000);
    }
  }

  delay(100);
}

int get_distance() {
  digitalWrite(trig, LOW);  // ensure the trigger pin is low before sending a pulse
  delayMicroseconds(10);
  digitalWrite(trig, HIGH);  // start ultrasonic signal
  delayMicroseconds(10);     // pulse duration
  digitalWrite(trig, LOW);   // end the pulse

  // measure the time duration for the echo; divide by 58, to get distance in centimeters
  long distance = pulseIn(echo, HIGH) / 58;

  return distance;
}

String get_rfid_card_uid(byte *buffer, byte bufferSize) {
  String uid = "";

  for (byte i = 0; i < bufferSize; i++) {
    uid += buffer[i] < 0x10 ? " 0" : " ";
    uid += String(buffer[i], HEX);
  }

  return uid.substring(1);  // remove first char because it's empty space
}

// endpoint = alert: hit API alert endpoint to register that the door has been opened
// endpoint = alive: signal to the API that the embedded system is operational
void httpRequest(String endpoint) {
  Serial.print(endpoint);
  Serial.println(F(" will start"));

  // close any connection to free the socket on the Ethernet shield before send a new request
  client.stop();

  int tries = 0;

  while (true) {
    tries++;
    Serial.print(F("Connecting to "));
    Serial.print(server);
    Serial.println(" (" + String(tries) + ")");

    if (client.connect(server, 3000)) {
      Serial.println(F("Connected"));
      break;
    }

    if (tries == 5) {
      Serial.println(F("Failed"));
      return;
    }
  }

  client.println("GET /" + endpoint + "?user=user&pass=pass HTTP/1.1");
  client.println("Host: 192.168.1.5:3000");
  client.println("Connection: close");
  client.println();

  // `client.available()` returns the number of incoming bytes available
  while (client.available() != 0) {
    // Serial.println(F("Fetching"));
  }

  if (endpoint == "alive") {
    lastAliveSignalTime = millis();
  }

  Serial.print(endpoint);
  Serial.println(" finished");
}

// to produce a "success" sound you can create a sequence of tones that mimic an uplifting or positive jingle
// a common approach is to play two or three ascending notes
void successTone() {
  tone(buzzer, 523, 200);  // C5
  delay(250);
  tone(buzzer, 659, 200);  // E5
  delay(250);
  tone(buzzer, 784, 300);  // G5
  delay(300);
}

// failure sounds are usually sharp and descending in pitch to convey something went wrong
void failureTone() {
  tone(buzzer, 784, 150);  // G5
  delay(200);
  tone(buzzer, 659, 150);  // E5
  delay(200);
  tone(buzzer, 523, 300);  // C5
  delay(300);
}

// say any number between 1 and 39
// adapted from https://github.com/ArminJo/Talkie/blob/master/examples/Voltmeter/Voltmeter.ino
void sayNumber(long n) {
  if (n < 1 || n > 39) return;

  if (n > 19) {
    int tens = n / 10;
    switch (tens) {
      case 2:
        voice.say(sp2_TWENTY);
        break;
      case 3:
        voice.say(sp2_THIR_);
        voice.say(sp2_T);
        break;
    }
    n %= 10;
  }
  switch (n) {
    case 1:
      voice.say(sp2_ONE);
      break;
    case 2:
      voice.say(sp2_TWO);
      break;
    case 3:
      voice.say(sp2_THREE);
      break;
    case 4:
      voice.say(sp2_FOUR);
      break;
    case 5:
      voice.say(sp2_FIVE);
      break;
    case 6:
      voice.say(sp2_SIX);
      break;
    case 7:
      voice.say(sp2_SEVEN);
      break;
    case 8:
      voice.say(sp2_EIGHT);
      break;
    case 9:
      voice.say(sp2_NINE);
      break;
    case 10:
      voice.say(sp2_TEN);
      break;
    case 11:
      voice.say(sp2_ELEVEN);
      break;
    case 12:
      voice.say(sp2_TWELVE);
      break;
    case 13:
      voice.say(sp2_THIR_);
      voice.say(sp2__TEEN);
      break;
    case 14:
      voice.say(sp2_FOUR);
      voice.say(sp2__TEEN);
      break;
    case 15:
      voice.say(sp2_FIF_);
      voice.say(sp2__TEEN);
      break;
    case 16:
      voice.say(sp2_SIX);
      voice.say(sp2__TEEN);
      break;
    case 17:
      voice.say(sp2_SEVEN);
      voice.say(sp2__TEEN);
      break;
    case 18:
      voice.say(sp2_EIGHT);
      voice.say(sp2__TEEN);
      break;
    case 19:
      voice.say(sp2_NINE);
      voice.say(sp2__TEEN);
      break;
  }
}
