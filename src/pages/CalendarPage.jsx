import { useState, useEffect } from "react";
import { fetchSpaces } from "../utils/spaces";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../calendar-custom.css";

function getHour(date) {
  if (!date) return null;
  if (date.seconds) date = new Date(date.seconds * 1000);
  return date.getHours();
}

// Simple Modal
function Modal({ children, open, onClose }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", padding: "2em", borderRadius: 16, minWidth: 320, maxWidth: 420, boxShadow: "0 2px 16px 0 rgba(0,0,0,0.18)",
          position: "relative"
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 14, right: 20, border: 0, background: "none", fontSize: 20, cursor: "pointer", color: "#888"
          }}
          aria-label="Close"
        >×</button>
        {children}
      </div>
    </div>
  );
}

function CalendarPage() {
  const [spaces, setSpaces] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSpace, setSelectedSpace] = useState(null);

  useEffect(() => {
    fetchSpaces().then(setSpaces);
  }, []);

  const spacesForSelectedDate = spaces.filter(space => {
    const spaceDate = new Date(space.date.seconds * 1000);
    return (
      spaceDate.getFullYear() === selectedDate.getFullYear() &&
      spaceDate.getMonth() === selectedDate.getMonth() &&
      spaceDate.getDate() === selectedDate.getDate()
    );
  });

  const hourlySchedule = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    spaces: spacesForSelectedDate.filter(space => getHour(space.date) === h)
  }));

  return (
    <div className="calendar-bg">
      <div className="calendar-main-container">
        {/* Left: Calendar only */}
        <div className="calendar-left-panel">
          <div className="calendar-card">
            <h2 className="calendar-panel-title">Calendar</h2>
            <Calendar
              value={selectedDate}
              onChange={setSelectedDate}
              tileContent={({ date }) => {
                if (spaces.some(space => {
                  const spaceDate = new Date(space.date.seconds * 1000);
                  return (
                    spaceDate.getFullYear() === date.getFullYear() &&
                    spaceDate.getMonth() === date.getMonth() &&
                    spaceDate.getDate() === date.getDate()
                  );
                })) {
                  return <span className="calendar-dot"></span>;
                }
                return null;
              }}
              tileClassName={({ date }) => {
                if (
                  date.toDateString() === selectedDate.toDateString()
                ) {
                  return "calendar-selected-tile";
                }
                return null;
              }}
            />
          </div>
        </div>
        {/* Right: 24-hour Schedule */}
        <div className="calendar-right-panel">
          <h2 className="calendar-panel-title">
            Spaces for {selectedDate.toLocaleDateString()}
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
                    spaces.map(space => (
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
                          {space.date.seconds && (
                            <span>
                              {" "}
                              at{" "}
                              {new Date(space.date.seconds * 1000).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Space details modal */}
      <Modal open={!!selectedSpace} onClose={() => setSelectedSpace(null)}>
        {selectedSpace && (
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
              <b>Date:</b> {new Date(selectedSpace.date.seconds * 1000).toLocaleDateString()}
              <br />
              <b>Time:</b> {new Date(selectedSpace.date.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {selectedSpace.end && selectedSpace.end.seconds ? new Date(selectedSpace.end.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </div>
            <div style={{ marginBottom: 8 }}>
              <b>Category:</b> {selectedSpace.category}
              <br />
              <b>Language:</b> {selectedSpace.language}
            </div>
            {/* Show description no matter if empty or not */}
            <div style={{ marginBottom: 8 }}>
              <b>Brief Description:</b>
              <div style={{ marginTop: 2, whiteSpace: "pre-line", color: selectedSpace.description ? "#222" : "#bbb", fontStyle: selectedSpace.description ? "normal" : "italic" }}>
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
          </div>
        )}
      </Modal>
    </div>
  );
}

export default CalendarPage;