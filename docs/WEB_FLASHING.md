# Method 2: Spacehuhn browser flasher

[README](../README.md) | [Non-mic wiring](WIRING.md) | [Mic wiring](WIRING_MIC_DIRECT.md)

Use desktop Chrome or Microsoft Edge with a USB data cable. No Arduino
installation or compilation is needed. Both versions use five direct buttons.

## Choose one image

| Hardware | Complete image | Address |
|---|---|---|
| OLED, buzzer and five direct buttons; mic disabled | [Non-mic .bin](../firmware/Hermits-Morse-Cracker-C3-Direct-Buttons.bin) | **0x0** |
| Same controls plus INMP441; required GPIO2 pullup | [Mic .bin](../firmware/Hermits-Morse-Cracker-C3-Mic-Direct-Buttons.bin) | **0x0** |

Both are complete 4 MB merged images with bootloader, partition table, boot
metadata and matching application. Their NVS regions contain no saved settings.
The upload package contains exactly these two firmware binaries.

**Flashing either complete image resets saved Wi-Fi/provider settings and
presets.** Download the actual raw binary from GitHub or extract it from the
project archive; saving a GitHub HTML page with a .bin suffix is not firmware.

## Flash and start

1. Close Arduino Serial Monitor and other programs using the serial port.
2. Disconnect power and disconnect the microphone completely. Reconnect the C3
   to USB with the microphone still disconnected.
3. Open [esptool.spacehuhn.com](https://esptool.spacehuhn.com/).
4. Click **Connect**, select the board's port and confirm **ESP32-C3**.
5. Use the single merged-file layout, **Multiple files OFF**. Choose one image
   above and set **0x0**; enter **0** if the field already shows a fixed 0x prefix.
6. Click **Program**, confirm, and wait for **Done!**. Keep USB connected until
   programming finishes. No separate whole-flash Erase is needed.
7. Disconnect the browser serial session. For the mic version, unplug power,
   install the 10k pullup from GPIO2 to 3V3 and connect the microphone using the
   [mic diagram and sequence](WIRING_MIC_DIRECT.md#flash-and-connect).
8. Reconnect power or reset. Join **HERMITS MORSECODE CRACKER**, password
   **HermitCrack**. Open **http://192.168.4.1**; web key is also **HermitCrack**.

Never flash either supplied complete image at 0x10000. Both use **0x0**.
For later source updates that preserve settings, use Arduino IDE Upload with
the same partition table and Erase All Flash disabled.

## Connection troubleshooting

- Close other serial programs and try a known USB data cable/another USB port.
- Try 115200 baud in the flasher settings and reconnect.
- For manual download mode, hold BOOT, tap RESET, release BOOT, then reconnect
  to the bootloader port if it re-enumerates.
- Confirm the selected chip is ESP32-C3 with 4 MB flash.
- The website uses an esptool-js RAM stub. If it fails on this board/USB setup,
  use the ROM --no-stub command in README Method 3.

## Verification and limits

Check [firmware/SHA256SUMS.json](../firmware/SHA256SUMS.json). Both images were
compiled and linked within the 3 MB application partition. Packaging checks
verify image hashes, matching source hashes, ESP32-C3 image headers, matching
application payloads and blank NVS. Native USB remains enabled.

The browser steps were checked against the flasher's source. Live browser
flashing was not performed during packaging, and this task does not flash the
connected board. Mic audio and repeated cold starts remain hardware checks.

Sources: [Spacehuhn ESPWebTool](https://github.com/SpacehuhnTech/espwebtool),
[file layout and offset controls](https://github.com/SpacehuhnTech/espwebtool/blob/main/src/components/FileList.js),
[Web Serial compatibility](https://github.com/SpacehuhnTech/espwebtool/blob/main/src/components/Home.js).
