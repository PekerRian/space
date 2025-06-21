import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "./firebase";
import Register from "./components/Register";
import MainAppContent from "./MainAppContent"; // your main app

const db = getFirestore(app);

function App() {
  const { account } = useWallet();
  const [userExists, setUserExists] = useState(null); // null = checking, false = needs register, true = exists

  useEffect(() => {
    if (!account?.address) return;
    setUserExists(null);
    const check = async () => {
      const userRef = doc(db, "users", account.address);
      const snap = await getDoc(userRef);
      setUserExists(snap.exists());
    };
    check();
  }, [account?.address]);

  if (!account?.address) {
    return <p>Please connect your wallet!</p>;
  }
  if (userExists === false) {
    return <Register address={account.address} />;
  }
  if (userExists === null) {
    return <p>Loading...</p>;
  }
  return <MainAppContent />;
}

export default App;