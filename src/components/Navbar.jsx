import { useLocation, useNavigate } from "react-router-dom";
import React, { useState } from "react";
import "./Navbar.css";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { CalendarIcon, UserIcon, CoinIcon, FistIcon } from "./NavIcons";
import { WalletIcon } from "./WalletIcon";

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
          <span className="navbar-icon-glow mobile-only"><CalendarIcon /></span>
          <span className="navbar-label mobile-only">Calendar</span>
          <span className="desktop-only">Calendar</span>
        </button>
        <button
          className={`navbar-tab-btn${isActive("/user") ? " active" : ""}`}
          onClick={() => navigate("/user")}
          type="button"
        >
          <span className="navbar-icon-glow mobile-only"><UserIcon /></span>
          <span className="navbar-label mobile-only">Profile</span>
          <span className="desktop-only">User Tab</span>
        </button>
        <button
          className={`navbar-tab-btn${isActive("/flowers") ? " active" : ""}`}
          onClick={() => navigate("/flowers")}
          type="button"
        >
          <span className="navbar-icon-glow mobile-only"><CoinIcon /></span>
          <span className="navbar-label mobile-only">Tip</span>
          <span className="desktop-only">Flowers</span>
        </button>
        <button
          className={`navbar-tab-btn${isActive("/upvotes") ? " active" : ""}`}
          onClick={() => navigate("/upvotes")}
          type="button"
        >
          <span className="navbar-icon-glow mobile-only"><FistIcon /></span>
          <span className="navbar-label mobile-only">Upvote</span>
          <span className="desktop-only">Upvotes</span>
        </button>
        <div style={{ marginLeft: "auto", display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <WalletSelector className="wallet-selector-btn">
            <span className="navbar-icon-glow mobile-only"><WalletIcon /></span>
            <span className="navbar-label mobile-only">Connect</span>
          </WalletSelector>
          <span className="navbar-label desktop-only">Connect</span>
        </div>
        {(username || shortAddress) && (
          <span className="navbar-username" style={{ marginLeft: 16 }}>
            {username ? username : shortAddress}
          </span>
        )}
      </div>
    </nav>
  );
}