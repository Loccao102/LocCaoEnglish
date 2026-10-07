"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./WordGraphExplorer.module.css";

type Node = { id: string; label: string; x: number; y: number; kind: string; definition: string };
type Edge = { from: string; to: string; label: string };

export default function WordGraphExplorer({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const [selected, setSelected] = useState("travel");
  const active = nodes.find(node => node.id === selected)!;
  const nodeByID = (id: string) => nodes.find(node => node.id === id)!;
  return <section className={styles.explorer} aria-label="Word graph exploration">
    <header className={styles.toolbar}>
      <div><span className="eyebrow">EXPLORE · TRAVEL WORDS</span><h1>Travel word constellation</h1><p>Follow connections and discover how words fit together.</p></div>
      <Link className="button primary" href="/word-graph/practice">Practise connections →</Link>
    </header>
    <p className={styles.notice}>Study mode · explore freely. Looking at the map does not earn XP.</p>
    <div className={styles.grid}>
      <div className={styles.canvas} role="group" aria-label="Travel word map">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {edges.map(edge => <line key={edge.from + edge.to} x1={nodeByID(edge.from).x} y1={nodeByID(edge.from).y} x2={nodeByID(edge.to).x} y2={nodeByID(edge.to).y} />)}
        </svg>
        {nodes.map(node => <button key={node.id} className={styles.node} aria-label={`Explore ${node.label}`} aria-pressed={selected === node.id} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => setSelected(node.id)}><small>{node.kind}</small><strong>{node.label}</strong></button>)}
      </div>
      <aside className={styles.inspector} aria-label="Word details">
        <span className="eyebrow">SELECTED WORD</span>
        <h2>{active.label}</h2><small>{active.kind}</small><p>{active.definition}</p>
        <div className={styles.connections}>
          <h3>Connections</h3>
          {edges.filter(edge => edge.from === active.id || edge.to === active.id).map(edge => <button key={edge.from + edge.to} onClick={() => setSelected(edge.from === active.id ? edge.to : edge.from)}>
            <b>{nodeByID(edge.from).label}</b><span>{edge.label} →</span><b>{nodeByID(edge.to).label}</b>
          </button>)}
        </div>
      </aside>
    </div>
  </section>;
}
