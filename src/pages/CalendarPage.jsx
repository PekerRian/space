import { useState, useEffect } from "react";
import { fetchSpaces } from "../utils/spaces";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../calendar-custom.css";
import { LoadingBuffer } from "../App";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { mintPoap, getRegistry } from '../utils/aptosPoap';

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
  const { account } = useWallet();
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

  // POAP NFT state
  const [showPoapForm, setShowPoapForm] = useState(false);
  const [poapForm, setPoapForm] = useState({ name: '', space: '', description: '', file: null });
  const [poapStatus, setPoapStatus] = useState("");
  const [poapIpfsHash, setPoapIpfsHash] = useState("");
  const [minting, setMinting] = useState(false);
  const [mintPassword, setMintPassword] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordError, setPasswordError] = useState("");

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

  // POAP form handlers
  const handlePoapInput = e => setPoapForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handlePoapFile = e => setPoapForm(f => ({ ...f, file: e.target.files[0] }));

  // Move POAP form out of modal and into the main calendar page (for creators only)
  function PoapMintForm({ onMinted }) {
    const [poapForm, setPoapForm] = useState({ name: '', space: '', description: '', file: null });
    const [poapStatus, setPoapStatus] = useState("");
    const [poapIpfsHash, setPoapIpfsHash] = useState("");
    const [minting, setMinting] = useState(false);

    const handlePoapInput = e => setPoapForm(f => ({ ...f, [e.target.name]: e.target.value }));
    const handlePoapFile = e => setPoapForm(f => ({ ...f, file: e.target.files[0] }));

    async function handlePoapUploadAndMint() {
      setPoapStatus("");
      setMinting(true);
      try {
        // 1. Upload image to Pinata
        const formData = new FormData();
        formData.append('file', poapForm.file);
        // Use Vercel serverless endpoint
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.ipfsHash) throw new Error('IPFS upload failed');
        setPoapIpfsHash(data.ipfsHash);

        // 2. Upload metadata JSON to Pinata using your backend
        const metaRes = await fetch('/api/upload-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: poapForm.name,
            space: poapForm.space,
            description: poapForm.description,
            image: `ipfs://${data.ipfsHash}`
          })
        });
        const metaData = await metaRes.json();
        if (!metaData.ipfsHash) throw new Error('Metadata upload failed');

        setPoapStatus('NFT metadata uploaded! Ready to mint on Aptos. Metadata IPFS: ' + metaData.ipfsHash);
        if (onMinted) onMinted(metaData.ipfsHash);
      } catch (err) {
        setPoapStatus('Error: ' + err.message);
      }
      setMinting(false);
    }

    // In PoapMintForm or POAP mint logic, add on-chain mint logic
    async function handlePoapMint(collectionObj) {
      setMinting(true);
      setPoapStatus("");
      try {
        await mintPoap({ signAndSubmitTransaction, account, collectionObj });
        setPoapStatus("Minted successfully!");
        if (onMinted) onMinted();
      } catch (e) {
        setPoapStatus('Mint failed: ' + (e.message || e));
      }
      setMinting(false);
    }

    return (
      <div style={{marginTop:12, border:'1px solid #00ffea', padding:12, borderRadius:8}}>
        <h3>Mint POAP NFT</h3>
        <input type="file" accept="image/*" onChange={handlePoapFile} />
        <input name="name" placeholder="Name" value={poapForm.name} onChange={handlePoapInput} style={{display:'block',margin:'8px 0'}} />
        <input name="space" placeholder="Space" value={poapForm.space} onChange={handlePoapInput} style={{display:'block',margin:'8px 0'}} />
        <textarea name="description" placeholder="Description" value={poapForm.description} onChange={handlePoapInput} style={{display:'block',margin:'8px 0'}} />
        <button onClick={handlePoapUploadAndMint} disabled={minting || !poapForm.file || !poapForm.name || !poapForm.space || !poapForm.description}>
          {minting ? 'Uploading...' : 'Upload & Mint'}
        </button>
        {poapStatus && <div style={{marginTop:8}}>{poapStatus}</div>}
        {poapIpfsHash && <div>Image IPFS: {poapIpfsHash}</div>}
      </div>
    );
  }

  if (loading) return <LoadingBuffer />;

  return (
    <div className="calendar-bg animated-panel">
      <div className="calendar-main-container">
        {/* Left: Calendar and Filters */}
        <div className="calendar-left-panel">
          {/* Timezone Selector */}
          <div className="calendar-filter-card" style={{ marginBottom: 9.6 }}>
            <label htmlFor="timezone-select" style={{ fontFamily: '"Press Start 2P", monospace', color: '#0ff', fontSize: 10.4, marginRight: 6.4 }}>
              Timezone:
            </label>
            <select
              id="timezone-select"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              style={{ fontFamily: '"Press Start 2P", monospace', background: '#111', color: '#0ff', border: '1.2px solid #0ff', borderRadius: 3.2, padding: '1.6px 6.4px', fontSize: 10.4 }}
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
                              <span style={{ marginLeft: 6.4, color: "#b28d00", fontWeight: "bold" }}>
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
      <Modal open={!!selectedSpace} onClose={() => { setSelectedSpace(null); setShowPoapForm(false); }}>
        {selectedSpace && (() => {
          const startDate = safeToDate(selectedSpace.date);
          const endDate = safeToDate(selectedSpace.end);
          // Only show mint button if user is the creator
          const isCreator = account && (account.address === selectedSpace.creator || account.address?.toString() === selectedSpace.creator);
          return (
            <div>
              <h2 style={{ fontSize: 20.8 }}>{selectedSpace.title}</h2>
              <div style={{ marginBottom: 6.4 }}>
                <b>Host:</b> {selectedSpace.username}
                {selectedSpace.twitter && (
                  <span>
                    {" "}·{" "}
                    <a href={selectedSpace.twitter} target="_blank" rel="noopener noreferrer" style={{ color: "#1da1f2", fontSize: 12.8 }}>
                      Twitter Profile
                    </a>
                  </span>
                )}
              </div>
              <div style={{ marginBottom: 6.4 }}>
                <b>Date:</b> {startDate ? startDate.toLocaleDateString(undefined, { timeZone: timezone }) : "—"}
                <br />
                <b>Time:</b> {startDate ? startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: timezone }) : "—"}
                {endDate && <> - {endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: timezone })}</>}
              </div>
              <div style={{ marginBottom: 6.4 }}>
                <b>Categories:</b> {selectedSpace.categories || "—"}
                <br />
                <b>Languages:</b> {selectedSpace.languages || "—"}
              </div>
              <div style={{ marginBottom: 6.4 }}>
                <b>Brief Description:</b>
                <div
                  style={{
                    marginTop: 1.6,
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
                    style={{ color: "#1da1f2", fontWeight: "bold", fontSize: 12.8 }}
                  >
                    Join Twitter Space
                  </a>
                </div>
              )}
              {selectedSpace.creatorStatus !== "host" && (selectedSpace.upvotes || 0) >= 25 && (
                <div style={{ color: "#b28d00", fontWeight: "bold", marginTop: 8 }}>
                  🌟 This space is featured because it reached 25+ upvotes!
                </div>
              )}
              {/* POAP Mint Button in Modal for all users */}
              {selectedSpace.poap && selectedSpace.poap.ipfsHash && (
                <>
                  <button
                    style={{marginTop:12, background:'#ffe066', color:'#181a2b', fontWeight:'bold', border:'none', borderRadius:6, padding:'8px 18px', fontSize:16, cursor:'pointer'}}
                    onClick={() => setShowPasswordPrompt(true)}
                  >
                    Mint POAP NFT
                  </button>
                  {/* Password Prompt Modal */}
                  <Modal open={showPasswordPrompt} onClose={() => { setShowPasswordPrompt(false); setMintPassword(""); setPasswordError(""); }}>
                    <div style={{ textAlign: 'center' }}>
                      <h3>Enter Space Password to Mint</h3>
                      <input
                        type="password"
                        value={mintPassword}
                        onChange={e => setMintPassword(e.target.value)}
                        placeholder="Space Password"
                        style={{ margin: '12px 0', padding: 8, borderRadius: 4, border: '1px solid #ffe066', width: '80%' }}
                      />
                      <div style={{ color: 'red', minHeight: 18 }}>{passwordError}</div>
                      <button
                        style={{ background: '#ffe066', color: '#181a2b', fontWeight: 'bold', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 16, cursor: 'pointer', marginTop: 8 }}
                        onClick={async () => {
                          if (mintPassword !== selectedSpace.spacePassword) {
                            setPasswordError('Incorrect password.');
                            return;
                          }
                          setPasswordError("");
                          setShowPasswordPrompt(false);
                          // ...existing mint logic...
                          if (!window.aptos) {
                            alert('Aptos wallet not found');
                            return;
                          }
                          if (selectedSpace.poap.mintedBy && selectedSpace.poap.mintedBy.includes(account?.address)) {
                            alert('You have already minted this POAP.');
                            return;
                          }
                          try {
                            const getAddressString = (acct) => {
                              if (!acct?.address) return "";
                              if (typeof acct.address === "string") return acct.address;
                              if (typeof acct.address.toString === "function") return acct.address.toString();
                              return String(acct.address);
                            };
                            const propertyKeys = [];
                            const propertyTypes = [];
                            const propertyValues = [];
                            const soulBoundTo = getAddressString(account);
                            const addressHex = soulBoundTo.startsWith("0x") ? soulBoundTo : "0x" + soulBoundTo;
                            const collectionOwner = selectedSpace.poap.creator || selectedSpace.creator || selectedSpace.owner;
                            const collectionName = selectedSpace.poap.collection || 'POAP Collection';
                            const imageUri = typeof selectedSpace.poap.image === 'string' && selectedSpace.poap.image
                              ? selectedSpace.poap.image
                              : `ipfs://${selectedSpace.poap.ipfsHash}`;
                            const payload = {
                              type: 'entry_function_payload',
                              function: '0x4::aptos_token::mint_soul_bound',
                              type_arguments: [],
                              arguments: [
                                collectionOwner,
                                collectionName,
                                selectedSpace.poap.description || '',
                                selectedSpace.poap.name || '',
                                imageUri,
                                propertyKeys,
                                propertyTypes,
                                propertyValues,
                                addressHex
                              ]
                            };
                            console.log('[NFT MINT] Minting POAP NFT with payload:', payload);
                            const response = await window.aptos.signAndSubmitTransaction(payload);
                            console.log('[NFT MINT] Mint transaction submitted! Response:', response);
                            alert('Mint transaction submitted! Tx hash: ' + response.hash);
                          } catch (err) {
                            console.error('[NFT MINT] Mint failed:', err);
                            alert('Mint failed: ' + (err.message || err));
                          }
                        }}
                      >
                        Mint
                      </button>
                    </div>
                  </Modal>
                </>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

export default CalendarPage;