const nodes = [
  { id: "travel", label: "Travel", x: 50, y: 8, state: "mastered" },
  { id: "airport", label: "Airport", x: 25, y: 35, state: "learning" },
  { id: "hotel", label: "Hotel", x: 50, y: 35, state: "mastered" },
  { id: "transport", label: "Transport", x: 75, y: 35, state: "learning" },
  { id: "passport", label: "Passport", x: 14, y: 68, state: "weak" },
  { id: "booking", label: "Booking", x: 39, y: 70, state: "learning" },
  { id: "train", label: "Train", x: 68, y: 70, state: "unknown" },
  { id: "customs", label: "Customs", x: 88, y: 70, state: "unknown" },
];

export default function SkillMap() {
  return (
    <section className="panel skill-panel" id="skill-map">
      <div className="section-heading">
        <div><span className="eyebrow">KNOWLEDGE GRAPH</span><h2>Travel skill map</h2></div>
        <div className="legend"><span><i className="dot mastered" />Mastered</span><span><i className="dot learning" />Learning</span><span><i className="dot weak" />Weak</span></div>
      </div>
      <div className="skill-map">
        <svg className="skill-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="50" y1="16" x2="25" y2="42" />
          <line x1="50" y1="16" x2="50" y2="42" />
          <line x1="50" y1="16" x2="75" y2="42" />
          <line x1="25" y1="43" x2="14" y2="76" />
          <line x1="50" y1="43" x2="39" y2="77" />
          <line x1="75" y1="43" x2="68" y2="77" />
          <line x1="75" y1="43" x2="88" y2="77" />
        </svg>
        {nodes.map((node) => (
          <button className={`skill-node ${node.state}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} key={node.id} title={`${node.label} · ${node.state}`}>
            <span>{node.state === "mastered" ? "✓" : node.state === "weak" ? "!" : "•"}</span>
            <strong>{node.label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
