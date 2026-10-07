import WordGraphExplorer from "@/components/WordGraphExplorer";
import graph from "@/backend/internal/learning/word_graph_catalog.json";

export default function Page() {
  // Only the study projection crosses the server/client boundary. Questions and
  // private grading data are never props of the exploration or practice client.
  const edges = graph.edges.map(({ from, to, label }) => ({ from, to, label }));
  return <div className="page-wrap"><WordGraphExplorer nodes={graph.nodes} edges={edges} /></div>;
}
