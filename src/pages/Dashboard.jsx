import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { db } from "../utils/api";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { LoadingBuffer } from "../App";

function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ name: "", twitter: "", bio: "" });
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setProfile({
          name: data.name || "",
          twitter: data.twitter || "",
          bio: data.bio || "",
        });
        setUsername(data.username || "");
      }
    };
    fetchProfile();
  }, [user]);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), {
        ...profile,
        username: username,
        email: user.email,
      }, { merge: true });
      setStatus("Profile saved!");
    } catch (e) {
      setStatus("Error: " + e.message);
    }
  };

  if (!user) return <LoadingBuffer />;

  return (
    <div className="container animated-panel">
      <h2>Your Profile</h2>
      <div><b>Username:</b> {username}</div>
      <form className="card" onSubmit={handleSave}>
        <input
          name="name"
          placeholder="Name"
          value={profile.name}
          onChange={handleChange}
        />
        <input
          name="twitter"
          placeholder="Twitter link"
          value={profile.twitter}
          onChange={handleChange}
        />
        <textarea
          name="bio"
          placeholder="Bio"
          value={profile.bio}
          onChange={handleChange}
        />
        <button type="submit">Save Profile</button>
        {status && <p>{status}</p>}
      </form>
      <h3>Preview</h3>
      <div>
        <strong>{profile.name}</strong><br/>
        {profile.twitter && <a href={profile.twitter} target="_blank" rel="noopener noreferrer">Twitter</a>}<br/>
        <span>{profile.bio}</span>
      </div>
    </div>
  );
}

export default Dashboard;