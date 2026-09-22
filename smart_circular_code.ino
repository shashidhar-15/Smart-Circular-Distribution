// --------- BLYNK TEMPLATE DETAILS ----------
#define BLYNK_TEMPLATE_ID ""
#define BLYNK_TEMPLATE_NAME ""
#define BLYNK_AUTH_TOKEN ""

#include <WiFi.h>
#include <BlynkSimpleEsp32.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <vector>

using std::vector;


// ---------- PINS ----------
#define BUZZER_PIN 25
#define BUTTON_PIN 26


// ---------- OLED ----------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  -1
);


// ---------- WIFI ----------
char ssid[] = "";
char pass[] = "";


// ---------- APP VARIABLES ----------
String messageText = "";
String senderName = "";

int urgencyFlag = 0;   // 0 = normal, 1 = urgent


// ---------- MESSAGE / DISPLAY STATE ----------
bool pendingMessage = false;

unsigned long messageArrivedTime = 0;


// ---------- V2 SYNC / RETRY CONTROL ----------
unsigned long lastV2ReceivedTime = 0;
unsigned long lastV2SyncCall = 0;

const unsigned long V2_SYNC_INTERVAL_MS = 200;
const unsigned long MAX_V2_WAIT_MS = 5000;

int v2SyncAttempts = 0;

const int MAX_V2_SYNC_ATTEMPTS = 25;


// ---------- BEEP STATE MACHINE ----------
enum BeepState {
  BEEP_IDLE,
  BEEP_ON_1,
  BEEP_GAP,
  BEEP_ON_2,
  BEEP_DONE
};

BeepState beepState = BEEP_IDLE;

unsigned long beepStateTs = 0;
unsigned long beepDoneTs = 0;


// ---------- SCROLLING / PARAGRAPH LAYOUT ----------
vector<String> wrappedLines;

int lineHeight = 8;

int headerHeight = 20;
int headerTextY = 4;

int areaY = headerHeight;
int areaHeight = SCREEN_HEIGHT - headerHeight;

int blockHeight = 0;
int scrollY = 0;

bool verticalScrolling = false;

unsigned long lastScrollMs = 0;

const unsigned long SCROLL_INTERVAL_MS = 30;
const int SCROLL_STEP_PX = 1;

unsigned long pauseAtEndMs = 800;
unsigned long endPauseStart = 0;

bool ackSent = false;


// ---------- FUNCTION PROTOTYPES ----------
void startBeepSequence();
void handleBeepState();

void wrapTextToLines(
  const String &text,
  vector<String> &outLines
);

void layoutMessageBlock();
void drawStaticBlock();
void redrawMessageBlock();


// =====================================================
// BLYNK HANDLERS
// =====================================================

// ---------- V0 : MESSAGE ----------
BLYNK_WRITE(V0) {

  messageText = param.asStr();

  Serial.print("V0 (Message) received: ");
  Serial.println(messageText);

  // Request latest urgency
  Serial.println("V0 handler: calling Blynk.syncVirtual(V2)");

  Blynk.syncVirtual(V2);

  pendingMessage = true;

  messageArrivedTime = millis();

  v2SyncAttempts = 0;

  lastV2SyncCall = millis();

  ackSent = false;

  Blynk.virtualWrite(V3, 0);
}


// ---------- V1 : SENDER ----------
BLYNK_WRITE(V1) {

  senderName = param.asStr();

  Serial.print("V1 (Sender) received: ");
  Serial.println(senderName);

  // Do not prepare display here
}


// ---------- V2 : URGENCY ----------
BLYNK_WRITE(V2) {

  urgencyFlag = param.asInt();

  lastV2ReceivedTime = millis();

  Serial.print("V2 (Urgency) received: ");
  Serial.print(urgencyFlag);

  Serial.print(" ts=");
  Serial.println(lastV2ReceivedTime);
}


// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(BUTTON_PIN, INPUT_PULLUP);


  // ---------- OLED INITIALIZATION ----------
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {

    Serial.println("OLED not found!");

    while (1);
  }


  display.setTextWrap(false);

  display.clearDisplay();

  display.setTextSize(1);

  display.setTextColor(SSD1306_WHITE);

  display.setCursor(0, 20);

  display.println("Connecting...");

  display.display();


  // ---------- BLYNK / WIFI ----------
  Blynk.begin(
    BLYNK_AUTH_TOKEN,
    ssid,
    pass
  );


  display.clearDisplay();

  display.setCursor(0, 20);

  display.println("Connected!");

  display.display();


  Serial.println("Setup complete.");
}


// =====================================================
// MAIN LOOP
// =====================================================

