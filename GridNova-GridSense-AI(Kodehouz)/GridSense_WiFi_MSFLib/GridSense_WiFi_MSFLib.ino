#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// MY WIFI SETTINGS
const char* WIFI_SSID = "Gridnova";
const char* WIFI_PASSWORD = "123456789";
const char* SERVER_URL = "http://10.213.38.118:8000"; // LAPTOP IP
const char* DEVICE_KEY = "GridNova2026SecureKey"; // server.py

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
const int relays[3] = {13,14,25}; // active LOW
const int GREEN=16, YELLOW=17, RED=18, BUZZER=4, TEMP=19;
const float loadW[3]={10,15,60};
const float LIMIT_W=70;
bool requested[3]={true,true,false};
bool connected[3]={false,false,false};
bool autoMode=true, shedding=false, tempValid=false, oledReady=false;
float demand=0, activePower=0, tempC=0;
OneWire wire(TEMP);
DallasTemperature ds(&wire);
unsigned long lastTemp=0,lastNet=0,lastDisplay=0,lastWiFi=0;

void recalc(){
  demand=0; activePower=0;
  for(int i=0;i<3;i++) if(requested[i]) demand+=loadW[i];
  bool allowed[3]={requested[0],requested[1],requested[2]};
  float total=demand;
  if(autoMode && total>LIMIT_W){
    for(int i=2;i>=0;i--) if(allowed[i] && total>LIMIT_W){allowed[i]=false;total-=loadW[i];}
  }
  shedding=autoMode && demand>LIMIT_W;
  for(int i=0;i<3;i++){
    connected[i]=allowed[i];
    digitalWrite(relays[i],connected[i]?LOW:HIGH);
    if(connected[i]) activePower+=loadW[i];
  }
}
void handleCommand(String c){
  c.trim();c.toLowerCase();
  if(c=="1"||c=="2"||c=="3") requested[c.toInt()-1]=!requested[c.toInt()-1];
  else if(c=="auto") autoMode=!autoMode;
  else if(c=="reset"){requested[0]=true;requested[1]=true;requested[2]=false;autoMode=true;}
  else if(c!="status") return;
  recalc();
}
String json(){
  String s="{\"device\":\"gridnova-esp32\",\"mode\":\"SIMULATION\",\"demand_w\":"+String(demand,1);
  s+=",\"connected_w\":"+String(activePower,1)+",\"limit_w\":"+String(LIMIT_W,1);
  s+=",\"temperature_c\":"+(tempValid?String(tempC,2):String("null"));
  s+=",\"load1\":"+String(connected[0]?"true":"false");
  s+=",\"load2\":"+String(connected[1]?"true":"false");
  s+=",\"load3\":"+String(connected[2]?"true":"false");
  s+=",\"auto\":"+String(autoMode?"true":"false");
  s+=",\"overload\":"+String(shedding?"true":"false")+"}";
  return s;
}
void connectWiFi(){
  if(WiFi.status()==WL_CONNECTED)return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  Serial.print("WiFi connecting");
  for(int i=0;i<12 && WiFi.status()!=WL_CONNECTED;i++){delay(350);Serial.print(".");}
  Serial.println();
  if(WiFi.status()==WL_CONNECTED){Serial.print("ESP32 IP: ");Serial.println(WiFi.localIP());}
  else Serial.println("WiFi unavailable; local control remains active");
}
void syncBackend(){
  if(WiFi.status()!=WL_CONNECTED)return;
  WiFiClient client;
  HTTPClient http;
  String url=String(SERVER_URL)+"/api/v1/gridsense/telemetry";
  if(http.begin(client,url)){
    http.addHeader("Content-Type","application/json");
    http.addHeader("X-Device-Key",DEVICE_KEY);
    int code=http.POST(json());
    Serial.printf("Telemetry HTTP: %d\n",code);
    http.end();
  }
  // Poll one queued command, if any.
  HTTPClient poll;
  if(poll.begin(client,String(SERVER_URL)+"/api/v1/gridsense/device-command")){
    poll.addHeader("X-Device-Key",DEVICE_KEY);
    int code=poll.GET();
    if(code==200){
      String cmd=poll.getString();cmd.trim();
      if(cmd.length()){Serial.println("Remote command: "+cmd);handleCommand(cmd);}
    }
    poll.end();
  }
}
void draw(){
  if(!oledReady)return;
  oled.clearDisplay();oled.setTextSize(1);oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0,0);oled.println("GRIDSENSE AI [SIM]");
  oled.setCursor(0,12);oled.printf("Demand: %.0f W",demand);
  oled.setCursor(0,22);oled.printf("Active: %.0f W",activePower);
  oled.setCursor(0,32);oled.printf("L1:%s L2:%s L3:%s",connected[0]?"ON":"--",connected[1]?"ON":"--",connected[2]?"ON":"--");
  oled.setCursor(0,43);if(tempValid)oled.printf("Temp: %.1f C",tempC);else oled.print("Temp: N/A");
  oled.setCursor(0,54);oled.print(shedding?"ALERT: LOAD SHED":(WiFi.status()==WL_CONNECTED?"NORMAL | WIFI OK":"NORMAL | OFFLINE"));
  oled.display();
}
void setup(){
  // Outputs default OFF, active-low relays. Verify your board before connecting loads.
  for(int i=0;i<3;i++){digitalWrite(relays[i],HIGH);pinMode(relays[i],OUTPUT);}
  pinMode(GREEN,OUTPUT);pinMode(YELLOW,OUTPUT);pinMode(RED,OUTPUT);pinMode(BUZZER,OUTPUT);
  digitalWrite(GREEN,LOW);digitalWrite(YELLOW,LOW);digitalWrite(RED,LOW);digitalWrite(BUZZER,LOW);
  Serial.begin(115200);Serial.setTimeout(50);
  Wire.begin(21,22);
  oledReady=oled.begin(SSD1306_SWITCHCAPVCC,0x3C);
  pinMode(TEMP,INPUT_PULLUP); // temporary; external 4.7k pull-up is recommended
  ds.begin();ds.setResolution(10);ds.setWaitForConversion(false);ds.requestTemperatures();
  recalc();draw();connectWiFi();
  Serial.println("GridSense WiFi demo ready. Serial commands: 1, 2, 3, auto, reset, status");
}
void loop(){
  if(Serial.available()){
    String c=Serial.readStringUntil('\n');c.trim();
    if(c=="status")Serial.println(json());else handleCommand(c);
  }
  unsigned long now=millis();
  if(now-lastTemp>=1200){
    lastTemp=now;
    float t=ds.getTempCByIndex(0);
    tempValid=(t!=DEVICE_DISCONNECTED_C && t>=-55 && t<=125 && t!=85.0);
    if(tempValid)tempC=t;
    ds.requestTemperatures();
  }
  digitalWrite(GREEN,shedding?LOW:HIGH);
  digitalWrite(YELLOW,shedding?HIGH:LOW);
  digitalWrite(RED,shedding?HIGH:LOW);
  digitalWrite(BUZZER,(shedding && ((now/300)%2==0))?HIGH:LOW);
  if(now-lastDisplay>=500){lastDisplay=now;draw();}
  if(now-lastWiFi>=12000){lastWiFi=now;if(WiFi.status()!=WL_CONNECTED)connectWiFi();}
  if(now-lastNet>=2500){lastNet=now;Serial.println(json());syncBackend();}
}
