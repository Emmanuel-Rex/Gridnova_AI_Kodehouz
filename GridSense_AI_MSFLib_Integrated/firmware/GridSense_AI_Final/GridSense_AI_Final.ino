// GridSense AI / Team GridNova. Two relay channels, DS18B20, OLED, Render API.
// REAL: relay states, DS18B20. SIMULATED: watts and overload. NOT mains protection.
// Libraries: Adafruit SSD1306, Adafruit GFX, OneWire, DallasTemperature.
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <OneWire.h>
#include <DallasTemperature.h>

const char* WIFI_SSID = "Gridnova";
const char* WIFI_PASSWORD = "123456789";
const char* API_BASE_URL = "https://gridsense-ai-api.onrender.com"; // CHANGE if Render URL differs
const char* DEVICE_KEY = "LdWoSvCaspLuO5XMXQ2S4YFdHw480i1jaCQ0M3JFyHJJ1WlUkIwGL7PWi1JvKrHY"; // Must equal Render DEVICE_KEY
const bool DEMO_TLS_INSECURE = true; // Demo only: skips TLS verification
const uint8_t RELAYS[2] = {13,14};
const uint8_t GREEN=16, YELLOW=17, RED=18, BUZZER=4, TEMP=19;
const uint8_t RELAY_ON=LOW, RELAY_OFF=HIGH; // active-low relay board
const float NOMINAL_W[2]={15.0f,60.0f}; // SIMULATED ratings
const float LIMIT_W=70.0f, HIGH_TEMP_C=45.0f, RESET_TEMP_C=40.0f;
Adafruit_SSD1306 oled(128,64,&Wire,-1);
OneWire oneWire(TEMP);
DallasTemperature ds(&oneWire);
bool requested[2]={true,false}, connected[2]={false,false};
bool autoMode=true, shedding=false, thermalTrip=false, tempValid=false, oledReady=false;
float demand=0, connectedDemand=0, tempC=0;
unsigned long lastTemp=0,lastNet=0,lastDisplay=0,lastWiFi=0;

void applyLoads(){
  demand=0;connectedDemand=0;
  for(int i=0;i<2;i++)if(requested[i])demand+=NOMINAL_W[i];
  bool allowed[2]={requested[0],requested[1]};
  float total=demand;shedding=false;
  if(autoMode && total>LIMIT_W){
    for(int i=1;i>=0;i--){
      if(allowed[i] && total>LIMIT_W){allowed[i]=false;total-=NOMINAL_W[i];shedding=true;}
    }
  }
  if(thermalTrip){allowed[0]=false;allowed[1]=false;}
  for(int i=0;i<2;i++){
    connected[i]=allowed[i];
    digitalWrite(RELAYS[i],connected[i]?RELAY_ON:RELAY_OFF);
    if(connected[i])connectedDemand+=NOMINAL_W[i];
  }
}

void command(String cmd){
  cmd.trim();cmd.toLowerCase();
  if(cmd=="1" || cmd=="2"){
    int i=cmd.toInt()-1;requested[i]=!requested[i];
  }else if(cmd=="auto")autoMode=!autoMode;
  else if(cmd=="reset"){
    requested[0]=true;requested[1]=false;autoMode=true;
    if(tempValid && tempC<RESET_TEMP_C)thermalTrip=false;
  }else if(cmd!="status")return;
  applyLoads();Serial.println("COMMAND: "+cmd);
}

String payload(){
  String s="{\"device\":\"gridnova-esp32\",\"mode\":\"SIMULATED_DEMAND_REAL_TEMPERATURE\"";
  s+=",\"demand_w\":"+String(demand,1);
  s+=",\"connected_w\":"+String(connectedDemand,1);
  s+=",\"limit_w\":"+String(LIMIT_W,1);
  s+=",\"temperature_c\":"+(tempValid?String(tempC,2):String("null"));
  s+=",\"load1\":"+String(connected[0]?"true":"false");
  s+=",\"load2\":"+String(connected[1]?"true":"false");
  s+=",\"auto\":"+String(autoMode?"true":"false");
  s+=",\"overload\":"+String(shedding?"true":"false");
  s+=",\"thermal_trip\":"+String(thermalTrip?"true":"false")+"}";
  return s;
}

void wifiConnect(){
  if(WiFi.status()==WL_CONNECTED)return;
  WiFi.mode(WIFI_STA);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  Serial.print("Wi-Fi connecting");
  for(int i=0;i<20 && WiFi.status()!=WL_CONNECTED;i++){delay(250);Serial.print('.');}
  Serial.println(WiFi.status()==WL_CONNECTED?" CONNECTED":" OFFLINE");
  if(WiFi.status()==WL_CONNECTED)Serial.println(WiFi.localIP());
}

