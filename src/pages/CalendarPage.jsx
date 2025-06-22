import { useState, useEffect } from "react";
import { fetchSpaces } from "../utils/spaces";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../calendar-custom.css";
import { LoadingBuffer } from "../App";

// Helper: get all timezones (fallback to a static list if not supported)
const TIMEZONES =
  typeof Intl === "object" && Intl.supportedValuesOf
    ? Intl.supportedValuesOf("timeZone")
    : [
        "UTC",
        "America/New_York",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Paris",
        "Asia/Tokyo",
        "Asia/Singapore",
        "Australia/Sydney",
      ];

// Helper: safely parse Firestore Timestamp or ISO string or return null
function safeToDate(date) {
  if (!date) return null;
  if (typeof date === "object" && typeof date.seconds === "number") {
    return new Date(date.seconds * 1000);
  }
  if (typeof date === "string" && !isNaN(Date.parse(date))) {
    return new Date(date);
  }
  return null;
}

// Helper: get hour from Firestore Timestamp, ISO, or Date object, in a given timezone
function getHour(date, timeZone) {
  const d = safeToDate(date);
  if (!d) return null;
  // Convert to target timezone
  const options = { hour: "2-digit", hour12: false, timeZone };
  const hourStr = d.toLocaleTimeString([], options);
  return parseInt(hourStr, 10);
}

// Simple Modal
function Modal({ children, open, onClose }) {
  if (!open) return null;
  return (
    <div className="calendar-modal-overlay" onClick={onClose}>
      <div className="calendar-modal-content" onClick={e => e.stopPropagation()}>
        <button
          className="calendar-modal-close"
          onClick={onClose}
          aria-label="Close"
        >×</button>
        {children}
      </div>
    </div>
  );
}

// SPACE VISIBILITY LOGIC
function isSpaceVisibleOnCalendar(space) {
  return space.creatorStatus === "host" || (space.upvotes || 0) >= 25;
}

