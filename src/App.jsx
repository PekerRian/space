import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AptosWalletAdapterProvider, useWallet } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import Navbar from "./components/Navbar";
import CalendarPage from "./pages/CalendarPage";
import UserTab from "./pages/UserTab";
import WalletAuth from "./components/WalletAuth";
import Spaces from "./components/Spaces";
import Flowers from "./pages/Flowers";
import Upvotes from "./pages/Upvotes";
import SupportModal from "./components/Support";
import NotFoundPage from "./pages/NotFoundPage";

import "@aptos-labs/wallet-adapter-ant-design/dist/index.css";
import "antd/dist/reset.css";
import "./footer-glow.css";
import "./calendar-modal-smaller.css";
import "./calendar-custom.css";
import "./compact-smaller.css";

// Simple Modal for registration popup
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="calendar-modal-overlay" onClick={onClose}>
      <div className="calendar-modal-content" onClick={e => e.stopPropagation()}>
        <button
          className="calendar-modal-close"
          onClick={onClose}
          aria-label="Close"
        >×</button>
        {children}
      </div>
    </div>
  );
}

// Animated pixel font loading buffer
export function LoadingBuffer() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => (d + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="loading-buffer-bg">
      <span className="loading-buffer-text">
        Loading{'.'.repeat(dots)}
      </span>
    </div>
  );
}

