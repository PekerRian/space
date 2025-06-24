import { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { fetchSpacesByUser, deleteSpace } from "../utils/spaces";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../calendar-custom.css";
import { LoadingBuffer } from "../App";
import { mintPoap, getRegistry } from '../utils/aptosPoap';

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
            top: 11.2,
            right: 16,
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
        <div style={{ fontWeight: 480, fontSize: 14.4, color: '#ffe066', fontFamily: '"Press Start 2P", monospace', marginBottom: 9.6 }}>{message}</div>
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
          border-radius: 14.4px;
          box-shadow: 0 0 24px #ffe06699, 0 0 2px #fff;
          padding: 2em 1.2em 1.6em 1.2em;
          color: #fff;
          font-family: 'Press Start 2P', monospace;
          position: relative;
          animation: panelFadeInUp 0.5s cubic-bezier(.23,1.01,.32,1) both;
        }
        .calendar-modal-close {
          position: absolute;
          top: 11.2px;
          right: 16px;
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

// Add a modal for viewing a space and minting POAP
function SpaceModal({ open, onClose, space, onMint, minting, mintError, mintSuccess, signAndSubmitTransaction, account }) {
  if (!open || !space) return null;
  const handleMint = async () => {
    if (!space.collectionObj) {
      alert('No on-chain collection object found for this space.');
      return;
    }
    try {
      await mintPoap({ signAndSubmitTransaction, account, collectionObj: space.collectionObj });
      if (onMint) onMint();
    } catch (e) {
      alert('Mint failed: ' + (e.message || e));
    }
  };
  return (
    <div className="calendar-modal-overlay" style={{ zIndex: 1000 }} onClick={onClose}>
      <div
        className="calendar-modal-content"
        style={{ maxWidth: 400, margin: "0 auto", padding: 20, boxSizing: "border-box", width: "100%", minHeight: "auto", textAlign: "center" }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="calendar-modal-close"
          style={{ position: "absolute", top: 11.2, right: 16, border: 0, background: "none", fontSize: 20, cursor: "pointer", color: "#ffe066", fontFamily: '"Press Start 2P", monospace', textShadow: '0 0 6px #ffe066, 0 0 2px #fff' }}
          aria-label="Close"
        >×</button>
        <h3 style={{ color: '#ffe066', fontFamily: '"Press Start 2P", monospace', marginBottom: 12 }}>{space.title}</h3>
        <div style={{ color: '#fff', marginBottom: 8 }}>{space.description}</div>
        {space.poap && (
          <div style={{ margin: '16px 0', border: '1px solid #ffe066', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#ffe066', fontWeight: 600, marginBottom: 6 }}>POAP NFT Available</div>
            <div style={{ color: '#fff', fontSize: 13, marginBottom: 6 }}>{space.poap.name}</div>
            <div style={{ color: '#fff', fontSize: 12, marginBottom: 6 }}>{space.poap.description}</div>
            {space.poap.image && <img src={space.poap.image.replace('ipfs://', 'https://peach-left-chimpanzee-996.mypinata.cloud/ipfs/')} alt="POAP" style={{ maxWidth: 120, borderRadius: 8, marginBottom: 8 }} />}
            <button onClick={handleMint} className="calendar-btn" style={{ width: '100%', marginTop: 8 }} disabled={minting}>
              {minting ? 'Minting...' : 'Mint POAP'}
            </button>
            {mintError && <div style={{ color: 'red', fontSize: 12, marginTop: 6 }}>{mintError}</div>}
            {mintSuccess && <div style={{ color: 'green', fontSize: 12, marginTop: 6 }}>{mintSuccess}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function UserTab() {
  const { account, signAndSubmitTransaction } = useWallet();
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
  const [poap, setPoap] = useState({ name: '', space: '', description: '', file: null, ipfsHash: '', maxSupply: '' });
  const [poapUploading, setPoapUploading] = useState(false);
  const [spaceModal, setSpaceModal] = useState(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState("");
  const [mintSuccess, setMintSuccess] = useState("");

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

  // Fetch user's spaces (only those created by the user, using username or address)
  useEffect(() => {
    const uname = user?.username || user?.address;
    if (uname) {
      fetchSpacesByUser(uname).then(spacesArr => {
        // Ensure each space has an id property (Firestore doc id)
        const fixedSpaces = spacesArr.map(s => ({ ...s, id: s.id || s.docId || s._id || s.address_date || '' }));
        setSpaces(fixedSpaces);
      });
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

  // POAP handlers
  const handlePoapInput = e => setPoap(p => ({ ...p, [e.target.name]: e.target.value }));
  const handlePoapFile = e => setPoap(p => ({ ...p, file: e.target.files[0] }));
  // Auto-fill POAP space field when title changes
  useEffect(() => {
    setPoap(p => ({ ...p, space: form.title }));
    // eslint-disable-next-line
  }, [form.title]);

  async function uploadPoapImage() {
    if (!poap.file) return '';
    setPoapUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', poap.file);
      const res = await fetch('http://localhost:5001/upload', { method: 'POST', body: formData });
      const data = await res.json();
      setPoap(p => ({ ...p, ipfsHash: data.ipfsHash }));
      setPoapUploading(false);
      return data.ipfsHash;
    } catch (err) {
      setPoapUploading(false);
      setErr('POAP image upload failed: ' + err.message);
      console.error('POAP image upload failed:', err); // Log the full error object for debugging
      return '';
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess("");
    setErr("");
    setCalendarPopup("");
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
    // --- POAP validation ---
    const poapFieldsFilled = poap.name || poap.space || poap.description || poap.file;
    if (poapFieldsFilled && (!poap.name || !poap.space || !poap.description || !poap.file)) {
      setErr('If you want to set up a POAP, all POAP fields are required.');
      return;
    }
    // --- POAP maxSupply validation ---
    if (poapFieldsFilled) {
      if (!poap.maxSupply || !/^[0-9]+$/.test(poap.maxSupply) || parseInt(poap.maxSupply) <= 0) {
        setErr('Max Supply must be a positive integer.');
        return;
      }
    }
    // Extra: Defensive check for maxSupply before blockchain call
    // This ensures that even if the UI is bypassed, the value is always a valid integer string
    let poapMaxSupply = '0';
    if (poapFieldsFilled) {
      poapMaxSupply = String(parseInt(poap.maxSupply, 10));
    }
    // ---
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

      // --- POAP image upload ---
      let poapIpfsHash = '';
      if (poap.file) {
        poapIpfsHash = await uploadPoapImage();
        if (!poapIpfsHash) throw new Error('POAP image upload failed');
      }

      // --- POAP metadata upload ---
      let poapMetadataIpfsHash = '';
      if (poapFieldsFilled) {
        const metadataRes = await fetch('http://localhost:5001/upload-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: poap.name,
            space: poap.space,
            description: poap.description,
            image: poapIpfsHash ? `ipfs://${poapIpfsHash}` : ''
          })
        });
        const metadata = await metadataRes.json();
        if (!metadata.ipfsHash) throw new Error('Metadata upload failed');
        poapMetadataIpfsHash = metadata.ipfsHash;
      }

      // --- POAP Collection creation (Aptos) ---
      let poapCollectionName = '';
      let poapCollectionUri = '';
      if (poapFieldsFilled && window.aptos) {
        // Username without last 4 chars
        const uname = (user.username || user.address || '').slice(0, -4);
        // Make collection name unique per space
        const uniqueSuffix = `${form.title}-${Date.now()}`;
        poapCollectionName = `${uname}'s space POAPs - ${uniqueSuffix}`;
        poapCollectionUri = poapIpfsHash ? `ipfs://${poapIpfsHash}` : '';
        // Final defensive log and check before sending transaction
        console.log('Aptos create_collection args:', [
          poap.description,                // description
          poapMaxSupply,                   // max_supply
          poapCollectionName,              // name
          poapCollectionUri,               // uri
          true,                            // mutable_description
          false,                           // mutable_royalty
          false,                           // mutable_uri
          false,                           // mutable_token_description
          false,                           // mutable_token_name
          false,                           // mutable_token_properties
          false,                           // mutable_token_uri
          true,                            // tokens_burnable_by_creator
          false,                           // tokens_freezable_by_creator
          '1',                             // royalty_numerator (set to 1 for 0% royalty)
          '1'                              // royalty_denominator (set to 1 for 0% royalty)
        ]);
        console.log('Required args for aptos_token::create_collection:', [
          'description (string)',
          'max_supply (u64, stringified integer)',
          'name (string)',
          'uri (string)',
          'mutable_description (boolean)',
          'mutable_royalty (boolean)',
          'mutable_uri (boolean)',
          'mutable_token_description (boolean)',
          'mutable_token_name (boolean)',
          'mutable_token_properties (boolean)',
          'mutable_token_uri (boolean)',
          'tokens_burnable_by_creator (boolean)',
          'tokens_freezable_by_creator (boolean)',
          'royalty_numerator (u64, stringified integer)',
          'royalty_denominator (u64, stringified integer)'
        ]);
        const collectionPayload = {
          type: 'entry_function_payload',
          function: '0x4::aptos_token::create_collection',
          type_arguments: [],
          arguments: [
            poap.description,                // description
            poapMaxSupply,                   // max_supply
            poapCollectionName,              // name
            poapCollectionUri,               // uri
            true,                            // mutable_description
            false,                           // mutable_royalty
            false,                           // mutable_uri
            false,                           // mutable_token_description
            false,                           // mutable_token_name
            false,                           // mutable_token_properties
            false,                           // mutable_token_uri
            true,                            // tokens_burnable_by_creator
            false,                           // tokens_freezable_by_creator
            '1',                             // royalty_numerator (set to 1 for 0% royalty)
            '1'                              // royalty_denominator (set to 1 for 0% royalty)
          ]
        };
        console.log('Collection payload about to be sent:', JSON.stringify(collectionPayload, null, 2));
        try {
          await window.aptos.signAndSubmitTransaction(collectionPayload);
        } catch (e) {
          if (!String(e).includes('already exists')) throw e;
        }
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
        poap: poapFieldsFilled ? {
          name: poap.name,
          space: poap.space,
          description: poap.description,
          image: poapIpfsHash ? `ipfs://${poapIpfsHash}` : '',
          ipfsHash: poapIpfsHash,
          metadataIpfsHash: poapMetadataIpfsHash,
          collection: poapCollectionName,
          maxSupply: poapMaxSupply
        } : null,
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
      setPoap({ name: '', space: '', description: '', file: null, ipfsHash: '', maxSupply: '' });
      setSuccess("Space scheduled and uploaded to 'spaces' collection!");
      const uname = user.username || user.address;
      fetchSpacesByUser(uname).then(spacesArr => {
        const fixedSpaces = spacesArr.map(s => ({ ...s, id: s.id || s.docId || s._id || s.address_date || '' }));
        setSpaces(fixedSpaces);
      });

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

  // Mint POAP NFT logic
  async function handleMintPoap(space) {
    setMinting(true);
    setMintError("");
    setMintSuccess("");
    try {
      if (!window.aptos) throw new Error("Aptos wallet not found");
      if (!space.poap) throw new Error("No POAP info for this space");
      if (!account?.address) throw new Error("Wallet address not found");
      // Prepare args for minting soulbound NFT under the collection
      // All property vectors must be empty string arrays (vector<string>)
      const propertyKeys = [];
      const propertyTypes = [];
      const propertyValues = []; // vector<string>, not vector<vector<u8>>
      const soulBoundTo = getAddressString(account);
      const addressHex = soulBoundTo.startsWith("0x") ? soulBoundTo : "0x" + soulBoundTo;
      const payload = {
        type: 'entry_function_payload',
        function: '0x4::aptos_token::mint_soul_bound',
        type_arguments: [],
        arguments: [
          space.poap.collection,           // collection: String
          space.poap.description || '',    // description: String
          space.poap.name,                 // name: String
          space.poap.image || '',          // uri: String (image or metadata URI)
          propertyKeys,                    // property_keys: vector<String>
          propertyTypes,                   // property_types: vector<String>
          propertyValues,                  // property_values: vector<String>
          addressHex                       // soul_bound_to: address (as hex string)
        ]
      };
      await window.aptos.signAndSubmitTransaction(payload);
      setMintSuccess("POAP NFT minted! Check your wallet.");
    } catch (e) {
      setMintError(e.message || String(e));
    } finally {
      setMinting(false);
    }
  }

  if (loading) return <LoadingBuffer />;

  return (
    <div className="user-tab-container animated-panel">
      <div className="calendar-bg" style={{ minHeight: "80vh", padding: 0 }}>
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
          <div className="calendar-right-panel" style={{ maxWidth: 384, width: '100%' }}>
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
                  <div style={{ fontSize: 9.6, color: form.description.length > 300 ? "red" : "#666", textAlign: "right" }}>
                    {form.description.length}/300
                  </div>
                </label>

                <div style={{ display: "flex", gap: "0.8em", marginBottom: "0.8em", flexWrap: 'wrap' }}>
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
                      <label key={c} style={{ minWidth: 88, marginBottom: 4.8 }}>
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
                      <label key={l} style={{ minWidth: 88, marginBottom: 4.8 }}>
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
                {/* POAP NFT Setup */}
                <div style={{border:'1px solid #ffe066', borderRadius:8, padding:12, margin:'16px 0'}}>
                  <h3 style={{margin:'0 0 8px 0'}}>POAP NFT Setup</h3>
                  <label className="calendar-label" style={{ width: '100%' }}>
                    POAP Name
                    <input
                      name="name"
                      className="calendar-input"
                      value={poap.name}
                      onChange={handlePoapInput}
                      placeholder="POAP Name"
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label className="calendar-label" style={{ width: '100%' }}>
                    POAP Description
                    <textarea
                      name="description"
                      className="calendar-input"
                      value={poap.description}
                      onChange={handlePoapInput}
                      placeholder="POAP Description"
                      rows={2}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label className="calendar-label" style={{ width: '100%' }}>
                    POAP Image
                    <input type="file" accept="image/*" onChange={handlePoapFile} />
                  </label>
                  <label className="calendar-label" style={{ width: '100%' }}>
                    Max Supply
                    <input
                      name="maxSupply"
                      className="calendar-input"
                      type="number"
                      min="1"
                      value={poap.maxSupply || ''}
                      onChange={e => setPoap(p => ({ ...p, maxSupply: e.target.value }))}
                      placeholder="Max Supply (number of NFTs)"
                      style={{ width: '100%' }}
                    />
                  </label>
                </div>
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

            <SpaceModal
              open={!!spaceModal}
              onClose={() => setSpaceModal(null)}
              space={spaceModal}
              onMint={() => {/* Optionally update UI after mint */}}
              minting={minting}
              mintError={mintError}
              mintSuccess={mintSuccess}
              signAndSubmitTransaction={signAndSubmitTransaction}
              account={account}
            />

            {/* User's scheduled spaces */}
            <h2 className="calendar-panel-title" style={{ marginTop: 25.6 }}>Your Scheduled Spaces</h2>
            {spaces.length === 0 && (
              <div style={{ color: "#888", fontStyle: "italic" }}>
                You haven't scheduled any spaces yet.
              </div>
            )}
            {spaces.map(space => (
              <div
                key={space.id}
                className="calendar-event-card"
                style={{ marginBottom: 14.4, position: "relative", background: "#f6f8fa", minWidth: 0, width: '100%' }}
                onClick={() => setSpaceModal(space)}
              >
                <div className="calendar-event-title">
                  <span role="img" aria-label="mic">🎙️</span> {space.title}
                </div>
                <div className="calendar-event-meta">
                  <span>
                    {formatSpaceDate(space.date)}
                  </span>
                  {space.languages && (
                    <span style={{ marginLeft: 9.6, fontSize: 10.4, color: "#444" }}>
                      Languages: {space.languages}
                    </span>
                  )}
                  {space.categories && (
                    <span style={{ marginLeft: 9.6, fontSize: 10.4, color: "#444" }}>
                      Categories: {space.categories}
                    </span>
                  )}
                </div>
                <div style={{ color: "#666", margin: "4.8px 0 8px 0", fontSize: 12 }}>
                  {space.description}
                </div>
                {/* Only show delete button if user is the owner */}
                {space.owner === user?.username && (
                  <button
                    onClick={() => handleDelete(space.id)}
                    style={{
                      position: "absolute", top: 4.8, right: 6.4,
                      background: "#e15d5d", color: "#fff", border: 0,
                      borderRadius: 6.4, padding: "1.6px 8px", fontSize: 11.2, cursor: "pointer"
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