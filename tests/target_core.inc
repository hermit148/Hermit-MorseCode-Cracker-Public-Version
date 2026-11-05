#include "../MorseCore.h"
#include <cassert>
#include <cstdio>
#include <random>
#include <string>
#undef assert
#define assert(test) do { ++qaCoreChecks; if (!(test)) { qaCoreFailure=__LINE__; return; } } while(0)
using namespace morse;
void roundtrip(const char *text, unsigned wpm, uint32_t start = 1000) {
  Transmitter tx;
  Receiver rx;
  rx.reset(wpm);
  assert(tx.start(text, wpm, start));
  bool old = false;
  uint32_t elapsed = 0;
  do {
    uint32_t now = start + elapsed;
    tx.tick(now);
    if (tx.on != old) {
      rx.edge(tx.on, now);
      old = tx.on;
    }
    rx.tick(now);
    elapsed++;
    if ((elapsed & 4095)==0) vTaskDelay(1);
    assert(elapsed < 1000000);
  } while (tx.active);
  for (unsigned i = 0; i < 5000; i++)
    rx.tick(start + elapsed + i);
  assert(rx.ready);
  if (strcmp(rx.text, text)) {
    fprintf(stderr, "Expected %s got %s at %u WPM\n", text, rx.text, wpm);
    assert(false);
  }
}
void qaCoreTests() {
  char text[121], code[1000];
  assert(normalize("  hello\n WORLD  ", text));
  assert(!strcmp(text, "HELLO WORLD"));
  assert(!normalize("hello #", text));
  assert(!normalize("", text));
  assert(!normalize(std::string(121, 'A').c_str(), text));
  assert(normalize(std::string(120, 'A').c_str(), text));
  for (auto &e : alphabet) {
    char c[2] = {e.c, 0};
    assert(encode(c, code, sizeof(code)));
    assert(decodeText(code, text));
    assert(text[0] == e.c);
  }
  assert(!decodeText("......", text));
  assert(!decodeText("...x", text));
  assert(decodeText("... --- ... / .... . .-.. .--.", text));
  assert(!strcmp(text, "SOS HELP"));
  assert(!decodeText(std::string(1000, '.').c_str(), text));
  assert(!encode("AB", code, 2));
  char sentinel='X';
  assert(!encode("A", &sentinel, 0));
  assert(sentinel=='X');
  assert(!decodeText(std::string(121*2,'.').c_str(),text));
  const char *map = "  ETIANMSURWDKGOHVF L PJBXCYZQ  ";
  for (int i = 2; i < 30; i++)
    if (map[i] != ' ')
      assert(ledBit(map[i]) == i);
  assert(ledBit('9') == -1);
  for (unsigned wpm = 5; wpm <= 30; wpm++)
    roundtrip("SOS HELP 19?", wpm);
  roundtrip("A B", 12, 0xfffffe00u);
  roundtrip(std::string(120,'E').c_str(),30);
  roundtrip(".,?/=+-@!():77",15);
  Receiver rx;
  rx.reset(12);
  rx.edge(true, 0);
  rx.edge(false, 5);
  rx.tick(5000);
  assert(!rx.ready);
  rx.reset(12);
  rx.edge(true, 0);
  rx.edge(false, 900);
  rx.tick(3000);
  assert(rx.ready && !strcmp(rx.text, "?"));
  Transmitter tx;
  assert(tx.start("T", 12, 100));
  assert(!tx.start("E", 12, 100));
  assert(tx.on);
  tx.tick(399);
  assert(tx.on);
  assert(tx.tick(400));
  assert(!tx.on && !tx.active);
  float samples[160];
  for (int i = 0; i < 160; i++)
    samples[i] = .02f * sinf(6.2831853f * 700 * i / 16000);
  assert(detectTone(samples, 160, 16000, 700, .003, false).tone);
  for (int i = 0; i < 160; i++)
    samples[i] = .02f * sinf(6.2831853f * 1500 * i / 16000);
  assert(!detectTone(samples, 160, 16000, 700, .003, false).tone);
  for (float &v : samples)
    v = 0;
  assert(!detectTone(samples, 160, 16000, 700, .003, false).tone);
  std::mt19937 rng(42);
  std::normal_distribution<float> noise(0, .01);
  int falsePositives = 0;
  for (int n = 0; n < 200; n++) {
    for (float &v : samples)
      v = noise(rng);
    falsePositives += detectTone(samples, 160, 16000, 700, .003, false).tone;
  }
  assert(falsePositives < 4);
  for (int n = 0; n < 200; n++) {
    std::string s;
    for (int i = 0; i < 200; i++)
      s += char(rng() % 128);
    decodeText(s.c_str(), text);
    normalize(s.c_str(), text);
  }
  Serial.println("PASS: alphabet, normalization, bounds, all 5-30 WPM, rollover, glitches, timing, LED "
       "mapping, tone discrimination and noise.");
}

#undef assert
