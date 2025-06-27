import { collection, setDoc, getDocs, deleteDoc, doc, query, where, Timestamp } from "firebase/firestore";
import { db } from "./api";

// Add a space with a specific spaceId (random/uuid)
export async function addSpace(spaceId, spaceData) {
  return setDoc(doc(db, "spaces", spaceId), spaceData);
}

// Fetch all spaces
export async function fetchSpaces() {
  const snap = await getDocs(collection(db, "spaces"));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Fetch spaces created by a specific user (by username)
export async function fetchSpacesByUser(username) {
  if (!username) return [];
  const q = query(collection(db, "spaces"), where("owner", "==", username));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Delete a space by document id
export async function deleteSpace(spaceId) {
  return deleteDoc(doc(db, "spaces", spaceId));
}