void syncCloud(){
  if(WiFi.status()!=WL_CONNECTED)return;
  WiFiClientSecure client;client.setTimeout(5000);
  if(DEMO_TLS_INSECURE)client.setInsecure();
  HTTPClient http;http.setTimeout(5000);
  if(http.begin(client,String(API_BASE_URL)+"/api/v1/gridsense/telemetry")){
    http.addHeader("Content-Type","application/json");
    http.addHeader("X-Device-Key",DEVICE_KEY);
    int code=http.POST(payload());Serial.printf("Telemetry HTTP %d\n",code);
    if(code>0 && code!=200)Serial.println(http.getString());
    http.end();
  }
  WiFiClientSecure pollClient;pollClient.setTimeout(5000);
  if(DEMO_TLS_INSECURE)pollClient.setInsecure();
  HTTPClient poll;poll.setTimeout(5000);
  if(poll.begin(pollClient,String(API_BASE_URL)+"/api/v1/gridsense/device-command")){
    poll.addHeader("X-Device-Key",DEVICE_KEY);
    int code=poll.GET();Serial.printf("Command HTTP %d\n",code);
    if(code==200){String c=poll.getString();c.trim();if(c=="1"||c=="2"||c=="auto"||c=="reset"||c=="status")command(c);}
    poll.end();
  }
}

void draw(){
  if(!oledReady)return;
  oled.clearDisplay();oled.setTextSize(1);oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0,0);oled.println("GRIDSENSE AI / GRIDNOVA");
  oled.setCursor(0,12);oled.printf("Req:%.0fW Act:%.0fW",demand,connectedDemand);
  oled.setCursor(0,24);oled.printf("L1:%s  L2:%s",connected[0]?"ON":"OFF",connected[1]?"ON":"OFF");
  oled.setCursor(0,35);if(tempValid)oled.printf("Temp:%.1f C",tempC);else oled.print("Temp: N/A");
  oled.setCursor(0,46);oled.print(thermalTrip?"TEMP TRIP":shedding?"SIM LOAD SHED":"SYSTEM NORMAL");
  oled.setCursor(0,56);oled.print(WiFi.status()==WL_CONNECTED?"WiFi OK":"WiFi OFFLINE");
  oled.display();
}

void setup(){
  // Outputs OFF before pinMode; external relay pull-ups may be needed at boot.
  for(int i=0;i<2;i++){digitalWrite(RELAYS[i],RELAY_OFF);pinMode(RELAYS[i],OUTPUT);}
  pinMode(GREEN,OUTPUT);pinMode(YELLOW,OUTPUT);pinMode(RED,OUTPUT);pinMode(BUZZER,OUTPUT);
  digitalWrite(BUZZER,LOW);
  Serial.begin(115200);Serial.setTimeout(70);
  Wire.begin(21,22);oledReady=oled.begin(SSD1306_SWITCHCAPVCC,0x3C);
  ds.begin();ds.setResolution(10);ds.setWaitForConversion(false);ds.requestTemperatures();
  applyLoads();draw();wifiConnect();
  Serial.println("READY. Commands: 1 2 auto reset status");
}

void loop(){
  if(Serial.available()){String cmd=Serial.readStringUntil('\n');command(cmd);Serial.println(payload());}
  unsigned long now=millis();
  if(now-lastTemp>=1000){
    lastTemp=now;float t=ds.getTempCByIndex(0);
    tempValid=(t!=DEVICE_DISCONNECTED_C && isfinite(t) && t>=-55 && t<=125);
    if(tempValid){tempC=t;if(tempC>=HIGH_TEMP_C)thermalTrip=true;}
    ds.requestTemperatures();applyLoads();
  }
  bool alarm=shedding||thermalTrip;
  digitalWrite(GREEN,alarm?LOW:HIGH);
  digitalWrite(YELLOW,shedding?HIGH:LOW);
  digitalWrite(RED,thermalTrip?HIGH:LOW);
  digitalWrite(BUZZER,alarm && (now/350)%2==0?HIGH:LOW);
  if(now-lastDisplay>=500){lastDisplay=now;draw();}
  if(now-lastWiFi>=20000){lastWiFi=now;if(WiFi.status()!=WL_CONNECTED)wifiConnect();}
  if(now-lastNet>=6000){lastNet=now;syncCloud();}
}
