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
      <form onSubmit={handleSubmit} className="login-form">
        <h2 className="login-title">Sign in to SpaceSched</h2>
        <input
          value={username}
          onChange={e=>setUsername(e.target.value)}
          placeholder="Username"
          required
          className="login-input"
        />
        <input
          type="password"
          value={password}
          onChange={e=>setPassword(e.target.value)}
          placeholder="Password"
          required
          className="login-input"
        />
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? <LoadingBuffer /> : "Login"}
        </button>
        {err && <p className="login-error">{err}</p>}
      </form>
    </div>
  );
}
export default Login;