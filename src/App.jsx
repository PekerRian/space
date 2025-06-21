import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "./firebase";
import Register from "./components/Register";


const db = getFirestore(app);

export default function App() {
  const { account } = useWallet();
  const [userExists, setUserExists] = useState(null);

  useEffect(() => {
    if (!account?.address) return;
    setUserExists(null); // set loading
    const checkUser = async () => {
      const userRef = doc(db, "users", account.address);
      const userSnap = await getDoc(userRef);
      setUserExists(userSnap.exists());
    };
    checkUser();
  }, [account?.address]);

  if (!account?.address) return <p>Please connect your wallet!</p>;
  if (userExists === null) return <p>Checking user...</p>;
  if (userExists === false) return <Register address={account.address} />;
  return <MainAppContent />;
}