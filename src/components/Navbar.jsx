import { useLocation, useNavigate } from "react-router-dom";
import "./Navbar.css";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { account } = useWallet();

  const isActive = (path) =>
    location.pathname === path ||
    (path !== "/" && location.pathname.startsWith(path));

  // If you want to debug:
  // console.log("account:", account);

  // Helper to get address string
  const getAddressStr = () => {
    if (!account?.address) return null;
    if (typeof account.address === "string") return account.address;
    // Some wallets return address as Uint8Array or object
    if (typeof account.address.toString === "function") return account.address.toString();
    // Fallback, JSON stringify
    return JSON.stringify(account.address);
  };

  const shortAddress = (() => {
    const addr = getAddressStr();
    if (!addr || typeof addr !== "string") return null;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  })();

  return (
    <nav className="navbar">
      <div className="navbar-btn-group">
        <button
          className={`navbar-tab-btn${isActive("/calendar") ? " active" : ""}`}
          onClick={() => navigate("/calendar")}
          type="button"
        >
          Calendar
        </button>
        <button
          className={`navbar-tab-btn${isActive("/user") ? " active" : ""}`}
          onClick={() => navigate("/user")}
          type="button"
        >
          User Tab
        </button>
        <div style={{ marginLeft: "auto" }}>
          <WalletSelector />
        </div>
        {shortAddress && (
          <span className="navbar-username" style={{ marginLeft: 16 }}>
            {shortAddress}
          </span>
        )}
      </div>
    </nav>
  );
}