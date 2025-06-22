import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

function Spaces({ walletAddress }) {
  const [spaces, setSpaces] = useState([]);
  const [spaceName, setSpaceName] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch spaces on mount
  useEffect(() => {
    async function fetchSpaces() {
      const querySnapshot = await getDocs(collection(db, "spaces"));
      setSpaces(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    fetchSpaces();
  }, []);

  // Create a new space
  const handleCreateSpace = async () => {
    if (!spaceName) return;
    setLoading(true);
    await addDoc(collection(db, "spaces"), {
      name: spaceName,
      owner: walletAddress,
      createdAt: new Date().toISOString(),
    });
    setSpaceName("");
    // Re-fetch spaces
    const querySnapshot = await getDocs(collection(db, "spaces"));
    setSpaces(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: 20 }}>
      <h2>Create a Space</h2>
      <input
        type="text"
        value={spaceName}
        onChange={e => setSpaceName(e.target.value)}
        placeholder="Space name"
        style={{ width: "100%", marginBottom: 10 }}
      />
      <button onClick={handleCreateSpace} disabled={loading || !spaceName}>
        {loading ? "Creating..." : "Create Space"}
      </button>
      <h3 style={{ marginTop: 30 }}>All Spaces</h3>
      <ul>
        {spaces.map(space => (
          <li key={space.id}>
            {space.name} (owner: {space.owner})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Spaces;