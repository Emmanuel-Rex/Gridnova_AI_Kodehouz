GRIDSENSE AI - GRIDNOVA - FAST HACKATHON DEMO

1. Arduino IDE: Install Adafruit GFX, Adafruit SSD1306, OneWire, DallasTemperature.
2. Open GridSense_WiFi_MSFLib_Demo.ino. Set WIFI_SSID, WIFI_PASSWORD and SERVER_URL.
   SERVER_URL must be http://YOUR_LAPTOP_IPV4:8000 (find with ipconfig on Windows).
   Connect ESP32 and laptop to the SAME 2.4 GHz phone hotspot.
3. Upload to ESP32 Dev Module. Serial Monitor 115200 baud.
4. On Windows, open PowerShell in this folder:
      py -m pip install -r requirements.txt
      py -m uvicorn server:app --host 0.0.0.0 --port 8000
   If Windows Firewall asks, allow Python on PRIVATE networks only.
5. Open http://localhost:8000 on laptop.
6. The default admin key for this local demo is gridnova-admin-change-me.
   For real deployments, change BOTH device and admin keys using environment variables
   GRIDSENSE_DEVICE_KEY and GRIDSENSE_ADMIN_KEY and match DEVICE_KEY in the sketch.
7. Click Toggle L3: demand 85W; automatic shed L3; buzzer and red/yellow LEDs on.
8. If ESP32 cannot post: check phone hotspot client isolation, laptop IP, firewall, and Wi-Fi.
9. SIMULATION: all power values are hypothetical. PZEM-004T must remain disconnected.
10. MSFLib: The separate msflib-client.ts shows the documented core configuration and
    a client integration point for an organizer-provided React app. The ready-to-run HMI
    is plain FastAPI/HTML and does not claim to be an MSFLib implementation.

Safety: low-voltage demonstration only. No exposed AC mains. Relay board needs a suitable
5V supply and shared signal ground. GPIO4 buzzer must be 3.3V compatible and low current.
DS18B20 internal pull-up is experimental; use a 4.7k external pull-up for reliability.
