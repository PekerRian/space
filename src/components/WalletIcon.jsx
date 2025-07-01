// Add a wallet outline icon for the connect button
export const WalletIcon = ({ className = "", ...props }) => (
  <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {/* Only the wallet body and details, no outer circle or border */}
    <rect x="2" y="7" width="20" height="14" rx="4"/>
    <path d="M16 3v4M8 3v4M2 11h20"/>
    <circle cx="17.5" cy="14.5" r="1.5"/>
  </svg>
);