function SupportCorner({ mobile }) {
  const [open, setOpen] = React.useState(false);
  const text = "support this app";
  return (
    <>
      <div
        className={
          mobile
            ? "support-corner support-corner-mobile support-corner-mobile-bg"
            : "support-corner support-corner-desktop"
        }
        onClick={() => setOpen(true)}
        title="Support this app"
      >
        <svg width="54" height="54" viewBox="0 0 32 32" className="support-corner-svg">
          {/* Pixel heart shape */}
          <rect x="12" y="6" width="2" height="2" fill="#00bfff" />
          <rect x="18" y="6" width="2" height="2" fill="#00bfff" />
          <rect x="10" y="8" width="2" height="2" fill="#00bfff" />
          <rect x="12" y="8" width="2" height="2" fill="#00bfff" />
          <rect x="14" y="8" width="2" height="2" fill="#00bfff" />
          <rect x="16" y="8" width="2" height="2" fill="#00bfff" />
          <rect x="18" y="8" width="2" height="2" fill="#00bfff" />
          <rect x="20" y="8" width="2" height="2" fill="#00bfff" />
          <rect x="8" y="10" width="2" height="2" fill="#00bfff" />
          <rect x="10" y="10" width="2" height="2" fill="#00bfff" />
          <rect x="12" y="10" width="2" height="2" fill="#00bfff" />
          <rect x="14" y="10" width="2" height="2" fill="#00bfff" />
          <rect x="16" y="10" width="2" height="2" fill="#00bfff" />
          <rect x="18" y="10" width="2" height="2" fill="#00bfff" />
          <rect x="20" y="10" width="2" height="2" fill="#00bfff" />
          <rect x="22" y="10" width="2" height="2" fill="#00bfff" />
          <rect x="8" y="12" width="2" height="2" fill="#00bfff" />
          <rect x="10" y="12" width="2" height="2" fill="#00bfff" />
          <rect x="12" y="12" width="2" height="2" fill="#00bfff" />
          <rect x="14" y="12" width="2" height="2" fill="#00bfff" />
          <rect x="16" y="12" width="2" height="2" fill="#00bfff" />
          <rect x="18" y="12" width="2" height="2" fill="#00bfff" />
          <rect x="20" y="12" width="2" height="2" fill="#00bfff" />
          <rect x="22" y="12" width="2" height="2" fill="#00bfff" />
          <rect x="10" y="14" width="2" height="2" fill="#00bfff" />
          <rect x="12" y="14" width="2" height="2" fill="#00bfff" />
          <rect x="14" y="14" width="2" height="2" fill="#00bfff" />
          <rect x="16" y="14" width="2" height="2" fill="#00bfff" />
          <rect x="18" y="14" width="2" height="2" fill="#00bfff" />
          <rect x="20" y="14" width="2" height="2" fill="#00bfff" />
          <rect x="12" y="16" width="2" height="2" fill="#00bfff" />
          <rect x="14" y="16" width="2" height="2" fill="#00bfff" />
          <rect x="16" y="16" width="2" height="2" fill="#00bfff" />
          <rect x="18" y="16" width="2" height="2" fill="#00bfff" />
          <rect x="14" y="18" width="2" height="2" fill="#00bfff" />
          <rect x="16" y="18" width="2" height="2" fill="#00bfff" />
        </svg>
        <div className="support-corner-text-glow">
          {text.split("").map((char, i) => (
            <span key={i} className="support-corner-wave" style={{ animationDelay: `${i * 0.08}s` }}>{char === " " ? "\u00A0" : char}</span>
          ))}
        </div>
      </div>
      <SupportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AppRoutes() {
  const { account } = useWallet();
  const walletAddress = account?.address?.toString() || "";
  const [profileChecked, setProfileChecked] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 600);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch user data after wallet connect or registration
  useEffect(() => {
    if (!walletAddress) {
      setHasProfile(false);
      setProfileChecked(true);
      setUserData(null);
      setShowRegister(false);
      return;
    }
    setProfileChecked(false);
    getDoc(doc(db, "user accounts", walletAddress)).then(docSnap => {
      if (docSnap.exists()) {
        setHasProfile(true);
        setUserData(docSnap.data());
        setShowRegister(false);
      } else {
        setHasProfile(false);
        setUserData(null);
        setShowRegister(true);
      }
      setProfileChecked(true);
    });
  }, [walletAddress]);

  // After successful registration, refetch user data
  const handleProfileCreated = () => {
    if (walletAddress) {
      getDoc(doc(db, "user accounts", walletAddress)).then(docSnap => {
        if (docSnap.exists()) {
          setHasProfile(true);
          setUserData(docSnap.data());
          setShowRegister(false);
        }
      });
    }
  };

  if (!profileChecked) return <LoadingBuffer />;

  return (
    <>
      <Navbar username={userData?.username} />
      <Routes>
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/user" element={<UserTab />} />
        <Route path="/spaces" element={<Spaces walletAddress={walletAddress} />} />
        <Route path="/flowers" element={<Flowers />} />
        <Route path="/upvotes" element={<Upvotes walletAddress={walletAddress} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Modal open={showRegister} onClose={() => {}}>
        <WalletAuth walletAddress={walletAddress} onProfileCreated={handleProfileCreated} />
      </Modal>
      {/* Desktop: persistent floating, Mobile: below footer */}
      {!isMobile && !(isMobile && showRegister) && <SupportCorner />}
      <FooterTicker />
      {isMobile && !(isMobile && showRegister) && (
        <div className="support-corner-mobile-wrapper">
          <SupportCorner mobile />
        </div>
      )}
    </>
  );
}

function FooterTicker() {
  return (
    <div className="footer-ticker-bg">
      <div className="footer-ticker-track">
        <span className="footer-ticker-text">
          POWERED BY APTOS
          <span className="footer-ticker-gap">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          AIP-119 is now live for community vote 🗳️
          <span className="footer-ticker-gap">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          HashPalette is now <span className="footer-ticker-highlight">@AptosJapan_Org</span>!
          <span className="footer-ticker-gap">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </span>
        {/* Duplicate for seamless loop */}
        <span className="footer-ticker-text">
          POWERED BY APTOS
          <span className="footer-ticker-gap">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          AIP-119 is now live for community vote 🗳️
          <span className="footer-ticker-gap">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          HashPalette is now <span className="footer-ticker-highlight">@AptosJapan_Org</span>!
          <span className="footer-ticker-gap">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </span>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="app-zoom-wrapper">
      <AptosWalletAdapterProvider
        autoConnect={true}
        dappConfig={{ network: Network.TESTNET }}
        onError={error => {
          console.log("error", error);
        }}
      >
        <Router>
          <AppRoutes />
        </Router>
      </AptosWalletAdapterProvider>
    </div>
  );
}

export default App;