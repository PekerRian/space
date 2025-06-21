import { collection, addDoc, getDocs, deleteDoc, doc, query, where, Timestamp } from "firebase/firestore";
import { db } from "./api";

// Add a space, now includes description and twitter (host profile)
export async function addSpace({ username, twitter, title, description, date, end, category, language, twitter_link }) {
  return addDoc(collection(db, "spaces"), {
    username,
    twitter: twitter || "",
    title,
    description: description || "",
    date: Timestamp.fromDate(new Date(date)),
    end: end ? Timestamp.fromDate(new Date(end)) : null,
    category,
    language,
    twitter_link: twitter_link || "",
  });
}

// Fetch all spaces
export async function fetchSpaces() {
  const snap = await getDocs(collection(db, "spaces"));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Fetch spaces created by a specific user
export async function fetchSpacesByUser(username) {
  const q = query(collection(db, "spaces"), where("username", "==", username));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Delete a space by document id
export async function deleteSpace(spaceId) {
  return deleteDoc(doc(db, "spaces", spaceId));
}