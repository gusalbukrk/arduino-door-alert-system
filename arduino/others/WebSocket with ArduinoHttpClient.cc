// using WebSocket instead of HTTP;
// the code related to custom tones and RFID were removed because there was no space;
// bug: WebSocket server always receives one message behind
// i.e. the first message is only received by the server after the second message is sent by the Arduino and so on
// adding `client.parseMessage()` after `client.endMessage()` didn't fixed this issue
// the workaround being used is to send a empty message after the alive/alert message

#include <EthernetENC.h>
#include <ArduinoHttpClient.h>

// alert will be triggered when distance in cm is higher than this value
const int DISTANCE_THRESHOLD = 10;
// time (in seconds) permitted for reading the RFID card to prevent the alert from being triggered
const int RFID_TIMEOUT = 30;
// must send alive signal to the API every ALIVE_TIMEOUT milliseconds
const int ALIVE_TIMEOUT = 30000;

// ultrasonic sensor
const int trig = 7;
const int echo = 6;

const int buzzer = 3;

// ethernet
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
//
// if you don't want to use DNS (and reduce your sketch size)
// use the numeric IP instead of the name for the server:
char serverAddress[] = "192.168.1.5";
int port = 3000;
//
// Set the static IP address to use if the DHCP fails to assign
IPAddress ip(192, 168, 0, 199);
IPAddress myDns(192, 168, 0, 1);
//
EthernetClient ethernet;
WebSocketClient client = WebSocketClient(ethernet, serverAddress, port);

unsigned long lastAliveSignalTime;

int count = 1;

void setup() {
  Serial.begin(9600);

  pinMode(trig, OUTPUT);
  pinMode(echo, INPUT);

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
  // give the Ethernet a second to initialize
  delay(1000);

  request("alive");
}

void loop() {
  if (millis() - lastAliveSignalTime > ALIVE_TIMEOUT) {
    request("alive");
  }

  int distance = get_distance();
  Serial.print(F("Distance: "));
  Serial.print(distance);
  Serial.println(F("cm"));

  if (distance > DISTANCE_THRESHOLD) {
    request("alert");

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

// endpoint = alert: hit API alert endpoint to register that the door has been opened
// endpoint = alive: signal to the API that the embedded system is operational
void request(String endpoint) {
  Serial.print(endpoint);
  Serial.println(F(" will start"));

  if (!client.connected()) {
    Serial.println("(Re)connecting");
    client.begin();
  }

  client.beginMessage(TYPE_TEXT);
  client.print(endpoint);
  client.endMessage();
  //
  Serial.print(count++);
  Serial.print(" ");
  Serial.println(endpoint);
  //
  int s1 = client.parseMessage();
  for (int i = 0; i < s1; i++) {
    client.read();
  }

  client.beginMessage(TYPE_TEXT);
  client.print("");
  client.endMessage();
  int s2 = client.parseMessage();
  for (int i = 0; i < s2; i++) {
    client.read();
  }

  if (endpoint == "alive") {
    lastAliveSignalTime = millis();
  }

  Serial.print(endpoint);
  Serial.println(" finished");

  delay(2000);
}