void loop() {

  Blynk.run();


  // ---------- HANDLE BUTTON ACKNOWLEDGEMENT ----------

  if (digitalRead(BUTTON_PIN) == LOW && !ackSent) {

    ackSent = true;

    Blynk.virtualWrite(V3, 1);

    Serial.println("Button pressed -> ack sent (V3=1)");

    delay(250);   // debounce
  }


  // ---------- HANDLE NEW MESSAGE ----------

  if (pendingMessage && beepState == BEEP_IDLE) {

    bool v2ArrivedAfterMsg =
      (lastV2ReceivedTime >= messageArrivedTime);


    if (v2ArrivedAfterMsg) {

      Serial.println("V2 is fresh -> starting beep.");

      startBeepSequence();

    }
    else {

      unsigned long now = millis();


      // Retry V2 synchronization
      if (
        (now - lastV2SyncCall >= V2_SYNC_INTERVAL_MS) &&
        (v2SyncAttempts < MAX_V2_SYNC_ATTEMPTS)
      ) {

        Serial.print(
          "Attempting Blynk.syncVirtual(V2) (attempt "
        );

        Serial.print(v2SyncAttempts + 1);

        Serial.println(")");


        Blynk.syncVirtual(V2);

        v2SyncAttempts++;

        lastV2SyncCall = now;
      }


      // Fallback if V2 does not arrive
      if (now - messageArrivedTime >= MAX_V2_WAIT_MS) {

        Serial.println(
          "V2 wait exceeded -> start beep with fallback."
        );

        startBeepSequence();
      }
    }
  }


  // ---------- MANAGE BEEP STATE MACHINE ----------

  handleBeepState();


  // ---------- AFTER BEEP, WAIT 5 SECONDS ----------

  if (beepState == BEEP_DONE) {

    if (beepDoneTs == 0) {

      beepDoneTs = millis();
    }


    if (millis() - beepDoneTs >= 5000) {

      // Prepare layout and start display/scrolling
      layoutMessageBlock();

      pendingMessage = false;

      beepDoneTs = 0;

      beepState = BEEP_IDLE;
    }
  }


  // ---------- HANDLE VERTICAL SCROLLING ----------

  if (
    verticalScrolling &&
    wrappedLines.size() > 0
  ) {

    unsigned long now = millis();


    if (endPauseStart) {

      if (now - endPauseStart >= pauseAtEndMs) {

        // Restart loop
        endPauseStart = 0;

        scrollY = 0;

        redrawMessageBlock();
      }
    }

    else if (
      now - lastScrollMs >= SCROLL_INTERVAL_MS
    ) {

      lastScrollMs = now;

      scrollY -= SCROLL_STEP_PX;


      // Reached the end
      if (
        scrollY <= (areaHeight - blockHeight)
      ) {

        // Pause and then restart
        endPauseStart = now;
      }

      else {

        redrawMessageBlock();
      }
    }
  }
}


// =====================================================
// BEEP FUNCTIONS
// =====================================================

void startBeepSequence() {

  Serial.print(
    "startBeepSequence(); urgency="
  );

  Serial.println(urgencyFlag);


  beepState = BEEP_ON_1;

  beepStateTs = millis();

  digitalWrite(BUZZER_PIN, HIGH);
}


void handleBeepState() {

  unsigned long now = millis();


  switch (beepState) {

    case BEEP_IDLE:
    case BEEP_DONE:

      break;


    // ---------- FIRST BEEP ----------
    case BEEP_ON_1:

      if (now - beepStateTs >= 1500) {

        digitalWrite(BUZZER_PIN, LOW);


        // Normal message
        if (urgencyFlag == 0) {

          beepState = BEEP_DONE;

          beepStateTs = now;

          beepDoneTs = now;

          Serial.println(
            "normal beep done"
          );
        }

        // Urgent message
        else {

          beepState = BEEP_GAP;

          beepStateTs = now;

          Serial.println(
            "gap after 1st"
          );
        }
      }

      break;


    // ---------- GAP ----------
    case BEEP_GAP:

      if (now - beepStateTs >= 400) {

        digitalWrite(BUZZER_PIN, HIGH);

        beepState = BEEP_ON_2;

        beepStateTs = now;

        Serial.println(
          "start 2nd beep"
        );
      }

      break;


    // ---------- SECOND BEEP ----------
    case BEEP_ON_2:

      if (now - beepStateTs >= 1500) {

        digitalWrite(BUZZER_PIN, LOW);

        beepState = BEEP_DONE;

        beepStateTs = now;

        beepDoneTs = now;

        Serial.println(
          "urgent beep done"
        );
      }

      break;
  }
}


// =====================================================
// TEXT WRAPPING
// =====================================================

