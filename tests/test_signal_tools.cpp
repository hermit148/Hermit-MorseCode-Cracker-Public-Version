#include "../SignalTools.h"

// Compile-time execution runs the real estimator and ring-buffer code even
// when a native host C++ runtime is unavailable. A failed check fails the build.
constexpr bool allSpeeds() {
  for (unsigned wpm = 5; wpm <= 30; ++wpm) {
    morse::SpeedEstimator estimator;
    estimator.reset(12);
    unsigned unit = 1200 / wpm;
    for (unsigned i = 0; i < 30; ++i)
      estimator.observe(unit * (i % 2 ? 3 : 1));
    // Integer-millisecond pulses cannot always distinguish adjacent WPM at
    // the fast end (e.g. a 42 ms dot is approximately 28.6 WPM).
    int reportedError = int(estimator.wpm()) - int(wpm);
    if (!estimator.acquired() || estimator.unitMs() != unit || reportedError < -1 || reportedError > 1)
      return false;
  }
  return true;
}
constexpr bool jitterAndOutliers() {
  for (unsigned wpm = 5; wpm <= 30; ++wpm) {
    morse::SpeedEstimator estimator;
    estimator.reset(12);
    int unit = 1200 / wpm;
    for (int i = 0; i < 36; ++i) {
      int duration = unit * (i % 2 ? 3 : 1);
      duration += (i % 3 - 1) * duration / 12;
      estimator.observe(duration);
      if (i % 7 == 0) { estimator.observe(3); estimator.observe(4000); }
    }
    if (!estimator.acquired()) return false;
    int error = int(estimator.unitMs()) - unit;
    if (error < -unit / 8 || error > unit / 8) return false;
  }
  return true;
}
constexpr bool ambiguousAndReset() {
  morse::SpeedEstimator estimator;
  estimator.reset(10);
  for (unsigned i = 0; i < 30; ++i) estimator.observe(100);
  if (estimator.acquired() || estimator.wpm() != 10) return false;
  estimator.reset(12);
  for (unsigned i = 0; i < 30; ++i) estimator.observe(i % 2 ? 120 : 100);
  if (estimator.acquired()) return false;
  estimator.reset(15);
  if (estimator.sampleCount() || estimator.acquired() || estimator.wpm() != 15) return false;
  if (estimator.observe(1) || estimator.observe(1000) || estimator.sampleCount()) return false;
  return true;
}
constexpr bool speedChange() {
  morse::SpeedEstimator estimator;
  estimator.reset(12);
  for (unsigned i = 0; i < 30; ++i) estimator.observe(i % 2 ? 450 : 150);
  if (estimator.wpm() != 8) return false;
  for (unsigned i = 0; i < 60; ++i) estimator.observe(i % 2 ? 150 : 50);
  return estimator.acquired() && estimator.wpm() == 24;
}
constexpr bool timelineBoundsAndRollover() {
  morse::SignalTimeline timeline;
  timeline.add(0, 0, true, false);
  if (timeline.count || timeline.next != 1) return false;
  for (unsigned i = 0; i < 100; ++i)
    timeline.add(0xfffffff0u + i * 100, 100, i % 2, i % 3 == 0);
  if (timeline.count != 64 || timeline.next != 101) return false;
  for (uint32_t id = timeline.next - timeline.count; id < timeline.next; ++id) {
    const auto &item = timeline.items[(id - 1) % timeline.capacity];
    if (item.id != id || item.duration != 100 || item.at != 0xfffffff0u + (id-1)*100)
      return false;
  }
  return true;
}
static_assert(allSpeeds(), "Automatic timing must acquire every speed from 5 to 30 WPM");
static_assert(jitterAndOutliers(), "Timing must tolerate moderate jitter and reject glitches");
static_assert(ambiguousAndReset(), "Ambiguous pulses must not produce a false speed lock");
static_assert(speedChange(), "Timing must reacquire after a speed change");
static_assert(timelineBoundsAndRollover(), "Timeline must retain the latest 64 edges across millis rollover");
