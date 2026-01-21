// Lightweight A* pathfinder for tile grids. Avoids tiles with buildings as blocked.
// API: findPath([sx,sy],[tx,ty], world) -> array of [x,y] or null.

export default class AStar {
  constructor() {
    this.openSet = [];
  }

  findPath(start, target, world) {
    const sKey = start.join(',');
    const tKey = target.join(',');
    if (!world.inBounds(target[0], target[1])) return null;

    const cols = world.w, rows = world.h;
    const closed = new Set();
    const open = new Map(); // key -> node
    const pq = new TinyHeap((a,b)=>a.f-b.f);

    function key(x,y){ return x+','+y; }
    function heuristic(a,b){ return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]); }

    const startNode = { pos: start, g: 0, f: heuristic(start,target), parent: null };
    pq.push(startNode);
    open.set(key(...start), startNode);

    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

    while (pq.size()) {
      const current = pq.pop();
      const ck = key(...current.pos);
      if (closed.has(ck)) continue;
      if (current.pos[0] === target[0] && current.pos[1] === target[1]) {
        // reconstruct
        const path = [];
        let cur = current;
        while (cur) {
          path.unshift(cur.pos);
          cur = cur.parent;
        }
        // drop first (current tile) because caller already is there
        path.shift();
        return path;
      }
      closed.add(ck);

      for (let d of dirs) {
        const nx = current.pos[0] + d[0], ny = current.pos[1] + d[1];
        if (!world.inBounds(nx, ny)) continue;
        const tile = world.tiles[ny][nx];
        // blocked if building tile
        if (tile.building) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const ng = current.g + 1;
        const existing = open.get(nk);
        if (!existing || ng < existing.g) {
          const node = { pos: [nx, ny], g: ng, f: ng + heuristic([nx,ny], target), parent: current };
          open.set(nk, node);
          pq.push(node);
        }
      }
    }
    return null;
  }
}

// Tiny binary heap implementation
class TinyHeap {
  constructor(compare){ this.data=[]; this.compare=compare || ((a,b)=>a-b); }
  push(v){ this.data.push(v); this._siftUp(); }
  pop(){ if (!this.data.length) return null; const r=this.data[0]; const l=this.data.pop(); if (this.data.length){ this.data[0]=l; this._siftDown(); } return r; }
  size(){ return this.data.length; }
  _siftUp(){ let i=this.data.length-1; while(i>0){ const p=(i-1)>>1; if (this.compare(this.data[i], this.data[p])<0){ [this.data[i],this.data[p]]=[this.data[p],this.data[i]]; i=p; } else break; } }
  _siftDown(){ let i=0; const n=this.data.length; while(true){ let l=2*i+1, r=2*i+2, smallest=i; if (l<n && this.compare(this.data[l], this.data[smallest])<0) smallest=l; if (r<n && this.compare(this.data[r], this.data[smallest])<0) smallest=r; if (smallest!==i){ [this.data[i],this.data[smallest]]=[this.data[smallest],this.data[i]]; i=smallest; } else break; } }
}