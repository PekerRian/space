import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { app } from "../firebase"; // your Firebase config

const db = getFirestore(app);

export default function WalletAuth({ onUserReady }) {
  const { account } = useWallet();
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registerForm, setRegisterForm] = useState({ username: "", twitter: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if user exists for connected wallet (DIRECTLY in Firestore)
  useEffect(() => {
    if (!account?.address) return;
    setLoading(true);
    const check = async () => {
      const userRef = doc(db, "users", account.address);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setUser(snap.data());
        setShowRegister(false);
        if (onUserReady) onUserReady(snap.data());
      } else {
        setUser(null);
        setShowRegister(true);
      }
      setLoading(false);
    };
    check();
  }, [account?.address, onUserReady]);

  // Handle form submission for registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!registerForm.username.trim()) {
      setError("Username required");
      return;
    }
    setLoading(true);
    try {
      const newUser = {
        address: account.address,
        username: registerForm.username,
        twitter: registerForm.twitter,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "users", account.address), newUser);
      setUser(newUser);
      setShowRegister(false);
      if (onUserReady) onUserReady(newUser);
    } catch (err) {
      setError("Registration failed");
    }
    setLoading(false);
  };

  return (
    <div>
      <WalletSelector />
      {showRegister && (
        <form onSubmit={handleRegister} style={{ marginTop: 24, background: "#f8f8f8", padding: 18, borderRadius: 8 }}>
          <h3>Register your account</h3>
          <label>
            Username
            <input
              value={registerForm.username}
              onChange={e => setRegisterForm(f => ({ ...f, username: e.target.value }))}
              required
              style={{ display: "block", margin: "8px 0" }}
            />
          </label>
          <label>
            Twitter @
            <input
              value={registerForm.twitter}
              onChange={e => setRegisterForm(f => ({ ...f, twitter: e.target.value }))}
              placeholder="@yourtwitter"
              style={{ display: "block", margin: "8px 0" }}
            />
          </label>
          <button type="submit" disabled={loading}>
            Register
          </button>
          {error && <div style={{ color: "red" }}>{error}</div>}
        </form>
      )}
    </div>
  );
}