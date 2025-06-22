import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, getDoc, arrayUnion } from "firebase/firestore";
import { LoadingBuffer } from "../App";

// Helper to check if a space is done (end date or start date before now)
function isSpaceDone(space) {
  const now = new Date();
  let endDate = null;
  if (space.end) {
    if (typeof space.end === "object" && typeof space.end.seconds === "number") {
      endDate = new Date(space.end.seconds * 1000);
    } else if (typeof space.end === "string" && !isNaN(Date.parse(space.end))) {
      endDate = new Date(space.end);
    }
  }
  if (!endDate) {
    // fallback to start date
    if (typeof space.date === "object" && typeof space.date.seconds === "number") {
      endDate = new Date(space.date.seconds * 1000);
    } else if (typeof space.date === "string" && !isNaN(Date.parse(space.date))) {
      endDate = new Date(space.date);
    }
  }
  return endDate && endDate < now;
}

export default function Upvotes({ walletAddress }) {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hostFilter, setHostFilter] = useState("");
  const [hostNames, setHostNames] = useState({}); // {address: username}
  const [shineId, setShineId] = useState(null); // Track which space to shine

  // Helper to update the status based on votes
  const updateVotesAndStatus = async (walletAddress, newVoteCount) => {
    const newStatus = newVoteCount > 200 ? "host" : "participant";
    await updateDoc(doc(db, "user accounts", walletAddress), {
      votes: newVoteCount,
      status: newStatus,
    });
  };

  // Check and update spacesCreated for finished spaces, only once per space per creator
  async function checkAndUpdateSpacesCreated(loadedSpaces) {
    for (const space of loadedSpaces) {
      if (space.creator && isSpaceDone(space)) {
        const creatorRef = doc(db, "user accounts", space.creator);
        const creatorSnap = await getDoc(creatorRef);
        if (creatorSnap.exists()) {
          const creatorData = creatorSnap.data();
          const alreadyCounted =
            Array.isArray(creatorData.spacesCreatedBy) && creatorData.spacesCreatedBy.includes(space.id);

          if (!alreadyCounted) {
            await updateDoc(creatorRef, {
              spacesCreated: (creatorData.spacesCreated || 0) + 1,
              spacesCreatedBy: arrayUnion(space.id),
            });
          }
        }
      }
    }
  }

  useEffect(() => {
    async function fetchAndCheckSpaces() {
      // Fetch from the "spaces" collection
      const snap = await getDocs(collection(db, "spaces"));
      const loadedSpaces = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(space => space.creatorStatus === "participant");
      await checkAndUpdateSpacesCreated(loadedSpaces);
      // Only keep spaces that are NOT done
      setSpaces(loadedSpaces.filter(space => !isSpaceDone(space)));
      setLoading(false);
    }
    fetchAndCheckSpaces();
  }, []);

  // Fetch host display names
  useEffect(() => {
    async function fetchHostNames() {
      // Get all unique creator addresses from spaces
      const addresses = Array.from(new Set(spaces.map(s => s.creator).filter(Boolean)));
      const names = {};
      await Promise.all(addresses.map(async addr => {
        if (!addr) return;
        const userRef = doc(db, "user accounts", addr);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          names[addr] = data.username || addr;
        } else {
          names[addr] = addr;
        }
      }));
      setHostNames(names);
    }
    if (spaces.length) fetchHostNames();
  }, [spaces]);

  const handleUpvote = async (space) => {
    if (!walletAddress) return alert("Please connect your wallet to upvote.");
    if (space.upvotedBy && space.upvotedBy.includes(walletAddress)) {
      return alert("You already upvoted this space!");
    }

    // Update space: increment upvotes and add user to upvotedBy
    const spaceRef = doc(db, "spaces", space.id);
    await updateDoc(spaceRef, {
      upvotes: (space.upvotes || 0) + 1,
      upvotedBy: [...(space.upvotedBy || []), walletAddress],
    });

    // Update creator's votes and status
    const creatorRef = doc(db, "user accounts", space.creator);
    const creatorSnap = await getDoc(creatorRef);
    if (creatorSnap.exists()) {
      const creatorData = creatorSnap.data();
      let newVotes = (creatorData.votes || 0) + 1;
      await updateVotesAndStatus(space.creator, newVotes);
    }

    // Update upvoting user's spacesUpvoted ONLY (not votes)
    const userRef = doc(db, "user accounts", walletAddress);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      await updateDoc(userRef, {
        spacesUpvoted: (userData.spacesUpvoted || 0) + 1
      });
    }

    // Refresh UI (update state locally)
    setSpaces(spaces =>
      spaces.map(s =>
        s.id === space.id
          ? { ...s, upvotes: (s.upvotes || 0) + 1, upvotedBy: [...(s.upvotedBy || []), walletAddress] }
          : s
      )
    );
    setShineId(space.id); // Trigger shine effect
    setTimeout(() => setShineId(null), 1200); // Remove shine after animation
  };

  if (loading) return <LoadingBuffer />;

  // Filter spaces by host display name (case-insensitive)
  const filteredSpaces = hostFilter.trim()
    ? spaces.filter(space => {
        const display = hostNames[space.creator] || space.creator || "";
        return display.toLowerCase().includes(hostFilter.trim().toLowerCase());
      })
    : spaces;

  return (
    <div className="page-container animated-panel">
      <h2>Upvote Spaces</h2>
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Filter by host name..."
          value={hostFilter}
          onChange={e => setHostFilter(e.target.value)}
          style={{
            padding: "0.6em 1em",
            borderRadius: 8,
            border: "2px solid #00ffea",
            fontFamily: "'Press Start 2P', 'VT323', 'Consolas', 'monospace', Arial, sans-serif",
            fontSize: "1em",
            background: "#181a2b",
            color: "#00ffea",
            outline: "none",
            boxShadow: "0 0 8px #00ffea55"
          }}
        />
      </div>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {filteredSpaces.map(space => (
          <li key={space.id} 
              className={shineId === space.id ? "upvote-shine" : ""}
              style={{ border: "1px solid #eee", padding: 16, marginBottom: 16, borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
            <div><b>Title:</b> {space.title}</div>
            <div><b>Description:</b> {space.description}</div>
            <div><b>By:</b> <span style={{color:'#00ffea'}}>{hostNames[space.creator] || space.creator}</span></div>
            <div><b>Upvotes:</b> {space.upvotes || 0}</div>
            <button
              className="upvote-glow-btn"
              disabled={space.upvotedBy && space.upvotedBy.includes(walletAddress)}
              onClick={() => handleUpvote(space)}
            >
              {space.upvotedBy && space.upvotedBy.includes(walletAddress) ? "Upvoted" : "Upvote"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}