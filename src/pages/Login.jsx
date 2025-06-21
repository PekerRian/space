import { useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";

function Login({ closeModal }) {
  const { login } = useAuthContext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await login(username, password);
      if (closeModal) closeModal();
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ marginTop: 0, marginBottom: 18, textAlign: "center" }}>Sign in to SpaceSched</h2>
      <input
        value={username}
        onChange={e=>setUsername(e.target.value)}
        placeholder="Username"
        required
        style={{ padding: "0.9em 1em", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 16 }}
      />
      <input
        type="password"
        value={password}
        onChange={e=>setPassword(e.target.value)}
        placeholder="Password"
        required
        style={{ padding: "0.9em 1em", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 16 }}
      />
      <button type="submit" style={{
        background: "#0074d9", color: "#fff", border: 0, borderRadius: 10,
        padding: "0.8em 0", fontWeight: 600, fontSize: 16, marginTop: 4
      }}>
        Login
      </button>
      {err && <p style={{ color: "#e15d5d", marginTop: 6 }}>{err}</p>}
    </form>
  );
}
export default Login;