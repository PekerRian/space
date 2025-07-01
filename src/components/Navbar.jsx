import { useLocation, useNavigate } from "react-router-dom";
import React, { useState } from "react";
import "./Navbar.css";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { CalendarIcon, UserIcon, CoinIcon, FistIcon } from "./NavIcons";
import { WalletIcon } from "./WalletIcon";
import { useMediaQuery } from "../hooks/useMediaQuery";

/**
 * Props:
 *   username: string | undefined
 */
export default function Navbar({ username }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { account } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery(700);

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

  // Helper for mobile: render icon button and label stacked vertically
  const renderMobileNavBtn = (isActive, onClick, Icon, label, extraClass = "") => (
    <div className={extraClass} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
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
      {isMobile ? (
        <div className="navbar-btn-group">
          <div className="navbar-icons-row">
            {renderMobileNavBtn(isActive("/calendar"), () => navigate("/calendar"), CalendarIcon, "Calendar")}
            {renderMobileNavBtn(isActive("/user"), () => navigate("/user"), UserIcon, "Profile")}
            {renderMobileNavBtn(isActive("/flowers"), () => navigate("/flowers"), CoinIcon, "Tip")}
            {renderMobileNavBtn(isActive("/upvotes"), () => navigate("/upvotes"), FistIcon, "Upvote")}
          </div>
          <div className="navbar-wallet-row">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0, maxWidth: 80 }}>
              <WalletSelector className="wallet-selector-btn" style={{ width: 38, height: 38, borderRadius: '50%', padding: 0, margin: '0 auto', boxShadow: '0 0 8px 2px #00ffea44', border: '2.5px solid #00ffea', background: '#181c36', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
            </div>
          </div>
        </div>
      ) : (
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
            Profile
          </button>
          <button
            className={`navbar-tab-btn${isActive("/flowers") ? " active" : ""}`}
            onClick={() => navigate("/flowers")}
            type="button"
          >
            Tip
          </button>
          <button
            className={`navbar-tab-btn${isActive("/upvotes") ? " active" : ""}`}
            onClick={() => navigate("/upvotes")}
            type="button"
          >
            Upvote
          </button>
          <div style={{ marginLeft: 24 }}>
            <WalletSelector className="wallet-selector-btn" connectButtonText="Connect" />
          </div>
          {(username || shortAddress) && (
            <span className="navbar-username" style={{ marginLeft: 16 }}>
              {username ? username : shortAddress}
            </span>
          )}
        </div>
      )}
    </nav>
  );
}