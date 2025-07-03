import { LoadingBuffer } from "../App";
import React from "react";

function Home() {
  const [loading, setLoading] = React.useState(false);
  // Simulate loading for demo (remove in prod)
  React.useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);
  if (loading) return <LoadingBuffer />;

  return (
    <div className="container animated-panel compact-smaller-bg compact-smaller compact-smaller-main">
      <h1 className="compact-smaller-title">Welcome!</h1>
      <p>This is a simple React + Firebase user profile app.</p>
    </div>
  );
}

export default Home;