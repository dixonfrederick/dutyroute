import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { duration, clock, stamp, statusLabels, eventsCSV } from "./format.js";

const example = [
  { label: "Chicago, Illinois", lat: 41.8781, lon: -87.6298 },
  { label: "Indianapolis, Indiana", lat: 39.7684, lon: -86.1581 },
  { label: "Dallas, Texas", lat: 32.7767, lon: -96.797 },
];
const resultTabs = [
  ["schedule", "Stops & schedule"],
  ["logs", "Daily log sheets"],
  ["directions", "Route instructions"],
];
async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({
    error: "The server returned an unexpected response. Please try again.",
  }));
  if (!response.ok)
    throw new Error(data.error || "Unable to complete this request.");
  return data;
}
function LocationField({ label, index, value, onChange, disabled }) {
  const [query, setQuery] = useState(value?.label || "");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (value) setQuery(value.label);
    setResults([]);
    setError("");
  }, [value]);
  async function find() {
    setBusy(true);
    setError("");
    setResults([]);
    try {
      const data = await api(`/api/locations?q=${encodeURIComponent(query)}`);
      setResults(data.locations);
      if (!data.locations.length)
        setError("No matches. Try a city and state or a complete address.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="location-field">
      <label htmlFor={`location-${index}`}>
        <span className="waypoint">{index + 1}</span>
        {label}
      </label>
      <div className="search-row">
        <input
          id={`location-${index}`}
          value={query}
          placeholder="City, state or street address"
          disabled={disabled || busy}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(null);
            setResults([]);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              find();
            }
          }}
        />
        <button
          type="button"
          className="search-button"
          disabled={disabled || busy || query.trim().length < 3}
          onClick={find}
          aria-label={`Search ${label.toLowerCase()}`}
        >
          {busy ? "…" : "Find"}
        </button>
      </div>
      {value && <small className="selected">Location selected</small>}
      {error && (
        <small role="alert" className="field-error">
          {error}
        </small>
      )}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((p, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onChange(p);
                  setResults([]);
                }}
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function FitMap({ plan, active }) {
  const map = useMap();
  useEffect(() => {
    if (plan)
      map.fitBounds(
        plan.route.geometry.map((p) => [p[1], p[0]]),
        { padding: [40, 40] },
      );
  }, [plan, map]);
  useEffect(() => {
    if (active) map.setView([active.coordinates[1], active.coordinates[0]], 9);
  }, [active, map]);
  return null;
}
function MapPoint({ label, children, ...props }) {
  const markerRef = useRef(null);
  useEffect(() => {
    const marker = markerRef.current;
    const element = marker.getElement();
    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "button");
    element.setAttribute("aria-label", label);
    function onKeyDown(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        marker.togglePopup();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        marker.closePopup();
      }
    }
    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  }, [label]);
  return (
    <CircleMarker ref={markerRef} {...props}>
      {children}
    </CircleMarker>
  );
}
function RouteMap({ plan, active }) {
  return (
    <MapContainer
      center={[38.8, -96]}
      zoom={4}
      className="map"
      aria-label="Trip route map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://www.openstreetmap.org/">Fix the map</a>'
        url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
      />
      <FitMap plan={plan} active={active} />
      {plan && (
        <>
          <Polyline
            interactive={false}
            positions={plan.route.geometry.map((p) => [p[1], p[0]])}
            pathOptions={{ color: "#185d60", weight: 5 }}
          />
          {plan.locations.map((p, i) => (
            <MapPoint
              key={`point-${i}`}
              label={`${["Start", "Pickup", "Delivery"][i]}: ${p.label}`}
              center={[p.lat, p.lon]}
              radius={9}
              pathOptions={{
                color: "#123f40",
                fillColor: "#fff",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>
                <b>{["Start", "Pickup", "Delivery"][i]}</b>
                <br />
                {p.label}
              </Popup>
            </MapPoint>
          ))}
          {plan.events
            .filter(
              (e) =>
                e.status !== "driving" &&
                e.reason !== "Pre-trip inspection" &&
                e.reason !== "Pickup" &&
                e.reason !== "Delivery",
            )
            .map((e, i) => (
              <MapPoint
                key={i}
                label={`${e.reason}: ${e.location}, ${stamp(e.start)}`}
                center={[e.coordinates[1], e.coordinates[0]]}
                radius={6}
                pathOptions={{
                  color: "#8e4517",
                  fillColor: "#d87826",
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Popup>
                  <b>{e.reason}</b>
                  <br />
                  {e.location}
                  <br />
                  {stamp(e.start)} · {duration(e.hours)}
                </Popup>
              </MapPoint>
            ))}
        </>
      )}
    </MapContainer>
  );
}
function DutyGrid({ day }) {
  const order = ["off_duty", "sleeper", "driving", "on_duty"];
  const left = 150,
    width = 720;
  const y = (s) => 45 + order.indexOf(s) * 34;
  const x = (h) => left + (h / 24) * width;
  let d = "";
  day.segments.forEach((s, i) => {
    d +=
      (i ? " L " : "M ") +
      x(s.start_hour) +
      " " +
      y(s.status) +
      " L " +
      x(s.end_hour) +
      " " +
      y(s.status);
  });
  return (
    <svg
      className="duty-grid"
      viewBox="0 0 955 190"
      role="img"
      aria-label={`Four-status duty log for ${day.date}. Driving ${duration(day.totals.driving)}, on duty ${duration(day.totals.on_duty)}.`}
    >
      <text x="910" y="17" textAnchor="middle" fontSize="11">
        Hours
      </text>
      {Array.from({ length: 25 }, (_, h) => (
        <g key={h}>
          <text x={x(h)} y="18" textAnchor="middle" fontSize="10">
            {h === 0 || h === 24
              ? "Mid"
              : h === 12
                ? "Noon"
                : h > 12
                  ? h - 12
                  : h}
          </text>
          <line
            x1={x(h)}
            y1="28"
            x2={x(h)}
            y2="164"
            stroke="#8a9291"
            strokeWidth=".8"
          />
        </g>
      ))}
      {Array.from({ length: 96 }, (_, q) => (
        <line
          key={q}
          x1={x(q / 4)}
          y1="28"
          x2={x(q / 4)}
          y2="164"
          stroke="#d9dddd"
          strokeWidth=".5"
        />
      ))}
      {order.map((s, i) => (
        <g key={s}>
          <text x="2" y={y(s) + 4} fontSize="12">
            {i + 1}. {statusLabels[s]}
          </text>
          <line
            x1={left}
            y1={y(s) - 17}
            x2={left + width}
            y2={y(s) - 17}
            stroke="#8a9291"
          />
          <text x="910" y={y(s) + 4} textAnchor="middle" fontSize="12">
            {duration(day.totals[s])}
          </text>
        </g>
      ))}
      <line x1={left} y1="164" x2={left + width} y2="164" stroke="#8a9291" />
      <path
        d={d}
        fill="none"
        stroke="#123f40"
        strokeWidth="3"
        strokeLinejoin="miter"
      />
      <text x="910" y="185" textAnchor="middle" fontWeight="bold" fontSize="12">
        24h 00m
      </text>
    </svg>
  );
}
function LogSheet({ day, plan, meta }) {
  return (
    <article className="log-sheet">
      <div className="log-heading">
        <div>
          <span className="log-caption">24-hour record of duty status</span>
          <h3>Driver’s daily log</h3>
        </div>
        <div>
          <b>{day.date}</b>
          <br />
          <small>{meta.terminalZone || "Home-terminal time"}</small>
        </div>
      </div>
      <div className="log-meta">
        <span>
          Driver <b>{meta.driver || "Not supplied"}</b>
        </span>
        <span>
          Carrier <b>{meta.carrier || "Not supplied"}</b>
        </span>
        <span>
          Truck / trailer <b>{meta.vehicle || "Not supplied"}</b>
        </span>
        <span>
          From <b>{plan.locations[0].label}</b>
        </span>
        <span>
          To <b>{plan.locations[2].label}</b>
        </span>
        <span>
          Miles today <b>{day.miles.toLocaleString()}</b>
        </span>
        <span>
          Main office <b>{meta.office || "Not supplied"}</b>
        </span>
        <span>
          Home terminal <b>{meta.terminal || "Not supplied"}</b>
        </span>
        <span>
          Shipping document <b>{meta.shipping || "Not supplied"}</b>
        </span>
        <span>
          Shipper / commodity <b>{meta.commodity || "Not supplied"}</b>
        </span>
        <span>
          Co-driver <b>None (solo driver)</b>
        </span>
        <span>
          Signature <b>Unsigned planning record</b>
        </span>
      </div>
      <div
        className="grid-scroll"
        tabIndex="0"
        aria-label="Daily duty grid; scroll horizontally on small screens"
      >
        <DutyGrid day={day} />
      </div>
      <h4>Remarks</h4>
      <table className="remarks">
        <thead>
          <tr>
            <th>Home-terminal time</th>
            <th>Duty status / activity</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {day.segments.map((s, i) => (
            <tr key={i}>
              <td>
                {clock(s.start_hour)}–{clock(s.end_hour)}
              </td>
              <td>
                {statusLabels[s.status]} · {s.reason}
              </td>
              <td>{s.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="log-foot">
        <span>
          On-duty total:{" "}
          <b>{duration(day.totals.driving + day.totals.on_duty)}</b>
        </span>
        <span>Total mileage = driving mileage (solo driver)</span>
      </div>
      <div className="cycle-recap">
        <b>70-hour / 8-day recap</b>
        <span>Cycle used at day end: {duration(day.cycle_used_end)}</span>
        <span>Available cycle: {duration(day.cycle_available_end)}</span>
        <small>
          Conservative calculation; prior daily history is not supplied.
        </small>
      </div>
      <p className="log-note">
        Planned log, not a certified ELD record. Verify actual times, locations
        and driver details before use.
      </p>
    </article>
  );
}
function download(name, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [points, setPoints] = useState([null, null, null]);
  const [cycle, setCycle] = useState("0");
  const [start, setStart] = useState(
    () => `${new Date().toLocaleDateString("en-CA")}T08:00`,
  );
  const [meta, setMeta] = useState({});
  const [plan, setPlan] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [view, setView] = useState("schedule"),
    [day, setDay] = useState(0),
    [active, setActive] = useState(null);
  const [dirty, setDirty] = useState(false);
  const tabRefs = useRef({});
  function navigateTabs(e, index) {
    let next;
    if (e.key === "ArrowRight") next = (index + 1) % resultTabs.length;
    else if (e.key === "ArrowLeft")
      next = (index + resultTabs.length - 1) % resultTabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = resultTabs.length - 1;
    else return;
    e.preventDefault();
    const key = resultTabs[next][0];
    setView(key);
    tabRefs.current[key].focus();
  }
  function changePoints(i, p) {
    setPoints((prev) => prev.map((v, j) => (j === i ? p : v)));
    setDirty(true);
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (points.some((p) => !p)) {
      setError("Find and select a result for all three locations.");
      return;
    }
    setBusy(true);
    try {
      const data = await api("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current: points[0],
          pickup: points[1],
          dropoff: points[2],
          cycle_used: Number(cycle),
          start,
        }),
      });
      setPlan(data);
      setDay(0);
      setActive(null);
      setDirty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="app-header">
        <span className="wordmark">
          Duty<span>Route</span>
        </span>
        <span className="header-detail">Trip & duty planner</span>
        <span className="header-rule">
          Property carrier · 70 hours / 8 days
        </span>
      </header>
      <main>
        <div className="workspace-title">
          <h1>Trip planner</h1>
        </div>
        <div className="workspace">
          <aside className="trip-panel">
            <div className="panel-heading">
              <h2>Trip details</h2>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setPoints(example);
                  setCycle("0");
                  setDirty(true);
                  setError("");
                }}
              >
                Load example
              </button>
            </div>
            <form onSubmit={submit}>
              {["Current location", "Pickup location", "Drop-off location"].map(
                (l, i) => (
                  <LocationField
                    key={i}
                    label={l}
                    index={i}
                    value={points[i]}
                    onChange={(p) => changePoints(i, p)}
                    disabled={busy}
                  />
                ),
              )}
              <div className="cycle-field">
                <label htmlFor="cycle">
                  Current cycle used <span>hours</span>
                </label>
                <input
                  id="cycle"
                  type="number"
                  min="0"
                  max="70"
                  step=".01"
                  value={cycle}
                  disabled={busy}
                  required
                  onChange={(e) => {
                    setCycle(e.target.value);
                    setDirty(true);
                  }}
                />
                <div className="cycle-track">
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, (Number(cycle) / 70) * 100))}%`,
                    }}
                  />
                </div>
                <small>
                  {duration(Math.max(0, 70 - Number(cycle)))} available in the
                  current cycle
                </small>
              </div>
              <label htmlFor="start">Departure</label>
              <input
                id="start"
                type="datetime-local"
                required
                min="2000-01-01T00:00"
                max="2099-12-31T23:59"
                value={start}
                disabled={busy}
                onChange={(e) => {
                  setStart(e.target.value);
                  setDirty(true);
                }}
              />
              <small>Use your home-terminal time zone throughout.</small>
              <button className="plan-button" disabled={busy}>
                {busy ? "Planning your trip…" : "Calculate trip & logs"}
              </button>
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
            </form>
            <details className="assumptions">
              <summary>Planning assumptions</summary>
              <ul>
                <li>
                  Start after 10 consecutive hours off duty, with fresh daily
                  driving and duty clocks.
                </li>
                <li>
                  11 hours driving within a 14-hour window; 30 minutes off
                  driving after 8 cumulative driving hours.
                </li>
                <li>
                  Full fuel tank at departure; 30-minute fuel stops every 1,000
                  miles. Pickup and delivery take 1 hour each; pre-trip takes 15
                  minutes.
                </li>
                <li>
                  Road travel time or 55 mph average, whichever is slower. No
                  traffic, adverse-condition exception or split sleeper.
                </li>
                <li>
                  Past daily duty history is unknown: take a conservative
                  34-hour restart instead of assuming cycle hours roll off.
                </li>
                <li>
                  Routes use a standard road profile, without truck height,
                  weight or hazmat restrictions. Stop pins are estimated route
                  positions, not verified parking or fuel facilities.
                </li>
              </ul>
              <a
                href="https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"
                target="_blank"
                rel="noreferrer"
              >
                FMCSA hours-of-service reference
              </a>
            </details>
            <details className="driver-details">
              <summary>
                Driver & carrier details <span>optional</span>
              </summary>
              {[
                ["driver", "Driver name"],
                ["carrier", "Carrier name"],
                ["vehicle", "Truck / trailer number"],
                ["office", "Main office address"],
                ["terminal", "Home terminal address"],
                ["terminalZone", "Home-terminal time zone"],
                ["shipping", "Shipping document / load number"],
                ["commodity", "Shipper & commodity"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={meta[key] || ""}
                    maxLength="120"
                    onChange={(e) =>
                      setMeta({ ...meta, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </details>
          </aside>
          <section className="route-panel" aria-label="Route overview">
            <div className="panel-heading">
              <h2>Route overview</h2>
              <span className="map-key">
                <i />
                Driving route <i className="amber" />
                Rest / fuel
              </span>
            </div>
            <RouteMap plan={plan} active={active} />
            {!plan ? (
              <div className="empty-state">
                <h3>No trip calculated</h3>
                <p>
                  Find and select your current location, pickup and drop-off,
                  then calculate the trip. Or load the Chicago to Dallas
                  example.
                </p>
              </div>
            ) : (
              <>
                <div className="trip-summary">
                  <div>
                    <span>Route distance</span>
                    <b>
                      {plan.miles.toLocaleString()} <small>mi</small>
                    </b>
                  </div>
                  <div>
                    <span>Driving time</span>
                    <b>{duration(plan.driving_hours)}</b>
                  </div>
                  <div>
                    <span>Total trip time</span>
                    <b>{duration(plan.elapsed_hours)}</b>
                  </div>
                  <div>
                    <span>Log sheets</span>
                    <b>
                      {plan.days.length} <small>days</small>
                    </b>
                  </div>
                </div>
                <div className="arrival">
                  <span>Delivery complete</span>
                  <b>{stamp(plan.arrival)}</b>
                  <span>
                    Cycle at finish: {duration(plan.cycle_at_finish)} / 70h
                  </span>
                </div>
              </>
            )}
            {busy && (
              <div className="loading-strip" role="status">
                Finding the road route and scheduling driving, work and rest…
              </div>
            )}
            {plan && dirty && (
              <div className="stale-note" role="status">
                Trip details changed. Calculate again to update the results
                below.
              </div>
            )}
            <p className="map-note">
              OpenStreetMap / OSRM road routing · stop locations are approximate
              · all times use the home terminal’s clock
            </p>
          </section>
        </div>
        {plan && (
          <section className="results">
            <div className="results-heading">
              <h2>Trip results</h2>
              <div className="export-buttons">
                <button
                  onClick={() =>
                    download(
                      "dutyroute-trip.csv",
                      eventsCSV(plan.events),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  Export CSV
                </button>
                <button
                  onClick={() =>
                    download(
                      "dutyroute-trip.json",
                      JSON.stringify({ ...plan, driver: meta }, null, 2),
                      "application/json",
                    )
                  }
                >
                  Export JSON
                </button>
                <button className="print-button" onClick={() => window.print()}>
                  Print all logs / PDF
                </button>
              </div>
            </div>
            <div className="tabs" role="tablist" aria-label="Trip results">
              {resultTabs.map(([key, text], index) => (
                <button
                  id={`tab-${key}`}
                  key={key}
                  ref={(element) => {
                    tabRefs.current[key] = element;
                  }}
                  role="tab"
                  aria-selected={view === key}
                  aria-controls={`panel-${key}`}
                  tabIndex={view === key ? 0 : -1}
                  onKeyDown={(e) => navigateTabs(e, index)}
                  onClick={() => setView(key)}
                >
                  {text}
                  {key === "logs" && <span>{plan.days.length}</span>}
                </button>
              ))}
            </div>
            {view === "schedule" && (
              <div
                role="tabpanel"
                id="panel-schedule"
                aria-labelledby="tab-schedule"
                tabIndex="0"
              >
                <p className="schedule-help" id="schedule-help">
                  Select a stop to show its location on the map.
                </p>
                <div className="schedule">
                  <div className="schedule-head">
                    <span>Time / duration</span>
                    <span>Activity</span>
                    <span>Location</span>
                  </div>
                  {plan.events.map((e, i) => (
                    <button
                      key={i}
                      className={`event-row ${e.status} ${active === e ? "active" : ""}`}
                      aria-describedby="schedule-help"
                      onClick={() => {
                        setActive(e);
                        document.querySelector(".route-panel").scrollIntoView({
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "instant"
                            : "smooth",
                          block: "center",
                        });
                      }}
                    >
                      <div>
                        <b>{stamp(e.start)}</b>
                        <small>{duration(e.hours)}</small>
                      </div>
                      <div>
                        <span className="event-dot" />
                        <b>{e.reason}</b>
                        <small>
                          {statusLabels[e.status]}
                          {e.status === "driving" &&
                            ` · ${(e.mile_end - e.mile_start).toFixed(1)} mi`}
                        </small>
                      </div>
                      <div>{e.location}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {view === "directions" && (
              <div
                className="directions"
                role="tabpanel"
                id="panel-directions"
                aria-labelledby="tab-directions"
                tabIndex="0"
              >
                <p>
                  Standard road directions. Check truck restrictions before
                  departure.
                </p>
                {plan.route.legs.map((leg, i) => (
                  <details key={i} open>
                    <summary>
                      {i === 0
                        ? "Current location to pickup"
                        : "Pickup to delivery"}{" "}
                      · {leg.miles.toFixed(1)} miles
                    </summary>
                    <ol>
                      {leg.steps.map((s, j) => (
                        <li key={j}>
                          <span>
                            {s.maneuver === "depart"
                              ? "Depart"
                              : s.maneuver === "arrive"
                                ? "Arrive"
                                : s.maneuver === "roundabout"
                                  ? `Take roundabout exit ${s.exit || ""}`
                                  : `${s.maneuver} ${s.modifier}`}{" "}
                            {s.maneuver !== "arrive" && `on ${s.name}`}
                          </span>
                          <b>{s.miles.toFixed(1)} mi</b>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            )}
            {view === "logs" && (
              <div
                className="logs-view"
                role="tabpanel"
                id="panel-logs"
                aria-labelledby="tab-logs"
                tabIndex="0"
              >
                <div className="day-selector">
                  <label htmlFor="day">Log date</label>
                  <select
                    id="day"
                    value={day}
                    onChange={(e) => setDay(Number(e.target.value))}
                  >
                    {plan.days.map((d, i) => (
                      <option value={i} key={i}>
                        {d.date} · Day {i + 1}
                      </option>
                    ))}
                  </select>
                  <span>
                    {day + 1} of {plan.days.length} sheets
                  </span>
                </div>
                <LogSheet day={plan.days[day]} plan={plan} meta={meta} />
              </div>
            )}
          </section>
        )}
        <footer>
          DutyRoute <span>Planning estimates, not a certified ELD.</span>
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
            Nearby place names: GeoNames (CC BY 4.0)
          </a>
        </footer>
      </main>
      {plan && (
        <div className="print-logs">
          {plan.days.map((d) => (
            <LogSheet key={d.date} day={d} plan={plan} meta={meta} />
          ))}
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
