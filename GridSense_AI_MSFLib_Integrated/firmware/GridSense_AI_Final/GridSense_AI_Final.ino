
/*
  GRIDNOVA AI — Team GridNova
  Smart Power Monitoring and Load Management

  REAL:
  - ESP32 Wi-Fi connectivity
  - DS18B20 temperature
  - Relay output commands
  - Cloud telemetry and remote commands

  SIMULATED:
  - Power demand and connected watts
  - Demand-limit detection and load shedding

  IMPORTANT:
  This is a demonstration prototype, not a certified
  electrical safety or overload protection device.

  Libraries:
  - Adafruit GFX Library
  - Adafruit SSD1306
  - OneWire
  - DallasTemperature
  - PZEM004Tv30 (Jakub Mandula)
*/

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <PZEM004Tv30.h>
#include <math.h>

// =====================================
// WIFI AND CLOUD CONFIGURATION
// =====================================

const char* WIFI_SSID = " ";

// Enter your actual hotspot password.
const char* WIFI_PASSWORD = " ";

const char* API_BASE_URL =
  "https://gridnova-ai-kodehouz.onrender.com";

// Enter the current X-Device-Key from Render.
// Do not use the admin key here.
const char* DEVICE_KEY = " ";

// Demo only: skips TLS certificate validation.
const bool DEMO_TLS_INSECURE = true;

// =====================================
// HARDWARE CONFIGURATION
// =====================================

const uint8_t RELAY_PINS[2] = {13, 14};

// Keep existing relay polarity for now.
// We will diagnose Load 1 separately.
const uint8_t RELAY_ON = HIGH;
const uint8_t RELAY_OFF = LOW;

const uint8_t GREEN_LED = 16;
const uint8_t YELLOW_LED = 17;
const uint8_t RED_LED = 18;
const uint8_t BUZZER = 4;
// Two-pin active-HIGH buzzer; use a transistor driver if current exceeds GPIO rating.
const uint8_t BUZZER_ON = HIGH;
const uint8_t BUZZER_OFF = LOW;
const unsigned long STARTUP_BEEP_MS = 120;
const unsigned long EVENT_BEEP_MS = 300;
bool previousShedding = false;
bool previousThermalTrip = false;
bool buzzerBeeping = false;
unsigned long buzzerStarted = 0;
unsigned long buzzerDuration = 0;

const uint8_t TEMP_PIN = 19;

// PZEM V4.0 UART (tested separately on this module).
// Interface VCC -> ESP32 3V3 ONLY if module label supports 3.3-5V;
// PZEM TX -> GPIO26; PZEM RX -> GPIO27; common GND.
// Verify TX idle voltage <= 3.3V before direct GPIO connection.
const uint8_t PZEM_RX_PIN = 26;
const uint8_t PZEM_TX_PIN = 27;
HardwareSerial pzemSerial(2);
PZEM004Tv30 pzem(pzemSerial, PZEM_RX_PIN, PZEM_TX_PIN);


#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 oled(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  -1
);

OneWire oneWire(TEMP_PIN);
DallasTemperature ds(&oneWire);

// =====================================
// SYSTEM SETTINGS
// =====================================

const float NOMINAL_W[2] = {
  15.0f,
  60.0f
};

const float DEFAULT_LIMIT_W = 70.0f;
const float HIGH_TEMP_C = 45.0f;
const float RESET_TEMP_C = 40.0f;

const unsigned long DEMO_HOLD_MS = 4000;
const unsigned long TEMP_INTERVAL = 1000;
const unsigned long DISPLAY_INTERVAL = 500;
const unsigned long NET_INTERVAL = 8000;
const unsigned long PZEM_INTERVAL = 5000;
const unsigned long PZEM_STALE_MS = 16000;

const unsigned long WIFI_RETRY_INTERVAL = 20000;
const unsigned long WIFI_CONNECT_TIMEOUT = 15000;

bool oledReady = false;
bool tempValid = false;
bool thermalTrip = false;
bool autoMode = true;

bool requested[2] = {true, true};
bool commanded[2] = {false, false};

bool shedding = false;
bool demoActive = false;

float limitW = DEFAULT_LIMIT_W;
float demandW = 0;
float connectedW = 0;
float tempC = 0;

bool pzemValid = false;
float voltageV = NAN, currentA = NAN, powerW = NAN;
float energyKwh = NAN, frequencyHz = NAN, powerFactor = NAN;
unsigned long lastPzem = 0;
unsigned long lastPzemSuccess = 0;

