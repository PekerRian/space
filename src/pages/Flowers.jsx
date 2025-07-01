import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import "./Flowers.css";
import { LoadingBuffer } from "../App";

// --- Helper to get wallet address as string ---
function getAddressString(account) {
  if (!account?.address) return "";
  if (typeof account.address === "string") return account.address;
  if (typeof account.address.toString === "function") return account.address.toString();
  return String(account.address);
}

// --- APTOS TRANSFER FUNCTION ---
async function transferApt(signAndSubmitTransaction, account, toAddress, amount) {
  if (typeof signAndSubmitTransaction !== "function") {
    throw new Error("Wallet not connected or not compatible.");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(toAddress)) {
    throw new Error("Recipient address is invalid. Must be a 0x-prefixed, 64-char hex Aptos address.");
  }
  const amt = Number(amount);
  if (!amt || amt <= 0) throw new Error("Amount must be a positive number.");
  const octas = Math.floor(amt * 1e8);
  if (!Number.isInteger(octas) || octas <= 0) throw new Error("Amount must be at least 0.00000001 APT.");

  return await signAndSubmitTransaction({
    sender: account.address,
    data: {
      function: "0x1::coin::transfer",
      typeArguments: ["0x1::aptos_coin::AptosCoin"],
      functionArguments: [toAddress, octas],
    },
  });
}

