import { useState, useEffect } from "react";
import "../compact-smaller.css";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { fetchSpacesByUser, deleteSpace, addSpace } from "../utils/spaces";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../calendar-custom.css";
import { LoadingBuffer } from "../App";
import { mintPoap, getRegistry, createCollection, extractCollectionObjFromTx, collectionExists } from '../utils/aptosPoap';
import { v4 as uuidv4 } from 'uuid'; // Add at the top

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

// Popup modal for calendar messages
function PopupModal({ open, onClose, message }) {
  if (!open) return null;
  return (
    <div className="calendar-modal-overlay compact-modal-overlay" onClick={onClose}>
      <div
        className="calendar-modal-content compact-modal-content"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="calendar-modal-close compact-modal-close"
          aria-label="Close"
        >×</button>
        <div className="compact-modal-message">{message}</div>
      </div>
    </div>
  );
}

// Add a modal for viewing a space and minting POAP
function SpaceModal({ open, onClose, space, onMint, minting, mintError, mintSuccess, signAndSubmitTransaction, account }) {
  if (!open || !space) return null;
  const handleMint = async () => {
    await handleMintPoap(space);
    if (onMint) onMint();
  };
  return (
    <div className="calendar-modal-overlay compact-modal-overlay" onClick={onClose}>
      <div
        className="calendar-modal-content compact-modal-content"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="calendar-modal-close compact-modal-close"
          aria-label="Close"
        >×</button>
        <h3 className="compact-modal-title">{space.title}</h3>
        <div className="compact-modal-desc">{space.description}</div>
        {space.poap && space.mintEnabled === true && (
          <div className="compact-modal-poap-box">
            <div className="compact-modal-poap-title">POAP NFT Available</div>
            <div className="compact-modal-poap-name">{space.poap.name}</div>
            <div className="compact-modal-poap-desc">{space.poap.description}</div>
            {space.poap.image && <img src={space.poap.image.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} alt="POAP" className="compact-modal-poap-img" />}
            <button onClick={handleMint} className="calendar-btn compact-modal-btn" disabled={minting}>
              {minting ? 'Minting...' : 'Mint POAP'}
            </button>
            {mintError && <div className="compact-modal-error">{mintError}</div>}
            {mintSuccess && <div className="compact-modal-success">{mintSuccess}</div>}
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
  const [enablePoap, setEnablePoap] = useState(false); // NEW: POAP enable checkbox
  const [spacePassword, setSpacePassword] = useState(""); // NEW: password field
  const [spaceId, setSpaceId] = useState(() => uuidv4()); // Generate a unique spaceId for each new space

  // Handler for POAP enable checkbox
  const handleEnablePoapChange = (e) => {
    setEnablePoap(e.target.checked);
    if (!e.target.checked) {
      setPoap({ name: '', space: '', description: '', file: null, ipfsHash: '', maxSupply: '' });
    }
  };

  // Handler for password field
  const handlePasswordChange = (e) => setSpacePassword(e.target.value);

  // Helper to reliably get the wallet address as a string
  const getAddressString = (acct) => {
    if (!acct?.address) return "";
    if (typeof acct.address === "string") return acct.address;
    if (acct.address && typeof acct.address.toString === "function") return acct.address.toString();
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
            console.warn('No user found in Firestore for address:', address);
            setUser(null);
          }
        } catch (error) {
          console.error('Error loading user from Firestore:', error, 'address:', address);
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
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Not JSON, show raw text
        console.error('POAP image upload failed: Non-JSON response:', text);
        setErr('POAP image upload failed: ' + text);
        setPoapUploading(false);
        return '';
      }
      if (!res.ok) {
        console.error('POAP image upload failed:', data.error || data);
        setErr('POAP image upload failed: ' + (data.error || data));
        setPoapUploading(false);
        return '';
      }
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
    // Only validate POAP fields if enabled
    const poapFieldsFilled = enablePoap && (poap.name || poap.space || poap.description || poap.file);
    if (enablePoap && (!poap.name || !poap.space || !poap.description || !poap.file)) {
      setErr('If you want to set up a POAP, all POAP fields are required.');
      return;
    }
    // --- POAP maxSupply validation ---
    if (enablePoap && (!poap.maxSupply || !/^[0-9]+$/.test(poap.maxSupply) || parseInt(poap.maxSupply) <= 0)) {
      setErr('Max Supply must be a positive integer.');
      return;
    }
    // Extra: Defensive check for maxSupply before blockchain call
    // This ensures that even if the UI is bypassed, the value is always a valid integer string
    let poapMaxSupply = '0';
    if (poapFieldsFilled) {
      poapMaxSupply = String(parseInt(poap.maxSupply, 10));
    }
    // ---
    // Remove any time validation logic
    // if (!form.start || !form.end) {
    //   setError('Please select a start and end time.');
    //   return;
    // }
    // if (form.end <= form.start) {
    //   setError('End time must be after start time.');
    //   return;
    // }

    try {
      // Before posting, fetch the latest status from Firestore
      const userRef = doc(db, "user accounts", user.address);
      const userSnap = await getDoc(userRef);
      let status = user.status;
      if (userSnap.exists()) {
        status = userSnap.data().status || "participant";
      }

      // --- CREATE SPACE WITH spaceId ---
      await addSpace(spaceId, {
        title: form.title,
        description: form.description,
        start: form.start,
        end: form.end,
        categories: form.categories.join(", "),
        languages: form.languages.join(", "),
        twitter_link: form.twitter_link,
        owner: user.username || user.address,
        spaceId,
        // ...add any other fields needed...
      });

      // --- POAP image upload ---
      let poapIpfsHash = '';
      if (poap.file) {
        poapIpfsHash = await uploadPoapImage();
        if (!poapIpfsHash) {
          console.error('POAP image upload failed, poapIpfsHash:', poapIpfsHash, 'poap:', poap);
          throw new Error('POAP image upload failed');
        }
      }

      // --- POAP metadata upload ---
      let poapMetadataIpfsHash = '';
      let poapImageGatewayUrl = '';
      let nftMetadataFolder = '';
      if (poapFieldsFilled) {
        // Use the default Pinata gateway for maximum compatibility
        poapImageGatewayUrl = poapIpfsHash ? `https://gateway.pinata.cloud/ipfs/${poapIpfsHash}` : '';
        // Use FormData instead of JSON
        const metadataFormData = new FormData();
        metadataFormData.append('name', String(poap.name));
        metadataFormData.append('space', String(poap.space));
        metadataFormData.append('description', String(poap.description));
        metadataFormData.append('image', String(poapImageGatewayUrl)); // Use default gateway URL for metadata
        metadataFormData.append('spaceId', spaceId); // Use the generated spaceId
        metadataFormData.append('maxSupply', String(poap.maxSupply)); // Ensure maxSupply is sent for correct NFT count
        const metadataRes = await fetch('/api/upload-metadata', {
          method: 'POST',
          body: metadataFormData
        });
        const metadata = await metadataRes.json();
        if (!metadataRes.ok) {
          // Log backend error to web console
          console.error('POAP metadata upload failed:', metadata.error, 'metadata:', metadata, 'poap:', poap);
          throw new Error('Metadata upload failed: ' + metadata.error);
        }
        if (!metadata.ipfsHash) {
          console.error('POAP metadata upload missing ipfsHash:', metadata);
          throw new Error('Metadata upload failed');
        }
        poapMetadataIpfsHash = metadata.ipfsHash;
        // Store the folder info for Firestore
        nftMetadataFolder = metadata.nftMetadataFolder || '';
        // --- Write metadataUris array and folder to Firestore if present ---
        if (metadata.metadataUris && Array.isArray(metadata.metadataUris)) {
          // Debug: log the URIs and their count
          console.log('Writing nftMetadataUris to Firestore:', metadata.metadataUris);
          if (metadata.metadataUris.length !== parseInt(poap.maxSupply, 10)) {
            console.error('metadataUris length does not match maxSupply!', metadata.metadataUris.length, poap.maxSupply, metadata.metadataUris);
            throw new Error('metadataUris length does not match maxSupply!');
          }
          // Write only the array of JSON URIs to Firestore (do not write the folder)
          await updateDoc(doc(db, "spaces", spaceId), {
            nftMetadataUris: metadata.metadataUris
          });
        } else {
          console.error('metadataUris missing or not an array:', metadata.metadataUris);
          throw new Error('metadataUris missing or not an array');
        }
      }

      // --- POAP Collection creation (Aptos) ---
      let collectionObj = null;
      if (enablePoap) {
        // Defensive checks for wallet adapter
        if (!account || typeof account !== 'object' || !account.address) {
          throw new Error('Wallet account is missing or invalid. Please reconnect your wallet.');
        }
        if (!signAndSubmitTransaction || typeof signAndSubmitTransaction !== 'function') {
          throw new Error('Wallet adapter is not ready. Please reconnect your wallet.');
        }
        // Enforce: POAP image gateway URL must be a direct image (never .json or folder path)
        if (!poapImageGatewayUrl || typeof poapImageGatewayUrl !== 'string' || poapImageGatewayUrl.endsWith('.json') || poapImageGatewayUrl.endsWith('/') || poapImageGatewayUrl.includes('/metadata') || poapImageGatewayUrl.includes('/folder')) {
          throw new Error('Invalid POAP image URL: must be a direct public IPFS image gateway URL (not a .json or folder path).');
        }
        // Build the payload only (do not call signAndSubmitTransaction inside createCollection)
        // Set start_time to 5 minutes from now, end_time to 1 hour after start (both as Option<u64> arrays)
        const now = Math.floor(Date.now() / 1000);
        const startTime = now + 5 * 60; // 5 minutes from now
        const endTime = startTime + 60 * 60; // 1 hour after start
        const txRequest = createCollection({
          name: poap.name,
          description: poap.description,
          uri: poapImageGatewayUrl, // Set collection URI to the image gateway URL
          max_supply: parseInt(poap.maxSupply, 10) || 10,
          limit: 1,
          fee: 0,
          account
        });
        if (!txRequest || typeof txRequest !== 'object' || !txRequest.sender || !txRequest.data) {
          throw new Error('Failed to build transaction request for collection creation.');
        }
        let txResult;
        try {
          if (!signAndSubmitTransaction || typeof signAndSubmitTransaction !== 'function') {
            throw new Error('signAndSubmitTransaction is not a function or not defined');
          }
          if (!txRequest || typeof txRequest !== 'object' || !txRequest.sender || !txRequest.data) {
            throw new Error('Invalid transaction request');
          }
          txResult = await signAndSubmitTransaction(txRequest);
        } catch (err) {
          throw new Error('Failed to submit transaction: ' + (err?.message || err));
        }
        if (!txResult) {
          throw new Error('No transaction result returned from wallet.');
        }
        // Prefer extracting collectionObj from index2 event
        if (
          txResult &&
          txResult.events &&
          Array.isArray(txResult.events) &&
          txResult.events[2] &&
          txResult.events[2].type &&
          txResult.events[2].type.endsWith('::poap_launchpad::CollectionCreatedEvent') &&
          txResult.events[2].data &&
          txResult.events[2].data.collection_obj_addr
        ) {
          collectionObj = txResult.events[2].data.collection_obj_addr;
        } else {
          // Always use the async version and pass the tx hash for fallback
          const txHash = txResult?.hash || txResult?.transactionHash;
          collectionObj = await extractCollectionObjFromTx(txResult, txHash);
        }
        // Immediately proceed to save, do not wait for on-chain existence
      }
      // Prepare space data
      // Ensure poap.image is always a direct image gateway URL (never .json or folder)
      let poapImageUrl = '';
      if (enablePoap) {
        // Always use the gateway URL for the image
        poapImageUrl = poapIpfsHash ? `https://gateway.pinata.cloud/ipfs/${poapIpfsHash}` : '';
      }
      const spaceData = {
        spaceId, // Ensure spaceId is always present in the document
        username: user.username || user.address,
        twitter: user.twitter || "",
        title: form.title,
        description: form.description,
        date: selectedDate.toISOString(),
        end: selectedDate.toISOString(),
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
        poap: enablePoap ? {
          name: poap.name,
          space: poap.space,
          description: poap.description,
          image: poapImageUrl, // Always direct image gateway URL
          ipfsHash: poapIpfsHash,
          metadataIpfsHash: poapMetadataIpfsHash,
          collection: collectionObj || null,
          maxSupply: poap.maxSupply
        } : null,
        collectionObj: collectionObj || null, // top-level for easy access
        enablePoap,
        spacePassword, // include password in space data
        nftMetadataFolder, // Store the subfolder info for later use
      };

      // Final check: ensure poap.image is never a .json or folder path
      if (spaceData.poap && spaceData.poap.image && (spaceData.poap.image.endsWith('.json') || spaceData.poap.image.endsWith('/'))) {
        throw new Error('POAP image URL is invalid. It must be a direct image gateway URL, not a .json or folder path.');
      }

      // Add global error handlers for debugging
      if (typeof window !== 'undefined') {
        window.addEventListener('error', function (e) {
          console.error('Global error:', e.error, e);
        });
        window.addEventListener('unhandledrejection', function (e) {
          console.error('Global unhandled rejection:', e.reason, e);
        });
      }

      // Check for undefined or function values in spaceData and poap
      Object.entries(spaceData).forEach(([k, v]) => {
        if (typeof v === 'function') {
          console.error('Function found in spaceData at key:', k);
        }
        if (typeof v === 'undefined') {
          console.error('Undefined found in spaceData at key:', k);
        }
      });
      if (spaceData.poap && typeof spaceData.poap === 'object') {
        Object.entries(spaceData.poap).forEach(([k, v]) => {
          if (typeof v === 'function') {
            console.error('Function found in spaceData.poap at key:', k);
          }
          if (typeof v === 'undefined') {
            console.error('Undefined found in spaceData.poap at key:', k);
          }
        });
      }

      // Upload to spaces collection (main collection for spaces)
      // Only update the original document at spaces/{spaceId}
      await setDoc(doc(db, "spaces", spaceId), { ...spaceData, collectionObj });
      console.log('Upload to Firestore complete, collectionObj:', collectionObj);

      // Show user-facing alert for collection address
      if (collectionObj && typeof collectionObj === 'string' && collectionObj.startsWith('0x')) {
        alert(`Collection created! Collection address recorded in Firebase:\n${collectionObj}`);
      } else {
        alert('Warning: Collection address was not recorded correctly. Please check the transaction and try again.');
      }

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
      const uname = (user && (user.username || user.address)) ? (user.username || user.address) : null;
      if (!uname) {
        console.error('User object missing username and address:', user);
        setErr('User information is incomplete.');
        return;
      }
      fetchSpacesByUser(uname).then(spacesArr => {
        if (!Array.isArray(spacesArr)) {
          console.error('fetchSpacesByUser did not return an array:', spacesArr);
          setErr('Failed to fetch spaces.');
          return;
        }
        const fixedSpaces = spacesArr.map(s => {
          if (!s) {
            console.error('Null/undefined space in spacesArr:', spacesArr);
            return { id: '' };
          }
          return { ...s, id: s.id || s.docId || s._id || s.address_date || '' };
        });
        setSpaces(fixedSpaces);
      }).catch(err => {
        console.error('Error in fetchSpacesByUser:', err);
        setErr('Failed to fetch spaces: ' + (err && err.message ? err.message : String(err)));
      });

      // CALENDAR POPUP LOGIC
      if (status === "host") {
        setCalendarPopup("Great! your space is now scheduled!");
      } else {
        setCalendarPopup("Your space will not be posted on the calendar yet. Please have the community help you upvote it.");
      }
    } catch (error) {
      setErr(error.message);
      console.error('Error uploading space:', error, 'user:', user, 'form:', form, 'poap:', poap, 'enablePoap:', enablePoap);
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

  // Mint POAP NFT logic (using Move module)
  async function handleMintPoap(space, nftIndex = 0) {
    setMinting(true);
    setMintError("");
    setMintSuccess("");
    try {
      if (!account?.address) throw new Error("Wallet address not found");
      if (!space.collectionObj) throw new Error("No on-chain collection object found for this space");
      // Fetch latest nftMetadataUris, maxSupply, and mintedIndices from Firestore
      const { doc, getDoc, updateDoc } = await import("firebase/firestore");
      const spaceRef = doc(db, "spaces", space.id);
      const spaceSnap = await getDoc(spaceRef);
      let nftMetadataUris = space.nftMetadataUris || [];
      let maxSupply = space.poap?.maxSupply ? parseInt(space.poap.maxSupply, 10) : 0;
      let mintedIndices = [];
      if (spaceSnap.exists()) {
        const data = spaceSnap.data();
        if (Array.isArray(data.nftMetadataUris)) nftMetadataUris = data.nftMetadataUris;
        if (data.poap && data.poap.maxSupply) maxSupply = parseInt(data.poap.maxSupply, 10);
        if (Array.isArray(data.mintedIndices)) mintedIndices = data.mintedIndices;
      }
      // Ensure mintedIndices is always an array of numbers
      mintedIndices = mintedIndices.map(x => typeof x === 'number' ? x : parseInt(x, 10)).filter(x => !isNaN(x));
      if (!nftMetadataUris.length || !maxSupply) {
        throw new Error('NFT metadata URIs or maxSupply missing for this space');
      }
      // Mint by index: use the correct URI from the array
      if (nftIndex < 1 || nftIndex > maxSupply) {
        throw new Error(`Invalid NFT index: ${nftIndex}`);
      }
      const metadataUri = nftMetadataUris[nftIndex - 1];
      if (!metadataUri) throw new Error('Metadata URI not found for this index');
      await mintPoap({ signAndSubmitTransaction, account, collectionObj: space.collectionObj, metadataUri });
      // Update mintedIndices in Firestore
      await updateDoc(spaceRef, { mintedIndices: [...mintedIndices, nftIndex] });
      setMintSuccess(`POAP NFT minted for index ${nftIndex}! Check your wallet.`);
    } catch (e) {
      setMintError(e.message || String(e));
    } finally {
      setMinting(false);
    }
  }

  // Mint POAP NFT logic (using Move module) for calendar (next available)
  async function handleCalendarMintPoap(space) {
    setMinting(true);
    setMintError("");
    setMintSuccess("");
    try {
      if (!account?.address) throw new Error("Wallet address not found");
      if (!space.collectionObj) throw new Error("No on-chain collection object found for this space");
      // Fetch latest nftMetadataUris, maxSupply, and mintedIndices from Firestore
      const { doc, getDoc, updateDoc } = await import("firebase/firestore");
      const spaceRef = doc(db, "spaces", space.id);
      const spaceSnap = await getDoc(spaceRef);
      let nftMetadataUris = space.nftMetadataUris || [];
      let maxSupply = space.poap?.maxSupply ? parseInt(space.poap.maxSupply, 10) : 0;
      let mintedIndices = [];
      if (spaceSnap.exists()) {
        const data = spaceSnap.data();
        if (Array.isArray(data.nftMetadataUris)) nftMetadataUris = data.nftMetadataUris;
        if (data.poap && data.poap.maxSupply) maxSupply = parseInt(data.poap.maxSupply, 10);
        if (Array.isArray(data.mintedIndices)) mintedIndices = data.mintedIndices;
      }
      // Ensure mintedIndices is always an array of numbers
      mintedIndices = mintedIndices.map(x => typeof x === 'number' ? x : parseInt(x, 10)).filter(x => !isNaN(x));
      // Debug logging for troubleshooting
      console.log('Minting debug:', { maxSupply, mintedIndices, nftMetadataUris, space });
      if (!maxSupply || isNaN(maxSupply) || maxSupply < 1) {
        throw new Error('Invalid or missing maxSupply for this space');
      }
      if (!nftMetadataUris.length) {
        throw new Error('NFT metadata URIs missing for this space');
      }
      // Find the first available index
      let mintIndex = -1;
      for (let i = 1; i <= maxSupply; i++) {
        if (!mintedIndices.includes(i)) {
          mintIndex = i;
          break;
        }
      }
      if (mintIndex === -1) throw new Error('All NFTs have been minted for this space');
      const metadataUri = nftMetadataUris[mintIndex - 1];
      if (!metadataUri) throw new Error('Metadata URI not found for this index');
      await mintPoap({ signAndSubmitTransaction, account, collectionObj: space.collectionObj, metadataUri });
      // Update mintedIndices in Firestore (store as numbers)
      await updateDoc(spaceRef, { mintedIndices: [...mintedIndices, mintIndex] });
      setMintSuccess(`POAP NFT minted for index ${mintIndex}! Check your wallet.`);
    } catch (e) {
      setMintError(e.message || String(e));
      // Extra: log error and state for debugging
      console.error('Minting error:', e, { space });
    } finally {
      setMinting(false);
    }
  }

  if (loading) return <LoadingBuffer />;

  return (
    <div className="main-page user-tab-container animated-panel compact-page compact-smaller">
      <div className="calendar-bg compact-bg compact-smaller-bg">
        <div className="calendar-main-container compact-main compact-smaller-main" style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start'}}>
          <div className="calendar-left-panel compact-left compact-smaller-left">
            <h2 className="calendar-panel-title compact-title compact-smaller-title">Pick a Date</h2>
            {/* Render calendar directly, no card or extra container */}
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
          <div className="calendar-right-panel compact-right compact-smaller-right">
            <h2 className="calendar-panel-title compact-title compact-smaller-title">Schedule a Space</h2>
            {user ? (
              <form onSubmit={handleSubmit} className="calendar-form-card compact-card compact-smaller-card">
                <label className="calendar-label compact-label">
                  Title
                  <input
                    name="title"
                    className="calendar-input compact-input"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Space Title"
                    required
                  />
                </label>
                <label className="calendar-label compact-label">
                  Brief Description (max 300 characters)
                  <textarea
                    name="description"
                    className="calendar-input resize-vertical compact-input"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe your space"
                    rows={3}
                    maxLength={300}
                    required
                  />
                  <div className={form.description.length > 300 ? "calendar-desc-count calendar-desc-error" : "calendar-desc-count calendar-desc-normal"}>
                    {form.description.length}/300
                  </div>
                </label>

                <label className="calendar-label compact-label">
                  Categories
                  <div className="user-tab-category-list compact-flex-wrap">
                    {categories.map(c => (
                      <label key={c} className="compact-checkbox-label">
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

                <label className="calendar-label compact-label">
                  Languages
                  <div className="user-tab-language-list compact-flex-wrap">
                    {languages.map(l => (
                      <label key={l} className="compact-checkbox-label">
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

                <label className="calendar-label compact-label">
                  Twitter Space Link (optional)
                  <input
                    name="twitter_link"
                    className="calendar-input compact-input"
                    value={form.twitter_link}
                    onChange={handleChange}
                    placeholder="https://twitter.com/i/spaces/..."
                    type="url"
                  />
                </label>
                <label className="label-block-margin compact-label">
                  <input type="checkbox" checked={enablePoap} onChange={handleEnablePoapChange} /> Enable POAP for this space?
                </label>
                <label className="label-block-margin compact-label">
                  Space Password (required to mint POAP from calendar):
                  <input type="password" value={spacePassword} onChange={handlePasswordChange} className="input-password compact-input" />
                </label>
                <fieldset disabled={!enablePoap} className={enablePoap ? "fieldset-poap compact-card" : "fieldset-poap fieldset-poap-disabled compact-card"}>
                  <legend>POAP Details</legend>
                  <label className="calendar-label label-block-fullwidth compact-label">
                    POAP Name
                    <input
                      name="name"
                      className="calendar-input input-fullwidth compact-input"
                      value={poap.name}
                      onChange={handlePoapInput}
                      placeholder="POAP Name"
                    />
                  </label>
                  <label className="calendar-label label-block-fullwidth compact-label">
                    POAP Description
                    <textarea
                      name="description"
                      className="calendar-input input-fullwidth compact-input"
                      value={poap.description}
                      onChange={handlePoapInput}
                      placeholder="POAP Description"
                      rows={2}
                    />
                  </label>
                  <label className="calendar-label label-block-fullwidth compact-label">
                    POAP Image
                    <input type="file" accept="image/*" onChange={handlePoapFile} className="compact-input" />
                  </label>
                  <label className="calendar-label label-block-fullwidth compact-label">
                    Max Supply
                    <input
                      name="maxSupply"
                      className="calendar-input input-fullwidth compact-input"
                      type="number"
                      min="1"
                      value={poap.maxSupply || ''}
                      onChange={e => setPoap(p => ({ ...p, maxSupply: e.target.value }))}
                      placeholder="Max Supply (number of NFTs)"
                    />
                  </label>
                </fieldset>
                <button type="submit" className="calendar-btn btn-fullwidth compact-btn">Schedule</button>
                {err && <p className="calendar-error compact-error">{err}</p>}
                {success && <p className="calendar-success">{success}</p>}
              </form>
            ) : (
              <p className="calendar-error compact-error">Please connect your wallet to schedule a space.</p>
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
            <h2 className="calendar-panel-title mt-25 compact-title">Your Scheduled Spaces</h2>
            {spaces.length === 0 && (
              <div className="scheduled-empty compact-card">
                You haven't scheduled any spaces yet.
              </div>
            )}
            {spaces.map(space => (
              <div
                key={space.id}
                className="calendar-event-card scheduled-space-card compact-card"
                onClick={() => setSpaceModal(space)}
              >
                <div className="calendar-event-title compact-title">
                  <span role="img" aria-label="mic">🎙️</span> {space.title}
                </div>
                <div className="calendar-event-meta compact-desc">
                  <span>
                    {formatSpaceDate(space.date)}
                  </span>
                  {space.languages && (
                    <span className="scheduled-meta compact-desc">Languages: {space.languages}</span>
                  )}
                  {space.categories && (
                    <span className="scheduled-meta compact-desc">Categories: {space.categories}</span>
                  )}
                </div>
                <div className="scheduled-desc compact-desc">{space.description}</div>
                {/* Only show delete button if user is the owner */}
                {space.owner === user?.username && (
                  <button
                    onClick={() => handleDelete(space.id)}
                    className="scheduled-delete-btn compact-btn"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={async (e) => {
                    e.stopPropagation(); // Prevent parent onClick
                    // Toggle mintEnabled in Firestore
                    const ref = doc(db, 'spaces', space.id);
                    await updateDoc(ref, { mintEnabled: !space.mintEnabled });
                    setSpaces(spaces => spaces.map(s => s.id === space.id ? { ...s, mintEnabled: !space.mintEnabled } : s));
                  }}
                  className={space.mintEnabled ? "scheduled-mint-btn enabled compact-btn" : "scheduled-mint-btn compact-btn"}
                >
                  {space.mintEnabled ? 'Disable Mint on Calendar' : 'Enable Mint on Calendar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