unsigned long demoStarted = 0;
unsigned long lastTemp = 0;
unsigned long lastDisplay = 0;
unsigned long lastNet = 0;
unsigned long lastWifi = 0;

bool wifiAttemptActive = false;
unsigned long wifiAttemptStarted = 0;
bool wifiPreviouslyConnected = false;

void startBeep(unsigned long durationMs) {
  buzzerDuration = durationMs;
  buzzerStarted = millis();
  buzzerBeeping = true;
  digitalWrite(BUZZER, BUZZER_ON);
}

void updateBuzzer() {
  unsigned long now = millis();
  // Edge-triggered: beep once when shedding or a thermal trip begins.
  if ((shedding && !previousShedding) ||
      (thermalTrip && !previousThermalTrip)) {
    startBeep(EVENT_BEEP_MS);
  }
  previousShedding = shedding;
  previousThermalTrip = thermalTrip;

  if (buzzerBeeping && now - buzzerStarted >= buzzerDuration) {
    digitalWrite(BUZZER, BUZZER_OFF);
    buzzerBeeping = false;
  }
}


// =====================================
// WIFI STATUS
// =====================================

const char* wifiStatusName(wl_status_t status) {
  switch (status) {
    case WL_CONNECTED: return "CONNECTED";
    case WL_NO_SSID_AVAIL: return "SSID NOT FOUND";
    case WL_CONNECT_FAILED: return "CONNECT FAILED";
    case WL_CONNECTION_LOST: return "CONNECTION LOST";
    case WL_DISCONNECTED: return "DISCONNECTED";
    case WL_IDLE_STATUS: return "CONNECTING/IDLE";
    default: return "UNKNOWN";
  }
}

void startWifi() {

  if (WiFi.status() == WL_CONNECTED) {
    wifiAttemptActive = false;
    return;
  }

  // Do not restart an active connection attempt.
  if (wifiAttemptActive) {
    if (millis() - wifiAttemptStarted <
        WIFI_CONNECT_TIMEOUT) {
      return;
    }

    Serial.println(
      "WiFi timeout. Stopping previous attempt."
    );

    WiFi.disconnect(false, false);
    wifiAttemptActive = false;
  }

  Serial.println();
  Serial.println("========== WIFI ==========");
  Serial.print("Connecting to: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  WiFi.setSleep(false);

  // ESP32 connection is asynchronous.
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  wifiAttemptStarted = millis();
  wifiAttemptActive = true;

  Serial.println("Connection started.");
  Serial.println("Local control remains available.");
}

void maintainWifi() {

  wl_status_t status = WiFi.status();

  if (status == WL_CONNECTED) {

    wifiAttemptActive = false;

    if (!wifiPreviouslyConnected) {

      wifiPreviouslyConnected = true;

      Serial.println();
      Serial.println("========== WIFI CONNECTED ==========");
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());

      Serial.print("Signal RSSI: ");
      Serial.print(WiFi.RSSI());
      Serial.println(" dBm");

      Serial.println("====================================");
    }

    return;
  }

  if (wifiPreviouslyConnected) {
    wifiPreviouslyConnected = false;
    Serial.println("WiFi connection lost.");
  }

  // Let an existing connection attempt finish.
  if (wifiAttemptActive) {

    if (millis() - wifiAttemptStarted <
        WIFI_CONNECT_TIMEOUT) {
      return;
    }

    Serial.print("WiFi attempt timed out. Status: ");
    Serial.println(wifiStatusName(status));

    WiFi.disconnect(false, false);
    wifiAttemptActive = false;

    // Begin retry interval from this point.
    lastWifi = millis();
    return;
  }

  if (millis() - lastWifi >= WIFI_RETRY_INTERVAL) {
    lastWifi = millis();
    startWifi();
  }
}

// =====================================
// RELAY AND LOAD MANAGEMENT
// =====================================

void updateOutputs() {

  demandW = 0;
  connectedW = 0;

  for (int i = 0; i < 2; i++) {
    if (requested[i]) {
      demandW += NOMINAL_W[i];
    }
  }

  bool allowed[2] = {
    requested[0],
    requested[1]
  };

  float remaining = demandW;

  shedding = false;

  bool demoHold =
    demoActive &&
    (millis() - demoStarted < DEMO_HOLD_MS);

  if (autoMode && !demoHold && remaining > limitW) {

    // Shed non-critical Load 2 first.
    for (int i = 1; i >= 0; i--) {

      if (allowed[i] && remaining > limitW) {
        allowed[i] = false;
        remaining -= NOMINAL_W[i];
        shedding = true;
      }
    }
  }

  if (thermalTrip) {
    allowed[0] = false;
    allowed[1] = false;
  }

  for (int i = 0; i < 2; i++) {

    commanded[i] = allowed[i];

    digitalWrite(
      RELAY_PINS[i],
      commanded[i] ? RELAY_ON : RELAY_OFF
    );

    if (commanded[i]) {
      connectedW += NOMINAL_W[i];
    }
  }
}

