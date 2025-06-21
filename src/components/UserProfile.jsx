import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

function UserProfile() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function fetchUsers() {
      const snapshot = await getDocs(collection(db, "users"));
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    fetchUsers();
  }, []);

  return (
    <div>
      <h2>User Profiles</h2>
      {users.map(user => (
        <div key={user.id}>
          <h3>{user.name}</h3>
          {user.twitter && <a href={user.twitter}>Twitter</a>}
          <p>{user.bio}</p>
        </div>
      ))}
    </div>
  );
}

export default UserProfile;