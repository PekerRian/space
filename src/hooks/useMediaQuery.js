import { useState, useEffect } from "react";

// Returns true if window width <= maxWidth
export function useMediaQuery(maxWidth) {
  const [isMatch, setIsMatch] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= maxWidth : false
  );

  useEffect(() => {
    function handleResize() {
      setIsMatch(window.innerWidth <= maxWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [maxWidth]);

  return isMatch;
}
