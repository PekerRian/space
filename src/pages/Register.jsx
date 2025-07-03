import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "./firebase";
import Register from "./components/Register";
import MainAppContent from "./MainAppContent"; // your main app
import { LoadingBuffer } from "../App";

const db = getFirestore(app);

function App() {
  const { account } = useWallet();
  const [userExists, setUserExists] = useState(null); // null = checking, false = needs register, true = exists

  useEffect(() => {
    if (!account?.address) return;
    setUserExists(null);
    const check = async () => {
      const userRef = doc(db, "user accounts", account.address);
      const snap = await getDoc(userRef);
      setUserExists(snap.exists());
    };
    check();
  }, [account?.address]);

  if (!account?.address) {
    return <p className="animated-panel compact-smaller-bg compact-smaller compact-smaller-main">Please connect your wallet!</p>;
  }
  if (userExists === false) {
    return <Register address={account.address} className="animated-panel compact-smaller-bg compact-smaller compact-smaller-main" />;
  }
  if (userExists === null) {
    return <LoadingBuffer />;
  }
  return <MainAppContent className="animated-panel compact-smaller-bg compact-smaller compact-smaller-main" />;
}

export default App;