void wrapTextToLines(
  const String &text,
  vector<String> &outLines
) {

  outLines.clear();


  String trimmed = text;

  trimmed.trim();


  // Replace CR/LF with spaces
  trimmed.replace("\r", " ");
  trimmed.replace("\n", " ");


  // Split words by spaces
  int len = trimmed.length();

  int i = 0;

  String word = "";

  vector<String> words;


  while (i < len) {

    char c = trimmed[i];


    if (c == ' ') {

      if (word.length() > 0) {

        words.push_back(word);

        word = "";
      }

    }

    else {

      word += c;
    }

    i++;
  }


  if (word.length() > 0) {

    words.push_back(word);
  }


  String line = "";


  for (
    size_t widx = 0;
    widx < words.size();
    ++widx
  ) {

    String &wrd = words[widx];


    // Candidate if we add this word
    String candidate =
      (line.length() == 0)
      ? wrd
      : (line + " " + wrd);


    // Measure candidate width
    int16_t x1, y1;

    uint16_t candW, candH;


    display.getTextBounds(
      candidate.c_str(),
      0,
      0,
      &x1,
      &y1,
      &candW,
      &candH
    );


    // If too wide and line is empty,
    // break the word into character chunks
    if (
      candW > SCREEN_WIDTH &&
      line.length() == 0
    ) {

      String part = "";


      for (
        int ci = 0;
        ci < wrd.length();
        ++ci
      ) {

        part += wrd[ci];


        display.getTextBounds(
          part.c_str(),
          0,
          0,
          &x1,
          &y1,
          &candW,
          &candH
        );


        if (candW > SCREEN_WIDTH) {

          // Remove last character
          part.remove(
            part.length() - 1
          );


          if (part.length() > 0) {

            outLines.push_back(part);
          }


          // Start new part with current character
          part = String(wrd[ci]);
        }
      }


      if (part.length() > 0) {

        outLines.push_back(part);
      }


      line = "";
    }


    else if (candW <= SCREEN_WIDTH) {

      // Candidate fits
      line = candidate;
    }


    else {

      // Candidate too wide
      if (line.length() > 0) {

        outLines.push_back(line);
      }

      line = wrd;
    }
  }


  if (line.length() > 0) {

    outLines.push_back(line);
  }
}


// =====================================================
// MESSAGE LAYOUT
// =====================================================

void layoutMessageBlock() {

  // Ensure font settings
  display.setTextSize(1);

  display.setTextColor(
    SSD1306_WHITE
  );

  display.setTextWrap(false);


  wrapTextToLines(
    messageText,
    wrappedLines
  );


  // Compute line height
  int16_t x1, y1;

  uint16_t w, h;


  display.getTextBounds(
    "Tg",
    0,
    0,
    &x1,
    &y1,
    &w,
    &h
  );


  lineHeight = max(
    8,
    (int)h
  );


  areaY = headerHeight;

  areaHeight =
    SCREEN_HEIGHT - headerHeight;


  blockHeight =
    (int)wrappedLines.size()
    * lineHeight;


  Serial.println(
    "----- layoutMessageBlock -----"
  );

  Serial.print("lines = ");

  Serial.println(
    (int)wrappedLines.size()
  );


  Serial.print("lineHeight = ");

  Serial.println(lineHeight);


  Serial.print("blockHeight = ");

  Serial.println(blockHeight);


  Serial.print("areaHeight = ");

  Serial.println(areaHeight);


  // ---------- MESSAGE FITS ----------
  if (blockHeight <= areaHeight) {

    verticalScrolling = false;

    scrollY = 0;


    drawStaticBlock();


    Serial.println(
      "verticalScrolling = false (fits)"
    );
  }


  // ---------- MESSAGE NEEDS SCROLLING ----------
  else {

    verticalScrolling = true;

    scrollY = 0;

    lastScrollMs = millis();

    endPauseStart = 0;


    // Draw initial frame
    drawStaticBlock();


    Serial.println(
      "verticalScrolling = true (will scroll)"
    );
  }
}


// =====================================================
// DRAW MESSAGE
// =====================================================

void drawStaticBlock() {

  display.clearDisplay();


  // ---------- HEADER ----------
  display.setTextSize(1);

  display.setTextColor(
    SSD1306_WHITE
  );

  display.setCursor(
    0,
    headerTextY
  );

  display.print("From: ");

  display.println(senderName);


  // ---------- MESSAGE AREA ----------
  int y = areaY + scrollY;


  display.setTextSize(1);


  for (
    size_t i = 0;
    i < wrappedLines.size();
    ++i
  ) {

    // Line is above visible area
    if (
      y + lineHeight < areaY
    ) {

      y += lineHeight;

      continue;
    }


    // Line is below visible area
    if (y >= SCREEN_HEIGHT) {

      break;
    }


    display.setCursor(
      0,
      y
    );

    display.print(
      wrappedLines[i]
    );


    y += lineHeight;
  }


  display.display();
}


// =====================================================
// REDRAW DURING SCROLLING
// =====================================================

void redrawMessageBlock() {

  // Keep header intact,
  // clear only message area
  display.fillRect(
    0,
    areaY,
    SCREEN_WIDTH,
    areaHeight,
    SSD1306_BLACK
  );


  int y = areaY + scrollY;


  for (
    size_t i = 0;
    i < wrappedLines.size();
    ++i
  ) {

    // Line is above visible area
    if (
      y + lineHeight < areaY
    ) {

      y += lineHeight;

      continue;
    }


    // Line is below visible area
    if (y >= SCREEN_HEIGHT) {

      break;
    }


    display.setCursor(
      0,
      y
    );

    display.print(
      wrappedLines[i]
    );


    y += lineHeight;
  }


  display.display();
}