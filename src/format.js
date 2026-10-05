export const duration = (h) => {
  const minutes = Math.round(h * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};
export const clock = (h) => {
  const minutes = Math.round(h * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
export const stamp = (s) => {
  const utcWallTime = Date.parse(`${s}Z`);
  return new Date(Math.round(utcWallTime / 60000) * 60000)
    .toISOString().slice(0, 16).replace("T", " ");
};
export const statusLabels = {
  off_duty: "Off duty",
  sleeper: "Sleeper berth",
  driving: "Driving",
  on_duty: "On duty (not driving)",
};
export const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
export function eventsCSV(events) {
  return [
    ["Start", "End", "Status", "Activity", "Location", "Miles"],
    ...events.map((e) => [
      e.start,
      e.end,
      statusLabels[e.status],
      e.reason,
      e.location,
      (e.mile_end - e.mile_start).toFixed(1),
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