// =====================================
// PZEM MEASUREMENTS (read-only; not used for protection)
// =====================================

void readPzem() {
  float v = pzem.voltage();
  float a = pzem.current();
  float w = pzem.power();
  float e = pzem.energy();
  float hz = pzem.frequency();
  float pf = pzem.pf();

  // Do not treat missing measurements as zero.
  // Voltage must be valid to mark the overall PZEM sample valid.
  if (!isfinite(v) || v <= 0 || !isfinite(hz) || hz <= 0) {
    pzemValid = false;
    voltageV = currentA = powerW = energyKwh = frequencyHz = powerFactor = NAN;
    Serial.println("PZEM: unavailable / invalid measurement");
    return;
  }

  pzemValid = true;
  lastPzemSuccess = millis();
  voltageV = v;
  currentA = isfinite(a) && a >= 0 ? a : NAN;
  powerW = isfinite(w) && w >= 0 ? w : NAN;
  energyKwh = isfinite(e) && e >= 0 ? e : NAN;
  frequencyHz = hz;
  // At zero current PF is undefined, even if the module reports 0.00.
  powerFactor = isfinite(pf) && pf >= 0 && pf <= 1 &&
                isfinite(currentA) && currentA > 0.001f ? pf : NAN;

  Serial.printf("PZEM: %.1f V | %.3f A | %.1f W | %.4f kWh | %.1f Hz | ",
                voltageV, currentA, powerW, energyKwh, frequencyHz);
  if (isfinite(powerFactor)) Serial.printf("PF %.2f\n", powerFactor);
  else Serial.println("PF N/A");
}

void addJsonNumber(String &s, const char* name, float value, int digits) {
  s += ",\"";
  s += name;
  s += "\":";
  s += isfinite(value) ? String(value, digits) : String("null");
}

// =====================================
// TELEMETRY JSON
// =====================================

String telemetry() {

  String s =
    "{\"device\":\"gridnova-esp32\"";

  s +=
    ",\"mode\":\"SIMULATED_DEMAND_REAL_TEMPERATURE\"";

  s +=
    ",\"demand_w\":" + String(demandW, 1);

  s +=
    ",\"connected_w\":" + String(connectedW, 1);

  s +=
    ",\"limit_w\":" + String(limitW, 1);

  s += ",\"temperature_c\":";

  if (tempValid) {
    s += String(tempC, 2);
  } else {
    s += "null";
  }

  s +=
    ",\"load1\":" +
    String(commanded[0] ? "true" : "false");

  s +=
    ",\"load2\":" +
    String(commanded[1] ? "true" : "false");

  s +=
    ",\"auto\":" +
    String(autoMode ? "true" : "false");

  s +=
    ",\"overload\":" +
    String(shedding ? "true" : "false");

  s +=
    ",\"thermal_trip\":" +
    String(thermalTrip ? "true" : "false");

  s +=
    ",\"demo\":" +
    String(demoActive ? "true" : "false");

  bool valid = pzemValid && millis() - lastPzemSuccess < PZEM_STALE_MS;
  s += ",\"pzem_valid\":";
  s += valid ? "true" : "false";
  addJsonNumber(s, "voltage_v", valid ? voltageV : NAN, 2);
  addJsonNumber(s, "current_a", valid ? currentA : NAN, 4);
  addJsonNumber(s, "power_w", valid ? powerW : NAN, 2);
  addJsonNumber(s, "energy_kwh", valid ? energyKwh : NAN, 5);
  addJsonNumber(s, "frequency_hz", valid ? frequencyHz : NAN, 2);
  addJsonNumber(s, "pf", valid ? powerFactor : NAN, 3);
  s += "}";

  return s;
}

// =====================================
// OLED DISPLAY
// =====================================

