import { createContext, useContext, useState } from "react";
import { db } from "../utils/api";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc
} from "firebase/firestore";
import bcrypt from "bcryptjs";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Register: username & password
  const register = async (username, password) => {
    // Check if username exists
    const q = query(collection(db, "users"), where("username", "==", username));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      throw new Error("Username already taken");
    }
    // Hash password
    const hashed = await bcrypt.hash(password, 10);
    // Store user in Firestore
    await addDoc(collection(db, "user accounts"), {
      username,
      password: hashed
    });
    setUser({ username });
    return { username };
  };

  // Login: username & password
  const login = async (username, password) => {
    const q = query(collection(db, "users"), where("username", "==", username));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error("Username not found");
    }
    const userDoc = snapshot.docs[0].data();
    const valid = await bcrypt.compare(password, userDoc.password);
    if (!valid) {
      throw new Error("Incorrect password");
    }
    setUser({ username });
    return { username };
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}