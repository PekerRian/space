import React, { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

function WalletAuth({ walletAddress, onProfileCreated }) {
  const [username, setUsername] = useState("");
  const [twitter, setTwitter] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleRegister = async () => {
    if (!username) {
      alert("Please enter a username.");
      return;
    }
    if (!walletAddress || walletAddress.length < 4) {
      alert("Invalid wallet address.");
      return;
    }
    setLoading(true);
    try {
      // Cap username to 15 chars, then append last 4 digits of wallet address
      const trimmed = username.slice(0, 15);
      const walletSuffix = walletAddress.slice(-4);
      const finalUsername = `${trimmed}${walletSuffix}`;
      await setDoc(doc(db, "user accounts", walletAddress), {
        username: finalUsername,
        twitter,
        wallet: walletAddress,
        createdAt: new Date().toISOString(),
        spacesCreated: 0,
        totalReceivedApt: 0,
        totalSpaceHours: 0,
        totalSentApt: 0,
        spacesUpvoted: 0,
        votes: 0,
        status: "participant", // Status field added and set to "participant"
      });
      setRegistered(true);
      if (onProfileCreated) onProfileCreated();
    } catch (error) {
      alert("Error registering: " + error.message);
    }
    setLoading(false);
  };

  if (!walletAddress) {
    return <div>Please connect your wallet first.</div>;
  }

  if (registered) {
    // Show the username with wallet digits
    const trimmed = username.slice(0, 15);
    const walletSuffix = walletAddress ? walletAddress.slice(-4) : "";
    const finalUsername = `${trimmed}${walletSuffix}`;
    return (
      <div className="calendar-modal-overlay" style={{ zIndex: 1000 }}>
        <div className="calendar-modal-content" style={{ maxWidth: 400, textAlign: 'center' }}>
          <h2 style={{ color: '#ffe066', fontFamily: '"Press Start 2P", monospace', fontSize: '1.1em', marginBottom: 18 }}>Registration complete!</h2>
          <div style={{ color: '#fff', fontSize: '1.1em', marginBottom: 18 }}>
            Welcome, <span style={{ color: '#ffe066', fontWeight: 700 }}>{finalUsername}</span>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-modal-overlay" style={{ zIndex: 1000 }}>
      <div
        className="calendar-modal-content"
        style={{
          maxWidth: 320,
          minWidth: 180,
          margin: "0 auto",
          padding: 12,
          boxSizing: "border-box",
          width: "96%",
          minHeight: "auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <h2 style={{ fontSize: "1.3em", textAlign: "center", color: '#ffe066', fontFamily: '"Press Start 2P", monospace' }}>Register</h2>
        <div style={{ marginBottom: 18 }}>
          <label style={{ width: "100%" }}>
            Username<br />
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Your username"
              style={{
                width: "100%",
                marginBottom: 10,
                color: "#181a2b",
                fontSize: "1em",
                padding: "0.7em 1em",
                borderRadius: 10,
                border: "1.5px solid #ffe066",
                background: "#f7f9fa",
                boxSizing: "border-box",
                fontFamily: '"Press Start 2P", monospace',
              }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ width: "100%" }}>
            Twitter Handle<br />
            <input
              type="text"
              value={twitter}
              onChange={e => setTwitter(e.target.value)}
              placeholder="@twitter"
              style={{
                width: "100%",
                marginBottom: 10,
                color: "#181a2b",
                fontSize: "1em",
                padding: "0.7em 1em",
                borderRadius: 10,
                border: "1.5px solid #ffe066",
                background: "#f7f9fa",
                boxSizing: "border-box",
                fontFamily: '"Press Start 2P", monospace',
              }}
            />
          </label>
        </div>
        <button
          onClick={handleRegister}
          disabled={loading || !username}
          style={{
            width: "100%",
            padding: "0.9em 0",
            fontSize: "1.1em",
            borderRadius: 12,
            background: "linear-gradient(90deg, #ffe066 0%, #ffb800 100%)",
            color: "#181a2b",
            border: "none",
            fontWeight: 700,
            boxShadow: "0 2px 8px #ffe06655",
            marginTop: 8,
            fontFamily: '"Press Start 2P", monospace',
            textShadow: '0 0 6px #ffe066, 0 0 2px #fff',
          }}
        >
          {loading ? "Registering..." : "Register"}
        </button>
        {/* Mobile-specific hint */}
        <div style={{ fontSize: "0.98em", color: "#ffe066", marginTop: 18, textAlign: "center", fontFamily: '"Press Start 2P", monospace' }}>
          Your username will have the last 4 digits of your wallet address added for uniqueness.
        </div>
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
        @media (max-width: 600px) {
          .calendar-modal-content {
            max-width: 98vw !important;
            padding: 10vw 2vw 2vw 2vw !important;
            min-height: auto !important;
          }
          h2 {
            font-size: 1.1em !important;
          }
          input {
            font-size: 1em !important;
            padding: 0.7em 0.7em !important;
          }
          button {
            font-size: 1em !important;
            padding: 1em 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default WalletAuth;