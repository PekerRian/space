import { useLocation, useNavigate } from "react-router-dom";
import React, { useState } from "react";
import "./Navbar.css";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

/**
 * Props:
 *   username: string | undefined
 */
export default function Navbar({ username }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { account } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) =>
    location.pathname === path ||
    (path !== "/" && location.pathname.startsWith(path));

  // Helper to get address string
  const getAddressStr = () => {
    if (!account?.address) return null;
    if (typeof account.address === "string") return account.address;
    if (typeof account.address.toString === "function") return account.address.toString();
    return JSON.stringify(account.address);
  };

  const shortAddress = (() => {
    const addr = getAddressStr();
    if (!addr || typeof addr !== "string") return null;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  })();

  // Close dropdown on navigation (mobile)
  React.useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <nav className={`navbar${mobileOpen ? " open" : ""}`}>
      <button
        className="navbar-menu-toggle"
        aria-label="Open navigation menu"
        onClick={() => setMobileOpen((v) => !v)}
        style={{ display: "none" }}
      >
        &#9776;
      </button>
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
        <button
          className={`navbar-tab-btn${isActive("/flowers") ? " active" : ""}`}
          onClick={() => navigate("/flowers")}
          type="button"
        >
          Flowers
        </button>
        <button
          className={`navbar-tab-btn${isActive("/upvotes") ? " active" : ""}`}
          onClick={() => navigate("/upvotes")}
          type="button"
        >
          Upvotes
        </button>
        <div style={{ marginLeft: "auto" }}>
          <WalletSelector className="wallet-selector-btn" />
        </div>
        {/* Show username if present, else fallback to address */}
        {(username || shortAddress) && (
          <span className="navbar-username" style={{ marginLeft: 16 }}>
            {username ? username : shortAddress}
          </span>
        )}
      </div>
    </nav>
  );
}