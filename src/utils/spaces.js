import { collection, addDoc, getDocs, deleteDoc, doc, query, where, Timestamp } from "firebase/firestore";
import { db } from "./api";

// Add a space, now supports multiple categories and languages as comma-separated strings
// Includes `owner` field as the username
export async function addSpace({
  username,
  twitter,
  title,
  description,
  date,
  end,
  categories,    // expects a string, e.g. "gaming, defi"
  languages,     // expects a string, e.g. "english, tagalog"
  twitter_link
}) {
  return addDoc(collection(db, "spaces"), {
    username,
    twitter: twitter || "",
    title,
    description: description || "",
    date: Timestamp.fromDate(new Date(date)),
    end: end ? Timestamp.fromDate(new Date(end)) : null,
    categories: categories || "",
    languages: languages || "",
    twitter_link: twitter_link || "",
    owner: username, // username as the owner
  });
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