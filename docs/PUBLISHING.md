# Uploading to GitHub

The prepared folder is **MorseStation-GitHub/MorseStation**. Its matching archive
is **MorseStation-GitHub.zip**. The MorseStation folder is the repository root.

1. Open the MorseStation folder and upload its **contents** to your GitHub
   repository. Keep docs, firmware and other subfolders intact.
2. The root README includes the two firmware downloads, matching diagrams,
   source-build steps, browser flashing and OLED controls.
3. The gallery includes the web interfaces and all 48 native OLED examples.
4. Both releases use direct buttons. The firmware folder contains exactly two
   complete files: non-mic and mic. Each flashes at **0x0**.
5. If you select a project-wide license, add your chosen LICENSE file. Preserve
   the bundled font's existing BSD notice and third-party attribution.

Keep the Arduino sketch folder named **MorseStation**, with all root source and
header files beside MorseStation.ino. A GitHub archive may add a branch suffix;
rename that extracted folder before opening it in Arduino IDE.

The package excludes compiler caches/build outputs, device flash/NVS backups,
runtime credentials, logs, obsolete wiring images and unused hardware releases.
The documented HermitCrack key is the intentional shared default in the source.

The tools and tests support maintaining the firmware and regenerating UI/OLED
images. After rebuilding the two firmware images and updating their metadata,
run node tools/prepare_github.cjs for a new verified snapshot. The optional
--output argument selects a new empty folder whose name must be MorseStation.
The script refuses to overwrite an existing populated directory.

Packaging verifies source/binary hashes, image layout, blank NVS, local links
and the two-release allowlist. It does not publish to GitHub, access the device
or send messages. No GitHub repository has been created or uploaded by this task.
