# IoT Based Smart Circular Distribution System

## Overview

The Smart Circular Distribution System is an IoT-enabled communication platform designed to automate classroom notice distribution in educational institutions.

The system allows faculty members or administrators to send circulars through a web dashboard. Messages are transmitted through Blynk Cloud and displayed on ESP32-based classroom units equipped with OLED displays. The system also supports message acknowledgement and urgency-based alerts.

## Key Features

* Real-time circular distribution
* ESP32 WiFi communication
* OLED-based message display
* Urgent and normal message classification
* Audible buzzer alerts
* Message acknowledgement tracking
* Multi-classroom support
* Cloud-based communication using Blynk

## Hardware Components

* ESP32 Development Board
* 128×64 OLED Display
* Active Buzzer
* Push Button
* WiFi Network

## Software Technologies

* Arduino IDE
* Embedded C
* Blynk IoT Platform
* HTML
* CSS
* JavaScript
* React
* TypeScript
* Supabase

## System Architecture

```text
Web Dashboard
      ↓
Blynk Cloud
      ↓
ESP32 Device
      ↓
OLED Display + Buzzer
      ↓
Acknowledgement Feedback
```

## Working Principle

1. Faculty enters a circular through the web dashboard.
2. The message is sent to the Blynk Cloud platform.
3. ESP32 devices connected through WiFi receive the circular.
4. The OLED display presents the message to students.
5. The buzzer alerts users when a new circular arrives.
6. Users acknowledge the message using a push button.
7. Acknowledgement status is updated on the dashboard.

## Results

* Reliable real-time message delivery
* Successful multi-device communication
* OLED scrolling support for long messages
* Low-latency acknowledgement feedback
* Scalable architecture for multiple classrooms

## Future Enhancements

* Mobile application integration
* Voice-based circular announcements
* Multi-building deployment
* Cloud database logging
* Advanced notification management

## Author

Shashidhar Math

Electronics and Communication Engineering

SDM Institute of Technology
