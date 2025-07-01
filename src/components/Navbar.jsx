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
    <div className={`mobile-only ${extraClass}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <span
        className={`navbar-icon-glow${isActive ? ' active' : ''}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={label}
        style={{ cursor: 'pointer', outline: 'none', border: 'none', background: 'none', padding: 0, margin: 0 }}
      >
        <Icon />
      </span>
      <span className={`navbar-label${isActive ? " active" : ""}`}>{label}</span>
    </div>
  );

  return (
    <nav className={`navbar${mobileOpen ? " open" : ""}`}>
      {/* Desktop nav: text buttons only, no icons */}
      <div className="navbar-btn-group">
        {/* Desktop: text buttons, Mobile: icons (CSS controls visibility) */}
        <button
          className={`navbar-tab-btn desktop-only${isActive("/calendar") ? " active" : ""}`}
          onClick={() => navigate("/calendar")}
          type="button"
        >
          Calendar
        </button>
        <button
          className={`navbar-tab-btn desktop-only${isActive("/user") ? " active" : ""}`}
          onClick={() => navigate("/user")}
          type="button"
        >
          Profile
        </button>
        <button
          className={`navbar-tab-btn desktop-only${isActive("/flowers") ? " active" : ""}`}
          onClick={() => navigate("/flowers")}
          type="button"
        >
          Tip
        </button>
        <button
          className={`navbar-tab-btn desktop-only${isActive("/upvotes") ? " active" : ""}`}
          onClick={() => navigate("/upvotes")}
          type="button"
        >
          Upvote
        </button>
        <div className="desktop-only" style={{ marginLeft: 24 }}>
          <WalletSelector className="wallet-selector-btn" />
        </div>
        {/* Mobile: icon-only nav buttons */}
        {renderMobileNavBtn(isActive("/calendar"), () => navigate("/calendar"), CalendarIcon, "Calendar", "mobile-only")}
        {renderMobileNavBtn(isActive("/user"), () => navigate("/user"), UserIcon, "Profile", "mobile-only")}
        {renderMobileNavBtn(isActive("/flowers"), () => navigate("/flowers"), CoinIcon, "Tip", "mobile-only")}
        {renderMobileNavBtn(isActive("/upvotes"), () => navigate("/upvotes"), FistIcon, "Upvote", "mobile-only")}
        {renderMobileNavBtn(isActive("/connect"), () => navigate("/connect"), WalletIcon, "Connect", "mobile-only")}
        {(username || shortAddress) && (
          <span className="navbar-username desktop-only" style={{ marginLeft: 16 }}>
            {username ? username : shortAddress}
          </span>
        )}
      </div>
    </nav>
  );
}