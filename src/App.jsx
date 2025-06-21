import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import Navbar from "./components/Navbar";
import CalendarPage from "./pages/CalendarPage";
import UserTab from "./pages/UserTab";
import WalletAuth from "./components/WalletAuth"; // <-- You'll create this

// Add CSS imports for Ant Design/Aptos Wallet Adapter
import "@aptos-labs/wallet-adapter-ant-design/dist/index.css";
import "antd/dist/reset.css"; // or "antd/dist/antd.css" if using AntD v4

function App() {
  return (
    <AptosWalletAdapterProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/user" element={<UserTab />} />
        </Routes>
      </Router>
    </AptosWalletAdapterProvider>
  );
}

export default App;