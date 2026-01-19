declare module 'javascript-astar' {
  export interface GridNode {
    x: number;
    y: number;
    weight: number;
    f: number;
    g: number;
    h: number;
    visited: boolean;
    closed: boolean;
    parent: GridNode | null;
  }

  export class Graph {
    grid: GridNode[][];
    nodes: GridNode[];
    diagonal: boolean;

    constructor(gridIn: number[][], options?: { diagonal?: boolean });

    init(): void;
    cleanDirty(): void;
    markDirty(node: GridNode): void;
    neighbors(node: GridNode): GridNode[];
  }

  export namespace astar {
    function search(
      graph: Graph,
      start: GridNode,
      end: GridNode,
      options?: {
        closest?: boolean;
        heuristic?: (pos0: GridNode, pos1: GridNode) => number;
      }
    ): GridNode[];

    function cleanNode(node: GridNode): void;
  }

  export const heuristics: {
    manhattan: (pos0: GridNode, pos1: GridNode) => number;
    diagonal: (pos0: GridNode, pos1: GridNode) => number;
  };
}