export default function Flowers() {
  const [topReceivers, setTopReceivers] = useState([]);
  const [topSenders, setTopSenders] = useState([]);
  const [loading, setLoading] = useState(true);

  // User search and APT transfer states
  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferStatus, setTransferStatus] = useState("");
  const { account, signAndSubmitTransaction } = useWallet();

  // Debug: log wallet status on change
  useEffect(() => {
    console.log("account", account);
    console.log("account.address (string):", getAddressString(account));
    console.log("signAndSubmitTransaction", signAndSubmitTransaction, typeof signAndSubmitTransaction);
  }, [account, signAndSubmitTransaction]);

  useEffect(() => {
    async function fetchUserAccounts() {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "user accounts"));
      const users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

      // Top Receivers: sorted by totalReceivedApt
      const receivers = [...users]
        .sort((a, b) => (b.totalReceivedApt || 0) - (a.totalReceivedApt || 0))
        .map(u => ({
          username: u.username || u.id,
          spacesHosted: u.spacesCreated || 0,
          totalReceivedApt: Number(u.totalReceivedApt || 0),
          totalSpaceHours: Number(u.totalSpaceHours || 0),
        }));

      // Top Senders: sorted by totalSentApt
      const senders = [...users]
        .sort((a, b) => (b.totalSentApt || 0) - (a.totalSentApt || 0))
        .map(u => ({
          username: u.username || u.id,
          totalSentApt: Number(u.totalSentApt || 0),
          spacesUpvoted: u.spacesUpvoted || 0,
        }));

      setTopReceivers(receivers);
      setTopSenders(senders);
      setLoading(false);
    }

    fetchUserAccounts();
  }, []);

  // --- USER SEARCH LOGIC ---
  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError("");
    setSearchResult(null);
    setTransferAmount("");
    setTransferStatus("");

    if (!searchInput.trim()) {
      setSearchError("Please enter a username.");
      return;
    }
    // Try to find exact match in firestore (case insensitive)
    const snapshot = await getDocs(collection(db, "user accounts"));
    const found = snapshot.docs
      .map(doc => ({ ...doc.data(), id: doc.id }))
      .find(u => (u.username || "").toLowerCase() === searchInput.trim().toLowerCase());
    if (!found) {
      setSearchError("User not found.");
      return;
    }
    setSearchResult(found);
  };

  // --- APT TRANSFER LOGIC ---
  const handleAptTransfer = async (e) => {
    e.preventDefault();
    setTransferStatus("");

    const fromAddress = getAddressString(account);

    // Defensive wallet checks
    if (!fromAddress) {
      setTransferStatus("Connect your wallet first.");
      return;
    }
    if (typeof signAndSubmitTransaction !== "function") {
      setTransferStatus("Wallet not connected or not compatible.");
      return;
    }
    if (!searchResult?.id) {
      setTransferStatus("No user selected to transfer.");
      return;
    }
    try {
      console.log("Attempting transfer:", {
        from: fromAddress,
        to: searchResult.id,
        amount: transferAmount,
        signAndSubmitTransactionType: typeof signAndSubmitTransaction,
      });

      await transferApt(signAndSubmitTransaction, account, searchResult.id, transferAmount);
      // Update sender and receiver stats in Firestore
      const senderDocRef = doc(db, "user accounts", fromAddress);
      const receiverDocRef = doc(db, "user accounts", searchResult.id);
      // Get current values
      const [senderSnap, receiverSnap] = await Promise.all([
        getDocs(collection(db, "user accounts")).then(snap => snap.docs.find(d => d.id === fromAddress)),
        getDocs(collection(db, "user accounts")).then(snap => snap.docs.find(d => d.id === searchResult.id)),
      ]);
      const senderData = senderSnap?.data() || {};
      const receiverData = receiverSnap?.data() || {};
      await updateDoc(senderDocRef, {
        totalSentApt: Number(senderData.totalSentApt || 0) + Number(transferAmount)
      });
      await updateDoc(receiverDocRef, {
        totalReceivedApt: Number(receiverData.totalReceivedApt || 0) + Number(transferAmount)
      });
      setTransferStatus(`Successfully sent ${transferAmount} APT to ${searchResult.username}! Please confirm in your wallet.`);
    } catch (err) {
      let msg = "Transfer failed.";
      if (err && typeof err === "object") {
        if (err.message) msg += " " + err.message;
        else if (typeof err.toString === "function") msg += " " + err.toString();
        else msg += " " + JSON.stringify(err);
      } else if (typeof err === "string") {
        msg += " " + err;
      } else {
        msg += " Unknown error.";
      }
      setTransferStatus(msg);
      console.log("Transfer failed error object:", err);
    }
  };

  if (loading) return <LoadingBuffer />;

  return (
    <div className="page-container flowers-leaderboard-container animated-panel">
      <h1 className="page-title">Leaderboard</h1>
      <div className="flowers-leaderboard-flex">
        {/* All Receivers */}
        <div className="flowers-leaderboard-box flowers-receivers">
          <h2 className="flowers-leaderboard-title">Top Speakers</h2>
          <table className="flowers-leaderboard-table">
            <thead>
              <tr>
                <th>Host</th>
                <th>Spaces Hosted</th>
                <th>APT Received</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {topReceivers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="flowers-no-data">No data</td>
                </tr>
              ) : topReceivers.map((user) => (
                <tr key={user.username}>
                  <td>{user.username}</td>
                  <td>{user.spacesHosted}</td>
                  <td>{user.totalReceivedApt}</td>
                  <td>{user.totalSpaceHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* All Senders */}
        <div className="flowers-leaderboard-box flowers-senders">
          <h2 className="flowers-leaderboard-title">Top tippers</h2>
          <table className="flowers-leaderboard-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>APT Tipped</th>
                <th>Spaces Upvoted</th>
              </tr>
            </thead>
            <tbody>
              {topSenders.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center" }}>No data</td>
                </tr>
              ) : topSenders.map((user) => (
                <tr key={user.username}>
                  <td>{user.username}</td>
                  <td>{user.totalSentApt}</td>
                  <td>{user.spacesUpvoted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- USER SEARCH & TRANSFER SECTION ---------- */}
      <div className="flowers-transfer-card">
        <h2 style={{ textAlign: "center" }}>🌐 Tip your speaker</h2>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 9.6, marginBottom: 12.8 }}>
          <input
            type="text"
            placeholder="Enter username"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{ flex: 1, padding: 6.4, borderRadius: 4.8, border: "0.8px solid #bbb" }}
          />
          <button type="submit" className="calendar-btn">Search</button>
        </form>
        {searchError && <div style={{ color: "red", marginBottom: 6.4 }}>{searchError}</div>}
        {searchResult && (
          <div className="search-result">
            <div><b>Username:</b> {searchResult.username}</div>
            <div><b>Registered Address:</b> <span style={{ fontFamily: "monospace" }}>{searchResult.id}</span></div>
            <div><b>Status:</b> {searchResult.status}</div>
            <div><b>APT Received:</b> {searchResult.totalReceivedApt || 0}</div>
            <div><b>APT Sent:</b> {searchResult.totalSentApt || 0}</div>
            {(getAddressString(account) && typeof signAndSubmitTransaction === "function") ? (
              <form onSubmit={handleAptTransfer} style={{ marginTop: 12.8, display: "flex", gap: 6.4 }}>
                <input
                  type="number"
                  placeholder="Amount (APT)"
                  value={transferAmount}
                  min="0.00000001"
                  step="0.00000001"
                  onChange={e => setTransferAmount(e.target.value)}
                  style={{ flex: 1, padding: 6.4, borderRadius: 4.8, border: "0.8px solid #bbb" }}
                />
                <button type="submit" className="calendar-btn">Send APT</button>
              </form>
            ) : (
              <div style={{ color: "orange", marginTop: 6.4 }}>
                Connect your Aptos wallet to send APT.
              </div>
            )}
            {transferStatus && <div style={{ marginTop: 6.4, color: transferStatus.startsWith("Successfully") ? "green" : "red" }}>{transferStatus}</div>}
          </div>
        )}
      </div>
    </div>
  );
}