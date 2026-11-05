# Wokwi connection diagram

[README](../README.md) · [diagram.json](../diagram.json) · [Wiring image](assets/wiring.png)

## Open the circuit

1. Open the requested [new ESP32-C3 project](https://wokwi.com/projects/new/esp32-c3).
2. Open the `diagram.json` tab and replace its contents with this repository's
   [diagram.json](../diagram.json).
3. Switch to the circuit view and use Zoom to fit if needed. Labels identify
   each button's GPIO; colored signals and a common black GND return are explicit.
4. For the standalone wiring check, replace `sketch.ino` with the contents of
   [simulation/wiring-check.ino](../simulation/wiring-check.ino).
5. Add Adafruit SSD1306, Adafruit GFX Library and Adafruit BusIO in Library Manager
   (versions in the root `libraries.txt`), then run.
6. Focus the diagram and use Up/Down/Left/Right arrows or Enter for Select, or
   click the buttons. The test displays observed presses and beeps on Select.

Save/share the project from your own Wokwi account when ready. No permanent
Wokwi project URL is included: the live editor was network-blocked in the
preparation session. Import and simulation execution remain manual checks.

## Board and electrical mapping

The template's board is `board-esp32-c3-devkitm-1`. It represents the ESP32-C3
using a DevKitM-1 footprint, while the physical build uses a SuperMini. Match
GPIO numbers, not the symbol's physical header positions.

| Net | Wokwi endpoint | Component endpoint |
|---|---|---|
| OLED power | `esp:3V3.1` | `oled1:VCC` |
| OLED ground | `esp:GND.1` | `oled1:GND` |
| OLED data | `esp:5` | `oled1:SDA` |
| OLED clock | `esp:0` | `oled1:SCL` |
| Up | `esp:3` | `nav0:1.l` |
| Down | `esp:4` | `nav1:1.l` |
| Left | `esp:7` | `nav2:1.l` |
| Right | `esp:10` | `nav3:1.l` |
| Select | `esp:1` | `nav4:1.l` |
| Button ground | `esp:GND.6` | All `nav*:2.r` contacts through the GND chain |
| Piezo signal | `esp:6` | `rBuzz:1`; `rBuzz:2` joins `bz1:2` (+) |
| Piezo ground | `esp:GND.6` | `bz1:1` (−) |

The board's GND terminals are common. Use `3V3.1`, not an invented `3V3`
endpoint on this Wokwi symbol. TX/RX to `$serialMonitor` are virtual simulator
serial connections; they are not extra physical SuperMini wiring.

`tools/make_wiring.cjs` generates the circuit and SVG/PNG from one pin map. It
checks IDs/endpoints, GPIO agreement, OLED power/I²C, switch contact separation,
common ground, resistor placement, piezo polarity and absence of GPIO/power
shorts. The output image is a logical connection drawing, not a Wokwi screenshot.

## Full Morse firmware versus the wiring check

The standalone sketch tests the display, button inputs and passive piezo. It
does not contain the Morse web application, Wi-Fi setup, provider forwarding or
BLE tools.

A full-firmware Wokwi build requires the appropriate Arduino-ESP32/NimBLE setup,
`WOKWI_BUILD=1`, native USB CDC disabled for the DevKitM-1 UART bridge, microphone
OFF and direct buttons enabled. The root `wokwi.toml` expects a separately built
application/ELF under `build/wokwi/`; those simulator binaries are not supplied.
The physical SuperMini release keeps native USB CDC enabled and `WOKWI_BUILD=0`.
The optional branch was compile-checked, but full simulator execution was not
verified in this session.

## Official part references

- [Diagram format and orthogonal wire routing](https://docs.wokwi.com/diagram-format)
- [ESP32-C3 board pin definitions](https://github.com/wokwi/wokwi-boards/blob/main/boards/esp32-c3-devkitm-1/board.json)
- [SSD1306 pins and address](https://docs.wokwi.com/parts/board-ssd1306)
- [Button contact pairs and keyboard shortcuts](https://docs.wokwi.com/parts/wokwi-pushbutton)
- [Piezo polarity](https://docs.wokwi.com/parts/wokwi-buzzer)

Board/part definitions and simulator names belong to their respective projects.