function CalendarPage() {
  const [spaces, setSpaces] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [languageFilter, setLanguageFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [hostFilter, setHostFilter] = useState("");

  // Timezone state
  const defaultTz = () => localStorage.getItem("calendarTimezone") || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [timezone, setTimezone] = useState(defaultTz());

  useEffect(() => {
    fetchSpaces().then(fetchedSpaces => {
      setSpaces(fetchedSpaces);
      setLoading(false);
    });
  }, []);

  // Persist timezone selection
  useEffect(() => {
    localStorage.setItem("calendarTimezone", timezone);
  }, [timezone]);

  // Get unique languages and categories from all spaces that are visible on calendar
  const allLanguages = [
    ...new Set(
      spaces
        .filter(isSpaceVisibleOnCalendar)
        .flatMap(s => (s.languages || "").split(",").map(l => l.trim()))
        .filter(Boolean)
    ),
  ];
  const allCategories = [
    ...new Set(
      spaces
        .filter(isSpaceVisibleOnCalendar)
        .flatMap(s => (s.categories || "").split(",").map(c => c.trim()))
        .filter(Boolean)
    ),
  ];

  // Filter logic
  function spaceMatchesFilters(space) {
    const langs = (space.languages || "").split(",").map(l => l.trim().toLowerCase());
    const cats = (space.categories || "").split(",").map(c => c.trim().toLowerCase());
    const host = (space.username || "").toLowerCase();
    return (
      (!languageFilter || langs.includes(languageFilter.toLowerCase())) &&
      (!categoryFilter || cats.includes(categoryFilter.toLowerCase())) &&
      (!hostFilter || host.includes(hostFilter.toLowerCase()))
    );
  }

  // Only show spaces that are visible on calendar for the selected date
  const spacesForSelectedDate = spaces
    .filter(isSpaceVisibleOnCalendar)
    .filter(space => {
      const spaceDate = safeToDate(space.date);
      if (!spaceDate) return false;
      // Convert spaceDate to selected timezone and compare date parts
      const dateStr = spaceDate.toLocaleDateString("en-CA", { timeZone: timezone });
      const selectedStr = selectedDate.toLocaleDateString("en-CA", { timeZone: timezone });
      return dateStr === selectedStr;
    });

  const hourlySchedule = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    spaces: spacesForSelectedDate.filter(space => getHour(space.date, timezone) === h)
  }));

  if (loading) return <LoadingBuffer />;

  return (
    <div className="calendar-bg animated-panel">
      <div className="calendar-main-container">
        {/* Left: Calendar and Filters */}
        <div className="calendar-left-panel">
          {/* Timezone Selector */}
          <div className="calendar-filter-card" style={{ marginBottom: 12 }}>
            <label htmlFor="timezone-select" style={{ fontFamily: '"Press Start 2P", monospace', color: '#0ff', fontSize: 13, marginRight: 8 }}>
              Timezone:
            </label>
            <select
              id="timezone-select"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              style={{ fontFamily: '"Press Start 2P", monospace', background: '#111', color: '#0ff', border: '1.5px solid #0ff', borderRadius: 4, padding: '2px 8px', fontSize: 13 }}
            >
              {TIMEZONES.map(tz => (
                <option value={tz} key={tz}>{tz}</option>
              ))}
            </select>
          </div>
          {/* Filters for days view only */}
          <div className="calendar-filter-card">
            <select
              value={languageFilter}
              onChange={e => setLanguageFilter(e.target.value)}
            >
              <option value="">All Languages</option>
              {allLanguages.map(l => (
                <option value={l} key={l}>{l[0].toUpperCase() + l.slice(1)}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {allCategories.map(c => (
                <option value={c} key={c}>{c[0].toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <input
              value={hostFilter}
              onChange={e => setHostFilter(e.target.value)}
              placeholder="Filter by Host"
              type="text"
            />
          </div>
          <div className="calendar-card">
            <h2 className="calendar-panel-title">Calendar</h2>
            <Calendar
              value={selectedDate}
              onChange={setSelectedDate}
              tileContent={({ date }) => {
                // Only show dots for spaces matching filters
                if (spaces.some(space => {
                  if (!isSpaceVisibleOnCalendar(space)) return false;
                  if (!spaceMatchesFilters(space)) return false;
                  const spaceDate = safeToDate(space.date);
                  if (!spaceDate) return false;
                  // Compare in selected timezone
                  const dateStr = spaceDate.toLocaleDateString("en-CA", { timeZone: timezone });
                  const tileStr = date.toLocaleDateString("en-CA", { timeZone: timezone });
                  return dateStr === tileStr;
                })) {
                  return <span className="calendar-dot"></span>;
                }
                return null;
              }}
              tileClassName={({ date }) => {
                // Glow if there are spaces matching filters for this day
                const hasFiltered = spaces.some(space => {
                  if (!isSpaceVisibleOnCalendar(space)) return false;
                  if (!spaceMatchesFilters(space)) return false;
                  const spaceDate = safeToDate(space.date);
                  if (!spaceDate) return false;
                  const dateStr = spaceDate.toLocaleDateString("en-CA", { timeZone: timezone });
                  const tileStr = date.toLocaleDateString("en-CA", { timeZone: timezone });
                  return dateStr === tileStr;
                });
                if (date.toDateString() === selectedDate.toDateString()) {
                  return hasFiltered ? "calendar-selected-tile react-calendar__tile--glow" : "calendar-selected-tile";
                }
                return hasFiltered ? "react-calendar__tile--glow" : null;
              }}
            />
          </div>
        </div>
        {/* Right: 24-hour Schedule (no filters) */}
        <div className="calendar-right-panel">
          <h2 className="calendar-panel-title">
            Spaces for {selectedDate.toLocaleDateString(undefined, { timeZone: timezone })}
          </h2>
          <div className="calendar-timeline">
            {hourlySchedule.map(({ hour, spaces }) => (
              <div key={hour} className="calendar-timeline-hour">
                <div className="calendar-hour-label">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                <div className="calendar-hour-events">
                  {spaces.length === 0 ? (
                    <span className="calendar-hour-empty">—</span>
                  ) : (
                    spaces.map(space => {
                      const startDate = safeToDate(space.date);
                      return (
                        <div
                          key={space.id}
                          className="calendar-event-card"
                          style={{ cursor: "pointer" }}
                          onClick={() => setSelectedSpace(space)}
                        >
                          <div className="calendar-event-title">
                            <span role="img" aria-label="mic">🎙️</span> {space.title}
                          </div>
                          <div className="calendar-event-meta">
                            by <b>{space.username}</b>
                            {startDate && (
                              <span>
                                {" "}
                                at{" "}
                                {startDate.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: timezone
                                })}
                              </span>
                            )}
                            {space.creatorStatus !== "host" && (space.upvotes || 0) >= 25 && (
                              <span style={{ marginLeft: 8, color: "#b28d00", fontWeight: "bold" }}>
                                (🌟 Popular)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Space details modal */}
      <Modal open={!!selectedSpace} onClose={() => setSelectedSpace(null)}>
        {selectedSpace && (() => {
          const startDate = safeToDate(selectedSpace.date);
          const endDate = safeToDate(selectedSpace.end);
          return (
            <div>
              <h2>{selectedSpace.title}</h2>
              <div style={{ marginBottom: 8 }}>
                <b>Host:</b> {selectedSpace.username}
                {selectedSpace.twitter && (
                  <span>
                    {" "}·{" "}
                    <a href={selectedSpace.twitter} target="_blank" rel="noopener noreferrer" style={{ color: "#1da1f2" }}>
                      Twitter Profile
                    </a>
                  </span>
                )}
              </div>
              <div style={{ marginBottom: 8 }}>
                <b>Date:</b> {startDate ? startDate.toLocaleDateString(undefined, { timeZone: timezone }) : "—"}
                <br />
                <b>Time:</b> {startDate ? startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: timezone }) : "—"}
                {endDate && <> - {endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: timezone })}</>}
              </div>
              <div style={{ marginBottom: 8 }}>
                <b>Categories:</b> {selectedSpace.categories || "—"}
                <br />
                <b>Languages:</b> {selectedSpace.languages || "—"}
              </div>
              <div style={{ marginBottom: 8 }}>
                <b>Brief Description:</b>
                <div
                  style={{
                    marginTop: 2,
                    whiteSpace: "pre-line",
                    color: "#fff",
                    fontStyle: selectedSpace.description ? "normal" : "italic"
                  }}
                >
                  {selectedSpace.description ? selectedSpace.description : "No description provided."}
                </div>
              </div>
              {selectedSpace.twitter_link && (
                <div>
                  <a
                    href={selectedSpace.twitter_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="calendar-event-link"
                    style={{ color: "#1da1f2", fontWeight: "bold", fontSize: 16 }}
                  >
                    Join Twitter Space
                  </a>
                </div>
              )}
              {selectedSpace.creatorStatus !== "host" && (selectedSpace.upvotes || 0) >= 25 && (
                <div style={{ color: "#b28d00", fontWeight: "bold", marginTop: 10 }}>
                  🌟 This space is featured because it reached 25+ upvotes!
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

export default CalendarPage;