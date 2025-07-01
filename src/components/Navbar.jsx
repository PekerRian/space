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

  // Helper for mobile: render icon button and label outside
  const renderMobileNavBtn = (isActive, onClick, Icon, label, extraClass = "") => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <button
        className={`navbar-tab-btn mobile-only${isActive ? " active" : ""} ${extraClass}`}
        onClick={onClick}
        type="button"
        aria-label={label}
      >
        <span className="navbar-icon-glow"><Icon /></span>
      </button>
      <span className={`navbar-label mobile-only${isActive ? " active" : ""}`}>{label}</span>
    </div>
  );

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
        {/* Mobile: icon + label below, Desktop: text only */}
        {renderMobileNavBtn(isActive("/calendar"), () => navigate("/calendar"), CalendarIcon, "Calendar")}
        {renderMobileNavBtn(isActive("/user"), () => navigate("/user"), UserIcon, "Profile")}
        {renderMobileNavBtn(isActive("/flowers"), () => navigate("/flowers"), CoinIcon, "Tip")}
        {renderMobileNavBtn(isActive("/upvotes"), () => navigate("/upvotes"), FistIcon, "Upvote")}
        <div style={{ marginLeft: "auto", display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            className={`wallet-selector-btn mobile-only${isActive("/connect") ? " active" : ""}`}
            type="button"
            aria-label="Connect"
            tabIndex={0}
            style={{ background: 'none', border: 'none', outline: 'none', padding: 0, margin: 0 }}
          >
            <span className="navbar-icon-glow"><WalletIcon /></span>
          </button>
          <span className={`navbar-label mobile-only${isActive("/connect") ? " active" : ""}`}>Connect</span>
        </div>
        {/* Desktop: show username/address only if present */}
        {(username || shortAddress) && (
          <span className="navbar-username desktop-only" style={{ marginLeft: 16 }}>
            {username ? username : shortAddress}
          </span>
        )}
      </div>
    </nav>
  );
}