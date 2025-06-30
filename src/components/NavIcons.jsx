// Outline SVG icons for mobile navbar (glow via CSS)
// You can adjust the SVGs for your preferred style

export const CalendarIcon = ({ className = "", ...props }) => (
  <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="5" width="18" height="16" rx="3"/>
    <path d="M16 3v4M8 3v4M3 9h18"/>
  </svg>
);

export const UserIcon = ({ className = "", ...props }) => (
  <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="8.5" r="4.5"/>
    <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6"/>
  </svg>
);

export const CoinIcon = ({ className = "", ...props }) => (
  <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <ellipse cx="12" cy="12" rx="9" ry="7"/>
    <path d="M3 12c0 3.87 4.03 7 9 7s9-3.13 9-7"/>
    <path d="M3 12c0-3.87 4.03-7 9-7s9 3.13 9 7"/>
    <path d="M12 7v10"/>
  </svg>
);

export const FistIcon = ({ className = "", ...props }) => (
  <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="12" width="20" height="8" rx="4"/>
    <rect x="6" y="4" width="4" height="8" rx="2"/>
    <rect x="10" y="4" width="4" height="8" rx="2"/>
    <rect x="14" y="6" width="4" height="6" rx="2"/>
  </svg>
);
