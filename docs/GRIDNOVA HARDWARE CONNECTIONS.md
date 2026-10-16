# Gridnova AI — Hardware Connection Overview

**Document type:** Public technical overview  
**Project:** Gridnova AI — Intelligent Energy Monitoring & Load Management

## Purpose

This document explains the principal hardware connections and signal flow in the Gridnova AI prototype without publishing GPIO assignments, full schematics, credentials, or proprietary control logic.

## System connection overview

Electrical monitoring (PZEM-004T) and temperature sensing (DS18B20) → ESP32 controller → relay control, OLED status display, LEDs and buzzer. The ESP32 also communicates over Wi-Fi with the cloud backend and dashboard.

## Main hardware components

ESP32 DevKit V1; PZEM-004T electrical meter with current transformer (CT); DS18B20 temperature sensor; 0.96-inch I²C OLED display; relay module (two channels used for two demonstration loads); indicator LEDs; buzzer; two AC lamp loads; suitable low-voltage power supply.

## General connection steps

1. Connect the OLED to the ESP32 I²C interface and its appropriate low-voltage supply.
2. Connect the DS18B20 sensor to an ESP32 digital input, using the appropriate data pull-up arrangement.
3. Connect the PZEM meter communication interface to the ESP32 using compatible UART signal levels and the meter’s specified supply.
4. Connect two relay control inputs to the ESP32 and power the relay module using its specified supply.
5. Connect the LEDs and buzzer to suitable ESP32 outputs with appropriate current limiting or drivers.
6. Supply the ESP32 and low-voltage modules from correctly rated power sources; verify shared signal reference only where required by the module specifications.
7. Have a qualified electrician connect the AC meter, CT, relay contacts and lamp loads inside a suitable insulated enclosure.

## Operating sequence

The ESP32 reads temperature and electrical telemetry, updates the OLED and cloud dashboard, and drives the relay outputs according to the configured demonstration logic. Indicators and buzzer provide local status and alerts. Actual measured PZEM values must be distinguished from estimated load-demand figures in the dashboard.

## Verification checklist

• Confirm stable low-voltage power before connecting AC circuits.
• Check OLED display and temperature readings.
• Confirm PZEM reports valid readings when connected and configured correctly.
• Test relay control first with AC disconnected.
• Confirm each lamp state matches the intended relay state under supervised testing.
• Confirm dashboard telemetry and remote commands.
• Clearly label measured and estimated values.

## Safety and publication notes

This is a conceptual connection guide, not a construction-ready wiring diagram. Mains wiring requires proper isolation, rated protective devices, insulation and qualified supervision. Do not infer AC connections from the block overview. A 12 V DC supply is not a substitute for the rated AC supply of 220–240 V lamps. Keep complete wiring diagrams, firmware secrets and sensitive implementation details in private documentation.

