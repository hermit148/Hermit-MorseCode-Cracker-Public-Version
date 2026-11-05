// Standalone Wokwi circuit check. This is not the full Morse firmware.
// Template: https://wokwi.com/projects/new/esp32-c3 (UART serial bridge).
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

constexpr int SDA_PIN=5,SCL_PIN=0,BUZZER_PIN=6;
constexpr int BUTTON_PINS[5]={3,4,7,10,1};
const char *BUTTON_NAMES[5]={"UP","DOWN","LEFT","RIGHT","SELECT"};
Adafruit_SSD1306 screen(128,64,&Wire,-1);
bool oledReady=false,previous[5]={},seen[5]={};uint32_t lastDraw=0;

void setup(){
 Serial.begin(115200);
 for(int pin:BUTTON_PINS)pinMode(pin,INPUT_PULLUP);
 pinMode(BUZZER_PIN,OUTPUT);Wire.begin(SDA_PIN,SCL_PIN);
 oledReady=screen.begin(SSD1306_SWITCHCAPVCC,0x3c);
 Serial.println("HMC standalone wiring check: OLED SDA5/SCL0, buzzer6");
 Serial.println("Buttons: UP3 DOWN4 LEFT7 RIGHT10 SELECT1; each to GND");
 Serial.println(oledReady?"OLED initialized. Inspect actual pixels.":"OLED missing. Check power/I2C.");
 tone(BUZZER_PIN,700,80);
}
void loop(){
 for(unsigned i=0;i<5;++i){bool down=digitalRead(BUTTON_PINS[i])==LOW;
  if(down!=previous[i]){Serial.print(BUTTON_NAMES[i]);Serial.println(down?" DOWN":" UP");if(!down)seen[i]=true;if(i==4&&down)tone(BUZZER_PIN,700,80);previous[i]=down;}}
 if(oledReady&&uint32_t(millis()-lastDraw)>=100){lastDraw=millis();screen.clearDisplay();screen.setTextSize(1);screen.setTextColor(SSD1306_WHITE);screen.setCursor(0,0);screen.println("HMC / WIRING CHECK");screen.drawFastHLine(0,9,128,SSD1306_WHITE);
  for(unsigned i=0;i<5;++i){screen.setCursor(2,13+i*10);screen.print(BUTTON_NAMES[i]);screen.setCursor(62,13+i*10);screen.print(previous[i]?"HELD":seen[i]?"SEEN":"PRESS");}screen.display();}
 delay(5);
}
