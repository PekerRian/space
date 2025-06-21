import { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { addSpace, fetchSpacesByUser, deleteSpace } from "../utils/spaces";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../calendar-custom.css";

const categories = ["gaming", "defi", "nft", "community", "others"];
const languages = ["english", "tagalog", "malay", "hausa", "pidgin", "mandarin", "spanish"];

function generateTimeOptions() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      );
    }
  }
  return options;
}

const timeOptions = generateTimeOptions();

export default function UserTab() {
  const { account } = useWallet();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [form, setForm] = useState({
    title: "",
    description: "",
    start: "12:00",
    end: "12:30",
    category: categories[0],
    language: languages[0],
    twitter_link: "",
  });
  const [success, setSuccess] = useState("");
  const [err, setErr] = useState("");
  const [spaces, setSpaces] = useState([]);
  const [user, setUser] = useState(null);

  // Fetch user info from backend using wallet address
  useEffect(() => {
    if (account?.address) {
      fetch(`/api/user/${account.address}`)
        .then(res => res.ok ? res.json() : null)
        .then(user => setUser(user));
    } else {
      setUser(null);
    }
  }, [account]);

  // Fetch user's spaces
  useEffect(() => {
    if (user?.address) {
      fetchSpacesByUser(user.address).then(setSpaces);
    } else {
      setSpaces([]);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // For description, enforce max 300 chars in UI
    if (name === "description" && value.length > 300) {
      return;
    }
    setForm({ ...form, [name]: value });
    setSuccess(""); setErr("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(""); setErr("");
    if (!user) {
      setErr("You must connect your wallet.");
      return;
    }
    if (form.description.length > 300) {
      setErr("Description must be 300 characters or less.");
      return;
    }
    const [startHour, startMin] = form.start.split(":").map(Number);
    const [endHour, endMin] = form.end.split(":").map(Number);
    const startDate = new Date(selectedDate);
    startDate.setHours(startHour, startMin, 0, 0);
    const endDate = new Date(selectedDate);
    endDate.setHours(endHour, endMin, 0, 0);

    if (endDate <= startDate) {
      setErr("End time must be after start time.");
      return;
    }

    try {
      await addSpace({
        username: user.username || user.address,
        twitter: user.twitter || "",
        title: form.title,
        description: form.description,
        date: startDate.toISOString(),
        end: endDate.toISOString(),
        category: form.category,
        language: form.language,
        twitter_link: form.twitter_link || "",
      });
      setForm({
        title: "",
        description: "",
        start: "12:00",
        end: "12:30",
        category: categories[0],
        language: languages[0],
        twitter_link: "",
      });
      setSuccess("Space scheduled!");
      // Refresh user's spaces
      fetchSpacesByUser(user.address).then(setSpaces);
    } catch (error) {
      setErr(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this space?")) {
      await deleteSpace(id);
      setSpaces(spaces => spaces.filter(s => s.id !== id));
    }
  };

  return (
    <div className="calendar-bg" style={{ minHeight: "100vh" }}>
      <div className="calendar-main-container">
        <div className="calendar-left-panel">
          <div className="calendar-card">
            <h2 className="calendar-panel-title">Pick a Date</h2>
            <Calendar
              value={selectedDate}
              onChange={setSelectedDate}
              tileClassName={({ date }) =>
                date.toDateString() === selectedDate.toDateString()
                  ? "calendar-selected-tile"
                  : null
              }
            />
          </div>
        </div>
        <div className="calendar-right-panel" style={{ maxWidth: 480 }}>
          <h2 className="calendar-panel-title">Schedule a Space</h2>
          {user ? (
            <form onSubmit={handleSubmit} className="calendar-form-card">
              <label className="calendar-label">
                Title
                <input
                  name="title"
                  className="calendar-input"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Space Title"
                  required
                />
              </label>
              <label className="calendar-label">
                Brief Description (max 300 characters)
                <textarea
                  name="description"
                  className="calendar-input"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe your space"
                  rows={3}
                  style={{ resize: "vertical" }}
                  maxLength={300}
                  required
                />
                <div style={{ fontSize: 12, color: form.description.length > 300 ? "red" : "#666", textAlign: "right" }}>
                  {form.description.length}/300
                </div>
              </label>
              <div style={{ display: "flex", gap: "1em", marginBottom: "1em" }}>
                <label className="calendar-label" style={{ flex: 1 }}>
                  Start
                  <select
                    name="start"
                    className="calendar-input"
                    value={form.start}
                    onChange={handleChange}
                  >
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="calendar-label" style={{ flex: 1 }}>
                  End
                  <select
                    name="end"
                    className="calendar-input"
                    value={form.end}
                    onChange={handleChange}
                  >
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="calendar-label">
                Category
                <select
                  name="category"
                  className="calendar-input"
                  value={form.category}
                  onChange={handleChange}
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label className="calendar-label">
                Language
                <select
                  name="language"
                  className="calendar-input"
                  value={form.language}
                  onChange={handleChange}
                >
                  {languages.map(l => (
                    <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label className="calendar-label">
                Twitter Space Link (optional)
                <input
                  name="twitter_link"
                  className="calendar-input"
                  value={form.twitter_link}
                  onChange={handleChange}
                  placeholder="https://twitter.com/i/spaces/..."
                  type="url"
                />
              </label>
              <button type="submit" className="calendar-btn">Schedule</button>
              {err && <p className="calendar-error">{err}</p>}
              {success && <p className="calendar-success">{success}</p>}
            </form>
          ) : (
            <p className="calendar-error">Please connect your wallet to schedule a space.</p>
          )}

          {/* User's scheduled spaces */}
          <h2 className="calendar-panel-title" style={{ marginTop: 32 }}>Your Scheduled Spaces</h2>
          {spaces.length === 0 && (
            <div style={{ color: "#888", fontStyle: "italic" }}>You haven't scheduled any spaces yet.</div>
          )}
          {spaces.map(space => (
            <div
              key={space.id}
              className="calendar-event-card"
              style={{ marginBottom: 18, position: "relative", background: "#f6f8fa" }}
            >
              <div className="calendar-event-title">
                <span role="img" aria-label="mic">🎙️</span> {space.title}
              </div>
              <div className="calendar-event-meta">
                {space.date?.seconds && (
                  <span>
                    {new Date(space.date.seconds * 1000).toLocaleDateString()} &mdash;{" "}
                    {new Date(space.date.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <div style={{ color: "#666", margin: "6px 0 10px 0", fontSize: 15 }}>
                {space.description}
              </div>
              <button
                onClick={() => handleDelete(space.id)}
                style={{
                  position: "absolute", top: 6, right: 8,
                  background: "#e15d5d", color: "#fff", border: 0,
                  borderRadius: 8, padding: "2px 10px", fontSize: 14, cursor: "pointer"
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}