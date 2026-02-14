import GridView from "../GridView";
import type { CSVGridProps } from "./types";
import "./styles.css";

export default function CSVGrid(props: CSVGridProps) {
  return (
    <div className="csv-grid-shell">
      <GridView {...props} />
    </div>
  );
}
