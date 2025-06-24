import React from "react";

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0c1b",
      color: "#00ffea",
      fontFamily: "'Press Start 2P', 'VT323', 'Consolas', 'monospace', Arial, sans-serif",
      fontSize: "2.2em",
      flexDirection: "column"
    }}>
      <div>404 - Page Not Found</div>
      <a href="/" style={{ color: "#ffe066", marginTop: 32, fontSize: "0.7em" }}>Go Home</a>
    </div>
  );
}
