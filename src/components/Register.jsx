import { useState } from "react";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { app } from "../firebase";

const db = getFirestore(app);

export default function Register({ address, onRegistered }) {
  const [username, setUsername] = useState("");
  const [twitter, setTwitter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!username.trim()) {
      setError("Username required");
      setLoading(false);
      return;
    }
    try {
      await setDoc(doc(db, "users", address), {
        address,
        username,
        twitter,
        createdAt: Date.now(),
      });
      if (onRegistered) onRegistered({ address, username, twitter });
    } catch (err) {
      setError("Registration failed");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 24, background: "#f8f8f8", padding: 18, borderRadius: 8 }}>
      <h3>Register your account</h3>
      <label>
        Username
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          style={{ display: "block", margin: "8px 0" }}
        />
      </label>
      <label>
        Twitter @
        <input
          value={twitter}
          onChange={e => setTwitter(e.target.value)}
          placeholder="@yourtwitter"
          style={{ display: "block", margin: "8px 0" }}
        />
      </label>
      <button type="submit" disabled={loading}>
        Register
      </button>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </form>
  );
}