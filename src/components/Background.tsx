/** Two deep oxblood glows that drift very slowly, and two static hairline orbits (§4.3: background only). */
export function Background() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="glow a" />
      <div className="glow b" />
      <svg
        className="scene-orbits"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <ellipse className="wide-only" cx="1160" cy="118" rx="600" ry="88" />
        <ellipse
          cx="700"
          cy="900"
          rx="920"
          ry="200"
          transform="rotate(-3 700 900)"
        />
      </svg>
    </div>
  );
}
