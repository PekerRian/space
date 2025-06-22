import { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { fetchSpacesByUser, deleteSpace } from "../utils/spaces";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../calendar-custom.css";
import { LoadingBuffer } from "../App";

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

function PopupModal({ open, onClose, message }) {
  if (!open) return null;
  return (
    <div className="calendar-modal-overlay" style={{ zIndex: 1000 }} onClick={onClose}>
      <div
        className="calendar-modal-content"
        style={{
          maxWidth: 400,
          margin: "0 auto",
          padding: 20,
          boxSizing: "border-box",
          width: "100%",
          minHeight: "auto",
          textAlign: "center",
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="calendar-modal-close"
          style={{
            position: "absolute",
            top: 14,
            right: 20,
            border: 0,
            background: "none",
            fontSize: 20,
            cursor: "pointer",
            color: "#ffe066",
            fontFamily: '"Press Start 2P", monospace',
            textShadow: '0 0 6px #ffe066, 0 0 2px #fff',
          }}
          aria-label="Close"
        >×</button>
        <div style={{ fontWeight: 600, fontSize: 18, color: '#ffe066', fontFamily: '"Press Start 2P", monospace', marginBottom: 12 }}>{message}</div>
      </div>
      <style>{`
        .calendar-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .calendar-modal-content {
          background: #181a2b;
          border: 3px solid #ffe066;
          border-radius: 18px;
          box-shadow: 0 0 24px #ffe06699, 0 0 2px #fff;
          padding: 2.5em 1.5em 2em 1.5em;
          color: #fff;
          font-family: 'Press Start 2P', monospace;
          position: relative;
          animation: panelFadeInUp 0.5s cubic-bezier(.23,1.01,.32,1) both;
        }
        .calendar-modal-close {
          position: absolute;
          top: 14px;
          right: 20px;
          background: none;
          border: none;
          color: #ffe066;
          font-size: 1.4em;
          cursor: pointer;
        }
        @media (max-width: 600px) {
          .calendar-modal-content {
            max-width: 98vw !important;
            padding: 10vw 2vw 2vw 2vw !important;
            min-height: auto !important;
          }
          .calendar-modal-close {
            top: 8px;
            right: 12px;
            font-size: 1.4em;
          }
        }
      `}</style>
    </div>
  );
}

export default function UserTab() {
  const { account } = useWallet();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [form, setForm] = useState({
    title: "",
    description: "",
    start: "12:00",
    end: "12:30",
    categories: [],
    languages: [],
    twitter_link: "",
  });
  const [success, setSuccess] = useState("");
  const [err, setErr] = useState("");
  const [spaces, setSpaces] = useState([]);
  const [user, setUser] = useState(null);
  const [calendarPopup, setCalendarPopup] = useState(""); // Modal message
  const [loading, setLoading] = useState(false); // Loading state

  // Helper to reliably get the wallet address as a string
  const getAddressString = (acct) => {
    if (!acct?.address) return "";
    if (typeof acct.address === "string") return acct.address;
    if (typeof acct.address.toString === "function") return acct.address.toString();
    return String(acct.address);
  };

  // Fetch user info directly from Firestore using wallet address and update status if needed
  useEffect(() => {
    const address = getAddressString(account);
    if (address) {
      const fetchUser = async () => {
        try {
          setLoading(true);
          const snap = await getDoc(doc(db, "user accounts", address));
          if (snap.exists()) {
            const userData = { address, ...snap.data() };
            // Check and update status if needed
            const correctStatus = (userData.votes || 0) > 200 ? "host" : "participant";
            if (userData.status !== correctStatus) {
              await updateDoc(doc(db, "user accounts", address), {
                status: correctStatus,
              });
              userData.status = correctStatus; // update locally too
            }
            setUser(userData);
          } else {
            setUser(null);
          }
        } catch (error) {
          setUser(null);
        } finally {
          setLoading(false);
        }
      };
      fetchUser();
    } else {
      setUser(null);
    }
  }, [account]);

  // Fetch user's spaces (only those created by the user, using username)
  useEffect(() => {
    if (user?.username) {
      fetchSpacesByUser(user.username).then(setSpaces);
    } else {
      setSpaces([]);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "description" && value.length > 300) return;
    setForm(f => ({ ...f, [name]: value }));
    setSuccess("");
    setErr("");
  };

  // Checkbox logic for multi-select
  const handleCheckboxChange = (name, val) => {
    setForm(f => {
      const arr = f[name];
      const checked = arr.includes(val);
      return {
        ...f,
        [name]: checked ? arr.filter(x => x !== val) : [...arr, val]
      };
    });
    setSuccess("");
    setErr("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess("");
    setErr("");
    setCalendarPopup(""); // reset popup on new attempt
    if (!user) {
      setErr("You must connect your wallet.");
      return;
    }
    if (form.description.length > 300) {
      setErr("Description must be 300 characters or less.");
      return;
    }
    if (form.languages.length === 0) {
      setErr("Please select at least one language.");
      return;
    }
    if (form.categories.length === 0) {
      setErr("Please select at least one category.");
      return;
    }
    const [startHour, startMin] = form.start.split(":").map(Number);
    const [endHour, endMin] = form.end.split(":").map(Number);
    const startDate = new Date(selectedDate);
    startDate.setHours(startHour, startMin, 0, 0);
    const endDate = new Date(selectedDate);
    endDate.setHours(endHour, endMin, 0, 0);

    // Check: Start date must not be in the past
    if (startDate < new Date()) {
      setErr("You cannot schedule a space in the past.");
      return;
    }

    if (endDate <= startDate) {
      setErr("End time must be after start time.");
      return;
    }

    try {
      // Before posting, fetch the latest status from Firestore
      const userRef = doc(db, "user accounts", user.address);
      const userSnap = await getDoc(userRef);
      let status = user.status;
      if (userSnap.exists()) {
        status = userSnap.data().status || "participant";
      }

      // Prepare space data
      const spaceData = {
        username: user.username || user.address,
        twitter: user.twitter || "",
        title: form.title,
        description: form.description,
        date: startDate.toISOString(),
        end: endDate.toISOString(),
        categories: form.categories.join(", "),
        languages: form.languages.join(", "),
        twitter_link: form.twitter_link || "",
        owner: user.username,
        creator: user.address,
        creatorStatus: status,
        upvotes: 0,
        upvotedBy: [],
        createdAt: new Date().toISOString(),
        space_votes: 0,
      };

      // Generate a unique ID for the space
      const spaceId = `${user.address}_${Date.now()}`;

      // Upload to spaces collection (main collection for spaces)
      await setDoc(doc(db, "spaces", spaceId), spaceData);

      setForm({
        title: "",
        description: "",
        start: "12:00",
        end: "12:30",
        categories: [],
        languages: [],
        twitter_link: "",
      });
      setSuccess("Space scheduled and uploaded to 'spaces' collection!");
      fetchSpacesByUser(user.username).then(setSpaces);

      // CALENDAR POPUP LOGIC
      if (status === "host") {
        setCalendarPopup("Great! your space is now scheduled!");
      } else {
        setCalendarPopup("Your space will not be posted on the calendar yet. Please have the community help you upvote it.");
      }
    } catch (error) {
      setErr(error.message);
      console.log("Error uploading space:", error); // Debug log
    }
  };

  // UPDATED handleDelete: also update votes and spacesUpvoted
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this space?")) return;

    // Fetch the space before deleting
    const spaceRef = doc(db, "spaces", id);
    const spaceSnap = await getDoc(spaceRef);
    if (!spaceSnap.exists()) {
      alert("Space not found.");
      return;
    }
    const spaceData = spaceSnap.data();
    const upvotes = Number(spaceData.upvotes) || 0;
    const upvotedBy = Array.isArray(spaceData.upvotedBy) ? spaceData.upvotedBy : [];
    const creator = spaceData.creator;

    // 1. Update creator's votes and status
    if (creator) {
      const creatorRef = doc(db, "user accounts", creator);
      const creatorSnap = await getDoc(creatorRef);
      if (creatorSnap.exists()) {
        const creatorData = creatorSnap.data();
        let newVotes = (creatorData.votes || 0) - upvotes;
        if (newVotes < 0) newVotes = 0;
        const newStatus = newVotes > 200 ? "host" : "participant";
        await updateDoc(creatorRef, {
          votes: newVotes,
          status: newStatus
        });
      }
    }

    // 2. Update each upvoter's spacesUpvoted
    for (const userAddr of upvotedBy) {
      const userRef = doc(db, "user accounts", userAddr);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        let newSpacesUpvoted = (userData.spacesUpvoted || 0) - 1;
        if (newSpacesUpvoted < 0) newSpacesUpvoted = 0;
        await updateDoc(userRef, {
          spacesUpvoted: newSpacesUpvoted
        });
      }
    }

    // 3. Delete the space
    await deleteSpace(id);
    setSpaces(spaces => spaces.filter(s => s.id !== id));
  };

  // Helper for safe date display
  const formatSpaceDate = (date) => {
    if (!date) return "No date";
    if (date.seconds) {
      return new Date(date.seconds * 1000).toLocaleString();
    }
    if (typeof date === "string" && !isNaN(Date.parse(date))) {
      return new Date(date).toLocaleString();
    }
    return "Invalid date";
  };

  if (loading) return <LoadingBuffer />;

  return (
    <div className="user-tab-container animated-panel">
      <div className="calendar-bg" style={{ minHeight: "100vh", padding: 0 }}>
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
          <div className="calendar-right-panel" style={{ maxWidth: 480, width: '100%' }}>
            <h2 className="calendar-panel-title">Schedule a Space</h2>
            {user ? (
              <form onSubmit={handleSubmit} className="calendar-form-card" style={{ width: '100%' }}>
                <label className="calendar-label" style={{ width: '100%' }}>
                  Title
                  <input
                    name="title"
                    className="calendar-input"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Space Title"
                    required
                    style={{ width: '100%' }}
                  />
                </label>
                <label className="calendar-label" style={{ width: '100%' }}>
                  Brief Description (max 300 characters)
                  <textarea
                    name="description"
                    className="calendar-input"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe your space"
                    rows={3}
                    style={{ resize: "vertical", width: '100%' }}
                    maxLength={300}
                    required
                  />
                  <div style={{ fontSize: 12, color: form.description.length > 300 ? "red" : "#666", textAlign: "right" }}>
                    {form.description.length}/300
                  </div>
                </label>

                <div style={{ display: "flex", gap: "1em", marginBottom: "1em", flexWrap: 'wrap' }}>
                  <label className="calendar-label" style={{ flex: 1, minWidth: 120 }}>
                    Start
                    <select
                      name="start"
                      className="calendar-input"
                      value={form.start}
                      onChange={handleChange}
                      style={{ width: '100%' }}
                    >
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="calendar-label" style={{ flex: 1, minWidth: 120 }}>
                    End
                    <select
                      name="end"
                      className="calendar-input"
                      value={form.end}
                      onChange={handleChange}
                      style={{ width: '100%' }}
                    >
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="calendar-label" style={{ width: '100%' }}>
                  Categories
                  <div className="user-tab-category-list" style={{ flexWrap: 'wrap', width: '100%' }}>
                    {categories.map(c => (
                      <label key={c} style={{ minWidth: 110, marginBottom: 6 }}>
                        <input
                          type="checkbox"
                          value={c}
                          checked={form.categories.includes(c)}
                          onChange={() => handleCheckboxChange("categories", c)}
                        />
                        {c[0].toUpperCase() + c.slice(1)}
                      </label>
                    ))}
                  </div>
                </label>

                <label className="calendar-label" style={{ width: '100%' }}>
                  Languages
                  <div className="user-tab-language-list" style={{ flexWrap: 'wrap', width: '100%' }}>
                    {languages.map(l => (
                      <label key={l} style={{ minWidth: 110, marginBottom: 6 }}>
                        <input
                          type="checkbox"
                          value={l}
                          checked={form.languages.includes(l)}
                          onChange={() => handleCheckboxChange("languages", l)}
                        />
                        {l[0].toUpperCase() + l.slice(1)}
                      </label>
                    ))}
                  </div>
                </label>

                <label className="calendar-label" style={{ width: '100%' }}>
                  Twitter Space Link (optional)
                  <input
                    name="twitter_link"
                    className="calendar-input"
                    value={form.twitter_link}
                    onChange={handleChange}
                    placeholder="https://twitter.com/i/spaces/..."
                    type="url"
                    style={{ width: '100%' }}
                  />
                </label>
                <button type="submit" className="calendar-btn" style={{ width: '100%' }}>Schedule</button>
                {err && <p className="calendar-error">{err}</p>}
                {success && <p className="calendar-success">{success}</p>}
              </form>
            ) : (
              <p className="calendar-error">Please connect your wallet to schedule a space.</p>
            )}

            {/* Popup Modal for calendar message */}
            <PopupModal
              open={!!calendarPopup}
              onClose={() => setCalendarPopup("")}
              message={calendarPopup}
            />

            {/* User's scheduled spaces */}
            <h2 className="calendar-panel-title" style={{ marginTop: 32 }}>Your Scheduled Spaces</h2>
            {spaces.length === 0 && (
              <div style={{ color: "#888", fontStyle: "italic" }}>
                You haven't scheduled any spaces yet.
              </div>
            )}
            {spaces.map(space => (
              <div
                key={space.id}
                className="calendar-event-card"
                style={{ marginBottom: 18, position: "relative", background: "#f6f8fa", minWidth: 0, width: '100%' }}
              >
                <div className="calendar-event-title">
                  <span role="img" aria-label="mic">🎙️</span> {space.title}
                </div>
                <div className="calendar-event-meta">
                  <span>
                    {formatSpaceDate(space.date)}
                  </span>
                  {space.languages && (
                    <span style={{ marginLeft: 12, fontSize: 13, color: "#444" }}>
                      Languages: {space.languages}
                    </span>
                  )}
                  {space.categories && (
                    <span style={{ marginLeft: 12, fontSize: 13, color: "#444" }}>
                      Categories: {space.categories}
                    </span>
                  )}
                </div>
                <div style={{ color: "#666", margin: "6px 0 10px 0", fontSize: 15 }}>
                  {space.description}
                </div>
                {/* Only show delete button if user is the owner */}
                {space.owner === user?.username && (
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
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}