void drawDisplay() {
  if (!oledReady) return;
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  bool meterPage = (millis() / 4000UL) % 2 == 1;
  if (meterPage) {
    oled.setCursor(0, 0); oled.print("GRIDNOVA AI [PZEM]");
    if (pzemValid && millis() - lastPzemSuccess < PZEM_STALE_MS) {
      oled.setCursor(0, 12); oled.printf("V:%.1f Hz:%.1f", voltageV, frequencyHz);
      oled.setCursor(0, 23);
      if (isfinite(currentA)) oled.printf("I:%.3f A", currentA);
      else oled.print("I:N/A");
      oled.setCursor(0, 34);
      if (isfinite(powerW)) oled.printf("P:%.1f W", powerW);
      else oled.print("P:N/A");
      oled.setCursor(0, 45);
      if (isfinite(energyKwh)) oled.printf("E:%.3f kWh", energyKwh);
      else oled.print("E:N/A");
      oled.setCursor(0, 56);
      if (isfinite(powerFactor)) oled.printf("PF:%.2f", powerFactor);
      else oled.print("PF:N/A (no load)");
    } else {
      oled.setCursor(0, 20); oled.print("PZEM DATA UNAVAILABLE");
      oled.setCursor(0, 36); oled.print("Check meter + UART");
    }
  } else {
    oled.setCursor(0, 0); oled.print("GRIDNOVA AI [DEMO]");
    oled.setCursor(0, 11); oled.printf("Req:%.0f Act:%.0f W", demandW, connectedW);
    oled.setCursor(0, 22); oled.printf("Limit:%.0f W", limitW);
    oled.setCursor(0, 33);
    oled.printf("L1:%s L2:%s", commanded[0] ? "ON" : "OFF",
                commanded[1] ? "ON" : "OFF");
    oled.setCursor(0, 44);
    if (tempValid) oled.printf("Temp:%.1f C", tempC);
    else oled.print("Temp:N/A");
    oled.setCursor(0, 55);
    if (thermalTrip) oled.print("TEMP TRIP");
    else if (shedding) oled.print("SIM LOAD SHED");
    else if (WiFi.status() == WL_CONNECTED) oled.print("WIFI ONLINE");
    else oled.print("WIFI OFFLINE");
  }
  oled.display();
}

// =====================================
// COMMAND HANDLER
// =====================================

void handleCommand(String cmd) {

  cmd.trim();
  cmd.toLowerCase();

  if (cmd.length() == 0 ||
      cmd == "none" ||
      cmd == "null") {
    return;
  }

  Serial.println();
  Serial.print("Received command: ");
  Serial.println(cmd);

  if (cmd == "1" || cmd == "2") {

    demoActive = false;

    int i = cmd.toInt() - 1;

    requested[i] = !requested[i];

  } else if (cmd == "auto") {

    demoActive = false;
    autoMode = !autoMode;

  } else if (cmd == "demo") {

    requested[0] = true;
    requested[1] = true;

    autoMode = true;
    limitW = DEFAULT_LIMIT_W;

    demoActive = true;
    demoStarted = millis();

  } else if (cmd == "reset") {

    demoActive = false;

    requested[0] = true;
    requested[1] = true;

    autoMode = true;
    limitW = DEFAULT_LIMIT_W;

    if (tempValid &&
        tempC < RESET_TEMP_C) {
      thermalTrip = false;
    }

  } else if (cmd.startsWith("limit ")) {

    String value = cmd.substring(6);
    value.trim();

    if (value.length() == 0) return;

    for (unsigned int i = 0; i < value.length(); i++) {

      if (!isDigit(value[i]) && value[i] != '.') {
        Serial.println("Invalid limit value.");
        return;
      }
    }

    float v = value.toFloat();

    if (v < 1 || v > 10000) {
      Serial.println("Limit must be 1..10000 W");
      return;
    }

    demoActive = false;
    limitW = v;

  } else if (cmd == "status") {

    // Status request only.

  } else {

    Serial.println("Unknown command.");
    return;
  }

  updateOutputs();
  drawDisplay();

  Serial.println(telemetry());
}

// =====================================
// CLOUD SYNC
// =====================================

