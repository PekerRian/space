import React, { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { transferApt } from "./aptosTransfer";

const SUPPORT_ADDRESS = "0x19619ad8c1ff22b0d9a34d605546c1cb42d7a627da27ff10c86e7c6a8da2f09f";

export default function SupportModal({ open, onClose }) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const { account, signAndSubmitTransaction } = useWallet();

  if (!open) return null;
  return (
    <div className="calendar-modal-overlay" style={{ zIndex: 10000 }} onClick={onClose}>
      <div className="calendar-modal-content" style={{ maxWidth: 420, minWidth: 260, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <button
          className="calendar-modal-close"
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 18, background: 'none', border: 'none', color: '#ffe066', fontSize: 24, cursor: 'pointer' }}
        >×</button>
        <h2 style={{ color: '#00bfff', fontFamily: '"Press Start 2P", monospace', fontSize: '1.1em', marginBottom: 18 }}>Support This App</h2>
        <form
          onSubmit={async e => {
            e.preventDefault();
            setStatus("");
            if (!account) {
              setStatus("Connect your wallet first.");
              return;
            }
            try {
              await transferApt(signAndSubmitTransaction, account, SUPPORT_ADDRESS, amount);
              setStatus("success");
              setAmount("");
            } catch (err) {
              let msg = "Transfer failed.";
              if (err && typeof err === "object") {
                if (err.message) msg += " " + err.message;
                else if (typeof err.toString === "function") msg += " " + err.toString();
                else msg += " " + JSON.stringify(err);
              } else if (typeof err === "string") {
                msg += " " + err;
              } else {
                msg += " Unknown error.";
              }
              setStatus(msg);
            }
          }}
          style={{ marginTop: 18 }}
        >
          <input
            type="number"
            min="0.00000001"
            step="0.00000001"
            placeholder="Amount (APT)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{
              width: '70%',
              padding: '0.7em 1em',
              borderRadius: 10,
              border: '1.5px solid #00bfff',
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 15,
              marginBottom: 10,
              background: '#f7f9fa',
              color: '#181a2b',
              boxSizing: 'border-box',
              outline: 'none',
              textAlign: 'center',
              boxShadow: '0 0 8px #00bfff44',
            }}
            required
          />
          <button
            type="submit"
            style={{
              background: '#00bfff',
              color: '#181a2b',
              border: 'none',
              borderRadius: 10,
              fontFamily: '"Press Start 2P", monospace',
              fontWeight: 700,
              fontSize: 15,
              padding: '0.7em 1.5em',
              marginLeft: 8,
              boxShadow: '0 0 12px #00bfff88',
              cursor: 'pointer',
              marginTop: 8
            }}
          >
            Send
          </button>
        </form>
        {status === "success" && <div style={{ color: '#36b37e', fontSize: 15, marginTop: 14, fontFamily: '"Press Start 2P", monospace' }}>a little help goes a long way</div>}
        {status && status !== "success" && <div style={{ color: '#e15d5d', fontSize: 14, marginTop: 10 }}>{status}</div>}
        <div style={{ color: '#ffe066', fontSize: 13, marginTop: 10 }}>
          Thank you for your support!
        </div>
      </div>
    </div>
  );
}
