import { useState, useEffect } from "react";
import { fetchSpaces } from "../utils/spaces";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../calendar-custom.css";
import { LoadingBuffer } from "../App";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { mintPoap } from '../utils/aptosPoap';
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid'; // Add at the top

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
  if (typeof date === "object" && date !== null && "seconds" in date && typeof date.seconds === "number") {
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
  return (space && space.creatorStatus === "host") || ((space && space.upvotes) || 0) >= 25;
}

function CalendarPage() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [spaces, setSpaces] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spaceId, setSpaceId] = useState(() => uuidv4()); // Generate a unique spaceId for each new space

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
    const langs = (space?.languages || "").split(",").map(l => l.trim().toLowerCase());
    const cats = (space?.categories || "").split(",").map(c => c.trim().toLowerCase());
    const host = (space?.username || "").toLowerCase();
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
      const spaceDate = safeToDate(space?.date);
      if (!spaceDate) return false;
      // Convert spaceDate to selected timezone and compare date parts
      const dateStr = spaceDate.toLocaleDateString("en-CA", { timeZone: timezone });
      const selectedStr = selectedDate.toLocaleDateString("en-CA", { timeZone: timezone });
      return dateStr === selectedStr;
    });

  const hourlySchedule = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    spaces: spacesForSelectedDate.filter(space => getHour(space?.date, timezone) === h)
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
        // Use FormData and always include spaceId (UUID, not space name)
        const metaFormData = new FormData();
        metaFormData.append('name', poapForm.name);
        metaFormData.append('space', poapForm.space);
        metaFormData.append('description', poapForm.description);
        metaFormData.append('image', data.ipfsHash ? `https://gateway.pinata.cloud/ipfs/${data.ipfsHash}` : '');
        metaFormData.append('spaceId', spaceId); // FIX: use generated UUID
        metaFormData.append('maxSupply', poapForm.maxSupply || 1); // Ensure maxSupply is sent for correct NFT count
        const metaRes = await fetch('/api/upload-metadata', {
          method: 'POST',
          body: metaFormData
        });
        const metaData = await metaRes.json();
        if (!metaData.ipfsHash) throw new Error('Metadata upload failed');
        // Log/verify returned spaceId for debugging
        if (metaData.spaceId) {
          console.log('[POAP][Calendar] Backend used spaceId:', metaData.spaceId);
        } else {
          console.warn('[POAP][Calendar] Backend did not return spaceId in response.');
        }
        setPoapStatus('NFT metadata uploaded! Ready to mint on Aptos. Metadata IPFS: ' + metaData.ipfsHash);
        if (onMinted) onMinted(metaData.ipfsHash);
      } catch (err) {
        setPoapStatus('Error: ' + err.message);
      }
      setMinting(false);
    }

    // Only pass the collection object address as required by the Move module
    async function handlePoapMint(collectionObj, metadataUri) {
      setMinting(true);
      setPoapStatus("");
      // Show the collection address to the user before minting
      const ok = window.confirm(`You are about to mint from collection address:\n${collectionObj}\n\nContinue?`);
      if (!ok) {
        setMinting(false);
        return;
      }
      try {
        if (!metadataUri) throw new Error('metadataUri is required for minting');
        await mintPoap({ signAndSubmitTransaction, account, collectionObj, metadataUri });
        setPoapStatus("Minted successfully!");
        if (onMinted) onMinted();
      } catch (e) {
        setPoapStatus('Mint failed: ' + (e.message || e));
      }
      setMinting(false);
    }

    return (
      <div className="calendar-poap-form">
        <h3>Mint POAP NFT</h3>
        <input type="file" accept="image/*" onChange={handlePoapFile} />
        <input name="name" placeholder="Name" value={poapForm.name} onChange={handlePoapInput} className="calendar-poap-input" />
        <input name="space" placeholder="Space" value={poapForm.space} onChange={handlePoapInput} className="calendar-poap-input" />
        <textarea name="description" placeholder="Description" value={poapForm.description} onChange={handlePoapInput} className="calendar-poap-input" />
        <button onClick={handlePoapUploadAndMint} disabled={minting || !poapForm.file || !poapForm.name || !poapForm.space || !poapForm.description}>
          {minting ? 'Uploading...' : 'Upload & Mint'}
        </button>
        {poapStatus && <div>{poapStatus}</div>}
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
          <div className="calendar-filter-card">
            <label htmlFor="timezone-select" className="calendar-timezone-label">
              Timezone:
            </label>
            <select
              id="timezone-select"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="calendar-timezone-select"
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
                          className="calendar-event-card calendar-event-card-clickable"
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
                              <span className="calendar-popular-label">
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
              <h2 className="compact-modal-title">{selectedSpace.title || 'Untitled Space'}</h2>
              <div className="compact-info-block">
                <b>Host:</b> {selectedSpace.username || '—'}
                {selectedSpace.twitter && (
                  <span className="compact-info-label">
                    ·
                    <a href={selectedSpace.twitter} target="_blank" rel="noopener noreferrer" className="calendar-twitter-link">
                      Twitter Profile
                    </a>
                  </span>
                )}
              </div>
              <div className="compact-info-block">
                <b>Date:</b> {startDate ? startDate.toLocaleDateString(undefined, { timeZone: timezone }) : '—'}
                <br />
                <b>Time:</b> {startDate ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: timezone }) : '—'}
                {endDate && <> - {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: timezone })}</>}
              </div>
              <div className="compact-info-block">
                <b>Categories:</b> {selectedSpace.categories || '—'}
                <br />
                <b>Languages:</b> {selectedSpace.languages || '—'}
              </div>
              <div className="compact-info-block">
                <b>Brief Description:</b>
                <div className={`calendar-description${selectedSpace.description ? ' has-content' : ''}`}>
                  {selectedSpace.description ? selectedSpace.description : 'No description provided.'}
                </div>
              </div>
              {selectedSpace.twitter_link && (
                <div>
                  <a
                    href={selectedSpace.twitter_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="calendar-event-link calendar-twitter-link"
                  >
                    Join Twitter Space
                  </a>
                </div>
              )}
              {selectedSpace.creatorStatus !== 'host' && (selectedSpace.upvotes || 0) >= 25 && (
                <div className="compact-warning">
                  🌟 This space is featured because it reached 25+ upvotes!
                </div>
              )}
              {/* POAP Mint Button in Modal for all users */}
              {selectedSpace.poap && typeof selectedSpace.poap === 'object' && selectedSpace.poap.ipfsHash && selectedSpace.mintEnabled === true && (
                <>
                  <button
                    className="compact-action-btn"
                    onClick={() => setShowPasswordPrompt(true)}
                  >
                    Mint POAP NFT
                  </button>
                  {/* Password Prompt Modal */}
                  <Modal open={showPasswordPrompt} onClose={() => { setShowPasswordPrompt(false); setMintPassword(""); setPasswordError(""); }}>
                    <div className="calendar-modal-center">
                      <h3>Enter Space Password to Mint</h3>
                      <input
                        type="password"
                        value={mintPassword}
                        onChange={e => setMintPassword(e.target.value)}
                        placeholder="Space Password"
                        className="calendar-input calendar-modal-input"
                      />
                      <div className="compact-error">{passwordError}</div>
                      <button
                        className="compact-action-btn"
                        onClick={async () => {
                          if (mintPassword !== selectedSpace.spacePassword) {
                            setPasswordError('Incorrect password.');
                            return;
                          }
                          setPasswordError("");
                          setShowPasswordPrompt(false);
                          setMinting(true);
                          try {
                            if (!account?.address) throw new Error("Wallet address not found");
                            if (!signAndSubmitTransaction) {
                              setPasswordError("Wallet not connected. Please connect your wallet.");
                              setMinting(false);
                              return;
                            }
                            if (!('collectionObj' in selectedSpace) || !selectedSpace.collectionObj) {
                              setPasswordError("No on-chain collection object found for this space. Please ensure the collection was created and try again.");
                              setMinting(false);
                              return;
                            }
                            // --- Firestore-driven NFT minting logic ---
                            // Fetch latest nftMetadataFolder, maxSupply, and mintedIndices from Firestore
                            const docId = selectedSpace.id || selectedSpace.collectionObj;
                            console.log('[POAP][Calendar] Attempting to fetch Firestore doc for spaceId:', docId);
                            const spaceRef = doc(db, 'spaces', docId);
                            const spaceSnap = await getDoc(spaceRef);
                            let nftMetadataFolder = selectedSpace.nftMetadataFolder || null;
                            let maxSupply = selectedSpace.maxSupply || 0;
                            let mintedIndices = [];
                            let nftMetadataUris = [];
                            if (spaceSnap.exists()) {
                              const data = spaceSnap.data();
                              if (Array.isArray(data.nftMetadataUris)) nftMetadataUris = data.nftMetadataUris;
                              if (typeof data.nftMetadataFolder === 'string') nftMetadataFolder = data.nftMetadataFolder;
                              if (typeof data.maxSupply === 'number' || typeof data.maxSupply === 'string') maxSupply = Number(data.maxSupply);
                              if (Array.isArray(data.mintedIndices)) mintedIndices = data.mintedIndices;
                            }
                            if ((!nftMetadataUris || nftMetadataUris.length === 0) && nftMetadataFolder && maxSupply) {
                              // Fallback: reconstruct URIs if array missing
                              let nftUris = [];
                              if (nftMetadataFolder.includes('/')) {
                                const [ipfsHash, subfolder] = nftMetadataFolder.split('/');
                                nftUris = Array.from({ length: maxSupply }, (_, i) => `https://peach-left-chimpanzee-996.mypinata.cloud/ipfs/${ipfsHash}/${subfolder}/${i+1}.json`);
                                console.warn('[POAP][Calendar] nftMetadataUris missing from Firestore, reconstructing URIs with custom gateway and subfolder.');
                              } else {
                                // No subfolder, just hash
                                nftUris = Array.from({ length: maxSupply }, (_, i) => `https://peach-left-chimpanzee-996.mypinata.cloud/ipfs/${nftMetadataFolder}/${i+1}.json`);
                                console.warn('[POAP][Calendar] nftMetadataUris missing from Firestore, reconstructing URIs with custom gateway and no subfolder.');
                              }
                              nftMetadataUris = nftUris;
                            }
                            if ((!nftMetadataUris || nftMetadataUris.length === 0) && selectedSpace.poap && selectedSpace.poap.ipfsHash) {
                              // Fallback: single metadata file from poap.ipfsHash
                              nftMetadataUris = [`https://peach-left-chimpanzee-996.mypinata.cloud/ipfs/${selectedSpace.poap.ipfsHash}`];
                              maxSupply = 1;
                              console.warn('[POAP][Calendar] Using poap.ipfsHash as single NFT metadata URI.');
                            }
                            if (!nftMetadataUris || nftMetadataUris.length === 0) {
                              setPasswordError('No NFT metadata URIs found for this space. Debug info: nftMetadataFolder=' + nftMetadataFolder + ', poap.ipfsHash=' + (selectedSpace.poap && selectedSpace.poap.ipfsHash));
                              setMinting(false);
                              return;
                            }
                            // Find the first available index
                            let mintIndex = -1;
                            for (let i = 1; i <= maxSupply; i++) {
                              if (!mintedIndices.includes(i)) {
                                mintIndex = i;
                                break;
                              }
                            }
                            if (mintIndex === -1) {
                              setPasswordError('All NFTs have been minted for this space');
                              setMinting(false);
                              return;
                            }
                            const metadataUri = nftMetadataUris[mintIndex - 1];
                            console.log('[POAP][Calendar] Will mint using metadataUri:', metadataUri);
                            if (!metadataUri) {
                              setPasswordError('NFT metadataUri is required');
                              setMinting(false);
                              return;
                            }
                            // Mint using the correct collection object only (metadataUri not passed to Move)
                            await mintPoap({ signAndSubmitTransaction, account, collectionObj: selectedSpace.collectionObj, metadataUri });
                            // Update mintedIndices in Firestore
                            await updateDoc(spaceRef, { mintedIndices: [...mintedIndices, mintIndex] });
                            alert(`POAP NFT minted for index ${mintIndex}! Check your wallet.`);
                          } catch (e) {
                            setPasswordError('Mint failed: ' + (e.message || e));
                            setMinting(false);
                          }
                        }}
                        disabled={minting}
                      >
                        {minting ? 'Minting...' : 'Mint POAP'}
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