import { test } from "node:test";
import assert from "node:assert/strict";
import { duration, clock, stamp, eventsCSV } from "./format.js";
test("rounded minutes carry into hours", () => {
  assert.equal(duration(1.9999), "2h 00m");
  assert.equal(clock(23.9999), "24:00");
});
test("schedule stamps round consistently with log clocks", () => {
  assert.equal(stamp("2026-10-05T11:51:44.123456"), "2026-10-05 11:52");
  assert.equal(stamp("2026-10-05T23:59:59"), "2026-10-06 00:00");
});
test("CSV escapes remarks and locations", () => {
  assert.match(
    eventsCSV([
      {
        start: "a",
        end: "b",
        status: "driving",
        reason: 'Go "west"',
        location: "City, ST",
        mile_start: 0,
        mile_end: 1,
      },
    ]),
    /"Go ""west""","City, ST"/,
  );
});
