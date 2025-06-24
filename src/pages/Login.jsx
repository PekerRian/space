import { useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { LoadingBuffer } from "../App";

function Login({ closeModal }) {
  const { login } = useAuthContext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(username, password);
      if (closeModal) closeModal();
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingBuffer />;

  return (
    <div className="container animated-panel">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 9.6 }}>
        <h2 style={{ marginTop: 0, marginBottom: 14.4, textAlign: "center" }}>Sign in to SpaceSched</h2>
        <input
          value={username}
          onChange={e=>setUsername(e.target.value)}
          placeholder="Username"
          required
          style={{ padding: "0.72em 0.8em", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12.8 }}
        />
        <input
          type="password"
          value={password}
          onChange={e=>setPassword(e.target.value)}
          placeholder="Password"
          required
          style={{ padding: "0.72em 0.8em", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12.8 }}
        />
        <button type="submit" style={{
          background: "#0074d9", color: "#fff", border: 0, borderRadius: 8,
          padding: "0.64em 0", fontWeight: 600, fontSize: 12.8, marginTop: 3.2
        }} disabled={loading}>
          {loading ? <LoadingBuffer /> : "Login"}
        </button>
        {err && <p style={{ color: "#e15d5d", marginTop: 4.8 }}>{err}</p>}
      </form>
    </div>
  );
}
export default Login;