void syncCloud() {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.print("Cloud skipped. WiFi status: ");
    Serial.println(
      wifiStatusName(WiFi.status())
    );

    return;
  }

  Serial.println();
  Serial.println("========== CLOUD SYNC ==========");

  WiFiClientSecure client;
  client.setTimeout(5000);

  if (DEMO_TLS_INSECURE) {
    client.setInsecure();
  }

  HTTPClient http;
  http.setTimeout(5000);

  String telemetryURL =
    String(API_BASE_URL) +
    "/api/v1/gridsense/telemetry";

  if (http.begin(client, telemetryURL)) {

    http.addHeader(
      "Content-Type",
      "application/json"
    );

    http.addHeader(
      "X-Device-Key",
      DEVICE_KEY
    );

    int code = http.POST(telemetry());

    Serial.printf(
      "Telemetry HTTP %d\n",
      code
    );

    if (code != 200) {
      Serial.println(http.getString());
    }

    http.end();
  }

  WiFiClientSecure pollClient;
  pollClient.setTimeout(5000);

  if (DEMO_TLS_INSECURE) {
    pollClient.setInsecure();
  }

  HTTPClient poll;
  poll.setTimeout(5000);

  String commandURL =
    String(API_BASE_URL) +
    "/api/v1/gridsense/device-command";

  if (poll.begin(pollClient, commandURL)) {

    poll.addHeader(
      "X-Device-Key",
      DEVICE_KEY
    );

    int code = poll.GET();

    Serial.printf(
      "Command HTTP %d\n",
      code
    );

    if (code == 200) {

      String command = poll.getString();
      command.trim();

      Serial.print("Remote response: ");
      Serial.println(command);

      if (
        command == "1" ||
        command == "2" ||
        command == "auto" ||
        command == "demo" ||
        command == "reset" ||
        command == "status" ||
        command.startsWith("limit ")
      ) {
        handleCommand(command);
      }
    }

    poll.end();
  }

  Serial.println("========== SYNC COMPLETE ==========");
}

// =====================================
// SETUP
// =====================================

void setup() {

  Serial.begin(115200);
  Serial.setTimeout(60);

  delay(300);

  Serial.println();
  Serial.println("==================================");
  Serial.println("GRIDNOVA AI — SYSTEM STARTING");
  Serial.println("==================================");

  // Relay initialization.
  for (int i = 0; i < 2; i++) {

    digitalWrite(
      RELAY_PINS[i],
      RELAY_OFF
    );

    pinMode(
      RELAY_PINS[i],
      OUTPUT
    );
  }

  pinMode(GREEN_LED, OUTPUT);
  pinMode(YELLOW_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  digitalWrite(BUZZER, BUZZER_OFF);

  // OLED.
  Wire.begin(21, 22);

  oledReady = oled.begin(
    SSD1306_SWITCHCAPVCC,
    0x3C
  );

  // PZEM HardwareSerial is initialized by the library constructor.

  // Temperature.
  ds.begin();
  ds.setResolution(10);
  ds.setWaitForConversion(false);
  ds.requestTemperatures();

  updateOutputs();
  // Suppress a second beep for shedding already present at boot.
  previousShedding = shedding;
  previousThermalTrip = thermalTrip;
  startBeep(STARTUP_BEEP_MS);
  drawDisplay();

  // Start one Wi-Fi connection attempt.
  startWifi();

  Serial.println("System ready.");
  Serial.println(
    "Commands: 1, 2, auto, demo, "
    "limit 100, limit 70, reset, status"
  );
}

// =====================================
// MAIN LOOP
// =====================================

void loop() {

  unsigned long now = millis();

  // Serial commands.
  if (Serial.available()) {

    String cmd =
      Serial.readStringUntil('\n');

    handleCommand(cmd);
  }

  // Maintain Wi-Fi without overlapping attempts.
  maintainWifi();

  // End demo hold.
  if (
    demoActive &&
    now - demoStarted >= DEMO_HOLD_MS
  ) {

    demoActive = false;
    updateOutputs();

    Serial.println(
      "Demo complete: simulated load shedding."
    );
  }

  // Temperature sampling.
  if (now - lastTemp >= TEMP_INTERVAL) {

    lastTemp = now;

    float t = ds.getTempCByIndex(0);

    tempValid =
      t != DEVICE_DISCONNECTED_C &&
      isfinite(t) &&
      t >= -55 &&
      t <= 125;

    if (tempValid) {

      tempC = t;

      if (tempC >= HIGH_TEMP_C) {
        thermalTrip = true;
      }
    }

    ds.requestTemperatures();

    updateOutputs();
  }

  // Sample real electrical measurements independently of demo load control.
  if (now - lastPzem >= PZEM_INTERVAL) {
    lastPzem = now;
    readPzem();
  }

  // Indicators.
  bool alarm = shedding || thermalTrip;

  digitalWrite(
    GREEN_LED,
    alarm ? LOW : HIGH
  );

  digitalWrite(
    YELLOW_LED,
    shedding ? HIGH : LOW
  );

  digitalWrite(
    RED_LED,
    thermalTrip ? HIGH : LOW
  );

  updateBuzzer();

  // OLED refresh.
  if (now - lastDisplay >= DISPLAY_INTERVAL) {

    lastDisplay = now;
    drawDisplay();
  }

  // Cloud communication.
  if (
    !demoActive &&
    now - lastNet >= NET_INTERVAL
  ) {

    lastNet = now;
    syncCloud();
  }
}
