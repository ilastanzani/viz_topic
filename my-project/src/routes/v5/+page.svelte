<!-- src/routes/v5/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { clusterKeywords, TREE, aggClusters, colorScale } from '$lib/data.js';

  // ── Reactive state (template only) ───────────────────────────────────────────
  let currentLevel = $state(1);
  let showDendro   = $state(false);
  let showKw       = $state(true);
  let listTitle    = $state('Click a label to see keywords');
  let displayKws   = $state([]);

  // ── Plain vars (D3 world) ─────────────────────────────────────────────────────
  let selectedId = null;
  let hoveredId  = null;
  let _cells     = [];
  let _gridDims  = { cols: 1, rows: 1, cellW: 100, cellH: 100 }; // stored for sublabels
  let _fineColorById = new Map();
  let _midColorById = new Map(); 
  let _coarseColorById  = new Map(); 
  let _fineParentById = new Map();
  let ro         = null;

  const getMap    = () => document.getElementById('map-svg');
  const getDendro = () => document.getElementById('dendro-svg');

  function splitBigram(kw) {
    const raw = String(kw ?? '').trim();
    const normalized = raw.includes(' ') ? raw : raw.replace(/[_-]+/g, ' ');
    const parts = normalized.split(/\s+/).filter(Boolean);
    return parts.length === 2 ? parts : null;
  }

  // ── Tree helpers ──────────────────────────────────────────────────────────────
  function collectMergeDistances(node, out = []) {
    if (node.dist !== undefined && node.dist > 0) out.push(node.dist);
    if (node.children) node.children.forEach(c => collectMergeDistances(c, out));
    return out;
  }
  function cutTree(node, threshold) {
    if (!node.children || (node.dist !== undefined && node.dist <= threshold)) return [node];
    return node.children.flatMap(c => cutTree(c, threshold));
  }
  function leafIds(node) {
    if (!node.children) return [node.id];
    return node.children.flatMap(leafIds);
  }

  const allDists     = [...new Set(collectMergeDistances(TREE))].sort((a, b) => a - b);
  const maxDist      = TREE.dist ?? allDists.at(-1) ?? 1;
  const quantileDist = q => allDists[Math.max(0, Math.floor(q * (allDists.length - 1)))];

const LEVEL_THRESHOLDS = [null, quantileDist(0.25), quantileDist(0.60), quantileDist(0.92)];
const LEVEL_LABELS     = ['Keywords', 'Fine', 'Mid', 'Coarse'];
const LEVEL_ICONS      = ['○', '◎', '◉', '⬤'];

  function buildLevelClusters(level) {
    if (level === 0) return [];
    const superNodes = cutTree(TREE, LEVEL_THRESHOLDS[level]);
    return superNodes.map((sn) => {
      const ids     = leafIds(sn);
      const bases   = aggClusters.filter(a => ids.includes(a.id));
      const kwcount = bases.reduce((s, a) => s + (a.kwcount ?? 0), 0) || ids.length;
      const cx      = bases.length ? d3.mean(bases, a => a.cx) : 0;
      const cy      = bases.length ? d3.mean(bases, a => a.cy) : 0;
      const kws     = ids.flatMap(id => clusterKeywords[id] ?? []);
      const kw0     = clusterKeywords[ids[0]]?.[0] ?? String(ids[0]);
      return { id: ids[0], ids, kwcount, cx, cy, kws, kw0 };
    });
  }

  const kwDots = (() => {
    const dots = [];
    const rng  = d3.randomNormal.source(d3.randomLcg(42))(0, 0.18);
    aggClusters.forEach(cl =>
      (clusterKeywords[cl.id] ?? []).forEach(kw =>
        dots.push({ kw, clusterId: cl.id, cx: cl.cx + rng(), cy: cl.cy + rng() })
      )
    );
    return dots;
  })();

  // ── Scales ────────────────────────────────────────────────────────────────────
  function makeScales(W, H, pad = 0.7) {
    const [x0, x1] = d3.extent(aggClusters, d => d.cx);
    const [y0, y1] = d3.extent(aggClusters, d => d.cy);
    return {
      xS: d3.scaleLinear().domain([x0-pad, x1+pad]).range([0, W]),
      yS: d3.scaleLinear().domain([y0-pad, y1+pad]).range([H, 0]),
    };
  }

  // ── Grid assignment ───────────────────────────────────────────────────────────
  function assignGrid(clusters, W, H, gap = 3) {
    const n    = clusters.length;
    if (n === 0) return { cells: [], cols: 0, rows: 0, cellW: W, cellH: H };

    const cols  = Math.ceil(Math.sqrt(n * W / H * 0.4));
    const rows  = Math.ceil(n / cols);
    const cellW = W / cols;
    const cellH = H / rows;

  const sorted = [...clusters].sort((a, b) => {
  const pa = _fineParentById.get(a.id) ?? a.id;
  const pb = _fineParentById.get(b.id) ?? b.id;

  // 1. Group by parent (this forces siblings together)
  if (pa !== pb) {
    return String(pa).localeCompare(String(pb), undefined, { numeric: true });
  }

  // 2. Within same parent → sort left to right
  return a.screenX - b.screenX;
});
    const used = new Set();

    const cells = sorted.map(c => {
      let col = Math.max(0, Math.min(cols - 1, Math.floor(c.screenX / cellW)));
      let row = Math.max(0, Math.min(rows - 1, Math.floor(c.screenY / cellH)));

      if (used.has(`${col},${row}`)) {
        let found = false;
        outer: for (let d = 1; d < cols + rows && !found; d++) {
          for (let dc = -d; dc <= d; dc++) {
            for (let dr = -d; dr <= d; dr++) {
              if (Math.abs(dc) + Math.abs(dr) !== d) continue;
              const nc = col + dc, nr = row + dr;
              if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && !used.has(`${nc},${nr}`)) {
                col = nc; row = nr; found = true;
                break outer;
              }
            }
          }
        }
      }
      used.add(`${col},${row}`);
      return { ...c, col, row };
    });

    return { cells, cols, rows, cellW, cellH };
  }

  function initHierarchyColors() {
  const fine   = buildLevelClusters(1).sort((a, b) => a.id - b.id);
  const mid = buildLevelClusters(2).sort((a, b) => a.id - b.id);
  const coarse  = buildLevelClusters(3).sort((a, b) => a.id - b.id);

  // ColorBrewer Set3 — 10 distinct colors, one per coarse cluster
  const palette10 = [
    '#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3',
    '#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd'
  ];

  _fineColorById   = new Map();
  _midColorById = new Map();
  _coarseColorById  = new Map();
  _fineParentById  = new Map();

  coarse.forEach((tc, tIdx) => {
    const color = palette10[tIdx % palette10.length];
    _coarseColorById.set(tc.id, color);

    const coarseLeafSet = new Set(tc.ids);

    // mid children of this coarse cluster
    const midKids = mid.filter(cc =>
      cc.ids.every(id => coarseLeafSet.has(id))
    );
    midKids.forEach(cc => {
      _midColorById.set(cc.id, color);

      // Fine children of this mid cluster
      const midLeafSet = new Set(cc.ids);
      const fineKids = fine.filter(fc =>
        fc.ids.every(id => midLeafSet.has(id))
      );
      fineKids.forEach(fc => {
        _fineColorById.set(fc.id, color);
        _fineParentById.set(fc.id, cc.id);
      });
    });
  });
}

 function clusterColor(id) {
  if (currentLevel === 1) return _fineColorById.get(id)   ?? colorScale(id);
  if (currentLevel === 2) return _midColorById.get(id) ?? colorScale(id);
  if (currentLevel === 3) return _coarseColorById.get(id)  ?? colorScale(id);
  return colorScale(id);
}

  function assignGridByHierarchy(clusters, W, H, parentById, gap = 3) {
  const n = clusters.length;
  if (n === 0) return { cells: [], cols: 0, rows: 0, cellW: W, cellH: H };

  const cols  = Math.ceil(Math.sqrt(n * W / H * 0.4));
  const rows  = Math.ceil(n / cols);
  const cellW = W / cols;
  const cellH = H / rows;

  const byParent = d3.group(clusters, c => parentById.get(c.id) ?? c.id);

  // Sort parent groups by mean screenX so left-to-right order is preserved
  const sortedParents = [...byParent.entries()]
    .sort(([, a], [, b]) => d3.mean(a, d => d.screenX) - d3.mean(b, d => d.screenX));

  const cells = [];
  let cursor = 0; // linear cell index across the grid

  for (const [pid, group] of sortedParents) {
    // Sort siblings within group left-to-right
    const sorted = [...group].sort((a, b) => a.screenX - b.screenX);

    // If adding this group would straddle a row boundary, push cursor to next row
    const currentCol = cursor % cols;
    if (currentCol !== 0 && currentCol + sorted.length > cols) {
      cursor += cols - currentCol; // pad to next row start
    }

    for (const c of sorted) {
      const col = cursor % cols;
      const row = Math.floor(cursor / cols);
      cells.push({ ...c, col, row });
      cursor++;
    }
  }

  return { cells, cols, rows, cellW, cellH };
}

  // ── Info panel ────────────────────────────────────────────────────────────────
  function refreshInfo() {
    const clusters = buildLevelClusters(currentLevel);
    const active   = clusters.find(c => c.id === (selectedId ?? hoveredId)) ?? null;
    if (currentLevel === 0) {
      displayKws = hoveredId !== null ? (clusterKeywords[hoveredId] ?? []) : [];
      listTitle  = hoveredId !== null ? `Cluster ${hoveredId} keywords` : 'Hover a dot to see its cluster';
    } else if (active) {
      displayKws = active.kws;
      listTitle  = `${active.kw0} — ${active.kws.length} keywords`;
    } else {
      displayKws = [];
      listTitle  = 'Click a label to see keywords';
    }
  }

  // ── Map ───────────────────────────────────────────────────────────────────────
  function drawMap() {
    const innerGap = 2;   // tight inside group
    const outerGap = 25;  // bigger separation between groups
    const el = getMap();
    if (!el) return;
    if (currentLevel === 0) { drawKeywordDots(el); return; }

    const clusters = buildLevelClusters(currentLevel);
    const rect = el.getBoundingClientRect();
    const W = rect.width || 600, H = rect.height || 500;
    const { xS, yS } = makeScales(W, H);
    const gap = 8;

    const fontScale = d3.scaleSqrt()
      .domain([d3.min(clusters, d => d.kwcount), d3.max(clusters, d => d.kwcount)])
      .range([9, 26]).clamp(true);

    const withScreen = clusters.map(c => ({
      ...c,
      screenX: xS(c.cx),
      screenY: yS(c.cy),
      fontSize: fontScale(c.kwcount),
    }));

    const { cells, cols, rows, cellW, cellH } = currentLevel === 1
      ? assignGridByHierarchy(withScreen, W, H, _fineParentById, gap)
      : assignGrid(withScreen, W, H, gap);
    _gridDims = { cols, rows, cellW, cellH, gap };

    _cells = cells.map(c => ({
      ...c,
      cellCX: (c.col + 0.5) * cellW,
      cellCY: (c.row + 0.5) * cellH,
    }));

    const cellMap = new Map(_cells.map(c => [`${c.col},${c.row}`, c]));

    
    const groups = d3.group(_cells, d => _fineParentById.get(d.id));
    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
   if (currentLevel === 1) {
  const groups = d3.group(_cells, d => _fineParentById.get(d.id));
  const bounds = computeGroupBounds(groups, cellW, cellH, gap);

  svg.append('g')
    .attr('class', 'parent-groups')
    .selectAll('rect')
    .data(bounds)
    .join('rect')
    .attr('x', d => d.x +3)
    .attr('y', d => d.y +3)
    .attr('width', d => d.w -6)
    .attr('height', d => d.h -6)
    .attr('rx', 1)
    .attr('ry', 1)
    .attr('fill', 'none')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1.5)
    .attr('opacity', 0.6)
 //.attr('fill', d => _coarseColorById.get(d.parentId))
//.attr('fill-opacity', 0.08)
//.attr('stroke', 'white')//d => _coarseColorById.get(d.parentId))
//.attr('stroke-width', 1.5)
//.attr('opacity', 0.4)
.attr('fill', 'none')
.attr('stroke', '#ffffff')
.attr('stroke-width', 1.5)
.attr('opacity', 0.6)
}
function getGap(d, dx, dy) {
  const neighbor = cellMap.get(`${d.col + dx},${d.row + dy}`);
  if (!neighbor) return outerGap;

  const sameParent =  _fineParentById.get(neighbor.id) === _fineParentById.get(d.id);

  return sameParent ? innerGap : outerGap;
}

    // ── Cell rectangles (hit areas) ──
    svg.append('g').attr('class', 'hits')
      .selectAll('rect').data(_cells, d => d.id).join('rect')
        .attr('class', 'hit')
        .attr('x', d => {
  const leftGap  = getGap(d, -1, 0);
  return d.col * cellW + leftGap / 2;
})
.attr('y', d => {
  const topGap   = getGap(d, 0, -1);
  return d.row * cellH + topGap / 2;
})
.attr('width', d => {
  const leftGap  = getGap(d, -1, 0);
  const rightGap = getGap(d, 1, 0);
  return cellW - (leftGap + rightGap) / 2;
})
.attr('height', d => {
  const topGap    = getGap(d, 0, -1);
  const bottomGap = getGap(d, 0, 1);
  return cellH - (topGap + bottomGap) / 2;
})
        .attr('rx', 6).attr('ry', 6)
        .attr('fill', d => clusterColor(d.id))
        .attr('fill-opacity', d => selectedId === d.id ? 1 :hoveredId === d.id ? 0.95 :0.85)
        .attr('stroke', '00000')//d => selectedId === d.id ? clusterColor(d.id) : hoveredId === d.id ? '#334155' : '#1e3a5f')
        .attr('stroke-width', d => (selectedId === d.id || hoveredId === d.id) ? 1.5 : 0.8)
        .attr('stroke-dasharray', null)
        .style('cursor', 'pointer')
        .on('mouseenter', (_, d) => { hoveredId = d.id;  updateMapStyles(); updateDendroStyles(); refreshInfo(); })
        .on('mouseleave', ()     => { hoveredId = null;  updateMapStyles(); updateDendroStyles(); refreshInfo(); })
        .on('click',      (_, d) => {
          selectedId = selectedId === d.id ? null : d.id;
          hoveredId  = null;
          updateMapStyles(); updateDendroStyles(); refreshInfo();
          drawSubLabels(el);
        });

    // ── Labels centered in cells ──
    svg.append('g').attr('class', 'labels')
      .selectAll('text').data(_cells, d => d.id).join('text')
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
        .attr('font-size', '12px')
        .attr('font-weight', d => selectedId === d.id ? '700' : '500')
        .attr('fill', '#000')
        //.attr('stroke', '#fff')   // optional halo for readability
        .attr('stroke-width', '3px')
        .attr('stroke', 'none')
        .attr('stroke-linejoin', 'round').attr('pointer-events', 'none')
        .each(function(d) {
          const el = d3.select(this);
          const bigram = splitBigram(d.kw0);
          if (bigram) {
            el.append('tspan')
              .attr('x', d.cellCX).attr('y', d.cellCY - 7)
              .text(bigram[0]);
            el.append('tspan')
              .attr('x', d.cellCX).attr('y', d.cellCY + 7)
              .text(bigram[1]);
          } else {
            el.append('tspan')
              .attr('x', d.cellCX).attr('y', d.cellCY)
              .text(d.kw0);
          }
        });

    svg.append('g').attr('class', 'sublevel-layer');
    if (selectedId !== null) drawSubLabels(el);
  }
  function computeGroupBounds(groups, cellW, cellH, gap) {
  const bounds = [];

  for (const [parentId, cells] of groups.entries()) {
    const minCol = d3.min(cells, d => d.col);
    const maxCol = d3.max(cells, d => d.col);
    const minRow = d3.min(cells, d => d.row);
    const maxRow = d3.max(cells, d => d.row);

    bounds.push({
      parentId,
      x: minCol * cellW + gap / 2,
      y: minRow * cellH + gap / 2,
      w: (maxCol - minCol + 1) * cellW - gap,
      h: (maxRow - minRow + 1) * cellH - gap
    });
  }

  return bounds;
}


  function lblColor(d) {
  return '#000';
  }

  function updateMapStyles() {
    const el = getMap(); if (!el || currentLevel === 0) return;
    const { cellW, cellH, gap } = _gridDims;

    d3.select(el).selectAll('rect.hit')
    .attr('fill-opacity', d =>
    selectedId === d.id ? 1 :
    hoveredId === d.id ? 0.95 :
    0.85
)
      .attr('stroke', null) //d => selectedId === d.id ? clusterColor(d.id) : hoveredId === d.id ? '#334155' : '#1e3a5f')
      .attr('stroke-width', d => (selectedId === d.id || hoveredId === d.id) ? 1.5 : 0.8)
      .attr('stroke-dasharray', null);

    d3.select(el).selectAll('.labels text')
      .attr('font-weight', d => selectedId === d.id ? '700' : '500')
      .attr('fill', d => lblColor(d))
      .attr('stroke-width', d => selectedId === d.id ? '3px' : '2px');
  }

  function drawSubLabels(el) {
    const svg = d3.select(el);
    svg.select('g.sublevel-layer').selectAll('*').remove();
    svg.selectAll('defs.sub-defs').remove();
    if (!selectedId) return;

    const selCell = _cells.find(c => c.id === selectedId);
    if (!selCell) return;

    const { cellW, cellH, gap } = _gridDims;
    const W = el.clientWidth || 600, H = el.clientHeight || 500;

    const bx = selCell.col * cellW + gap / 2;
    const by = selCell.row * cellH + gap / 2;
    const bw = cellW - gap;
    const bh = cellH - gap;

    const clipId = `clip-cell-${selCell.id}`;
    svg.append('defs').attr('class', 'sub-defs')
      .append('clipPath').attr('id', clipId)
      .append('rect')
        .attr('x', bx).attr('y', by)
        .attr('width', bw).attr('height', bh)
        .attr('rx', 6).attr('ry', 6);

    const grp = svg.select('g.sublevel-layer')
      .append('g')
      .attr('clip-path', `url(#${clipId})`)
      .attr('pointer-events', 'none');

    if (currentLevel === 1) {
      

    } else if (currentLevel === 2) {
      const subs = buildLevelClusters(1).filter(fc =>
        selCell.ids.some(id => fc.ids.includes(id))
      );
      if (!subs.length) return;

      const subFont = d3.scaleSqrt()
        .domain([d3.min(subs, d => d.kwcount), d3.max(subs, d => d.kwcount)])
        .range([7, 14]).clamp(true);

      const { xS, yS } = makeScales(W, H);
      const subWithScreen = subs.map(s => ({
        ...s,
        screenX: xS(s.cx),
        screenY: yS(s.cy),
      }));

      const subN    = subs.length;
      const subCols = Math.ceil(Math.sqrt(subN * bw / bh));
      const subRows = Math.ceil(subN / subCols);
      const subCW   = bw / subCols;
      const subCH   = bh / subRows;
      const subGap  = 2;

      const subSorted = [...subWithScreen].sort((a, b) => {
        const ra = Math.floor((a.screenY - by) / subCH);
        const rb = Math.floor((b.screenY - by) / subCH);
        return ra !== rb ? ra - rb
          : Math.floor((a.screenX - bx) / subCW) - Math.floor((b.screenX - bx) / subCW);
      });

      const subUsed = new Set();
      const subCells = subSorted.map(c => {
        let col = Math.max(0, Math.min(subCols - 1, Math.floor((c.screenX - bx) / subCW)));
        let row = Math.max(0, Math.min(subRows - 1, Math.floor((c.screenY - by) / subCH)));
        if (subUsed.has(`${col},${row}`)) {
          outer: for (let d = 1; d < subCols + subRows; d++) {
            for (let dc = -d; dc <= d; dc++) {
              for (let dr = -d; dr <= d; dr++) {
                if (Math.abs(dc) + Math.abs(dr) !== d) continue;
                const nc = col + dc, nr = row + dr;
                if (nc >= 0 && nc < subCols && nr >= 0 && nr < subRows && !subUsed.has(`${nc},${nr}`)) {
                  col = nc; row = nr;
                  break outer;
                }
              }
            }
          }
        }
        subUsed.add(`${col},${row}`);
        return {
          ...c,
          col, row,
          cx: bx + (col + 0.5) * subCW,
          cy: by + (row + 0.5) * subCH,
        };
      });

      grp.selectAll('rect').data(subCells).join('rect')
        .attr('x',      d => bx + d.col * subCW + subGap / 2)
        .attr('y',      d => by + d.row * subCH + subGap / 2)
        .attr('width',  subCW - subGap)
        .attr('height', subCH - subGap)
        .attr('rx', 4).attr('ry', 4)
        .attr('fill',         d => _fineColorById.get(d.id) ?? colorScale(d.id))
        .attr('fill-opacity', 0.85)
        .attr('stroke',       d => _fineColorById.get(d.id) ?? colorScale(d.id))
        .attr('stroke-width', 0.8)
        .attr('stroke-dasharray', null);

      const subNS = 'http://www.w3.org/2000/svg';
      grp.selectAll('text').data(subCells).join('text')
        .attr('text-anchor', 'middle')
        .attr('font-size',   d => subFont(d.kwcount) + 'px')
        .attr('font-weight', '600')
        .attr('fill',        d => _fineColorById.get(d.id) ?? colorScale(d.id))
        .attr('paint-order', 'stroke').attr('stroke', '#0f172a')
        .attr('stroke-width', '2.5px').attr('stroke-linejoin', 'round')
        .each(function(d) {
          this.textContent = '';
          const words = d.kw0.split(' ');
          const lh = subFont(d.kwcount) * 1.2;
          if (words.length > 1) {
            const mid = Math.ceil(words.length / 2);
            const t1 = document.createElementNS(subNS, 'tspan');
            t1.setAttribute('x', d.cx);
            t1.setAttribute('y', d.cy - lh / 2);
            t1.textContent = words.slice(0, mid).join(' ');
            this.appendChild(t1);
            const t2 = document.createElementNS(subNS, 'tspan');
            t2.setAttribute('x', d.cx);
            t2.setAttribute('y', d.cy + lh / 2);
            t2.textContent = words.slice(mid).join(' ');
            this.appendChild(t2);
          } else {
            const t1 = document.createElementNS(subNS, 'tspan');
            t1.setAttribute('x', d.cx);
            t1.setAttribute('y', d.cy + subFont(d.kwcount) * 0.35);
            t1.textContent = d.kw0;
            this.appendChild(t1);
          }
        });
    }
  }

  function drawKeywordDots(el) {
    const rect = el.getBoundingClientRect();
    const W = rect.width || 600, H = rect.height || 500;
    const { xS, yS } = makeScales(W, H);
    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    const bv = d3.Delaunay.from(aggClusters.map(c => [xS(c.cx), yS(c.cy)])).voronoi([0, 0, W, H]);
    svg.append('g').selectAll('path').data(aggClusters).join('path')
      .attr('d', (_, i) => bv.renderCell(i))
      .attr('fill', d => colorScale(d.id))
      .attr('fill-opacity', d =>
      selectedId === d.id ? 1 :
      hoveredId === d.id ? 0.95 :0.85)
      .attr('stroke', '#1e3a5f').attr('stroke-width', 0.5).attr('pointer-events', 'none');
    svg.selectAll('text').data(kwDots.map(d => ({ ...d, px: xS(d.cx), py: yS(d.cy) }))).join('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '7px').attr('fill', d => colorScale(d.clusterId))
      .attr('opacity', d => hoveredId === d.clusterId ? 1 : 0.5)
      .attr('paint-order', 'stroke').attr('stroke', '#0f172a').attr('stroke-width', '1.5px')
      .style('cursor', 'default')
      .each(function(d) {
        const el = d3.select(this);
        const bg = splitBigram(d.kw);
        if (bg) {
          el.append('tspan').attr('x', d.px).attr('y', d.py - 4).text(bg[0]);
          el.append('tspan').attr('x', d.px).attr('y', d.py + 4).text(bg[1]);
        } else {
          el.append('tspan').attr('x', d.px).attr('y', d.py + 3).text(d.kw);
        }
      })
      .on('mouseenter', (_, d) => { hoveredId = d.clusterId; updateDotStyles(); refreshInfo(); })
      .on('mouseleave', ()     => { hoveredId = null;        updateDotStyles(); refreshInfo(); });
  }

  function updateDotStyles() {
    const el = getMap(); if (!el || currentLevel !== 0) return;
    d3.select(el).selectAll('text').attr('opacity', d => hoveredId === d.clusterId ? 1 : 0.5);
  }

  // ── Dendrogram ────────────────────────────────────────────────────────────────
  function updateDendroStyles() {
    const el = getDendro(); if (!el) return;
    d3.select(el).selectAll('path.link')
      .attr('stroke', d => selectedId !== null && d.target.leaves().map(l => l.data.id).includes(selectedId) ? '#f8c948' : '#334155')
      .attr('stroke-width', d => selectedId !== null && d.target.leaves().map(l => l.data.id).includes(selectedId) ? 2 : 1);
    d3.select(el).selectAll('circle.leaf')
      .attr('fill',   d => selectedId === d.data.id ? '#f8c948' : colorScale(d.data.id))
      .attr('stroke', d => selectedId !== null
        ? (selectedId === d.data.id ? '#fff' : 'none')
        : (hoveredId  === d.data.id ? '#cbd5e1' : 'none'));
  }

  function drawDendrogram() {
    const el = getDendro(); if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    const m  = { top: 14, right: 64, bottom: 10, left: 38 };
    const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    const root = d3.hierarchy(TREE, n => n.children);
    d3.cluster().size([iw, ih])(root);
    const yS = d3.scaleLinear().domain([0, maxDist]).range([ih, 0]);
    root.each(n => { n.y = yS(n.data.dist ?? 0); });
    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    g.append('g').call(d3.axisLeft(yS).ticks(5).tickSize(-iw))
      .call(ax => {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').attr('stroke', '#1e3a5f').attr('stroke-dasharray', null);
        ax.selectAll('.tick text').attr('fill', '#475569').attr('font-size', '9px');
      });
    g.selectAll('path.link').data(root.links()).join('path').attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', d => selectedId !== null && d.target.leaves().map(l => l.data.id).includes(selectedId) ? '#f8c948' : '#334155')
      .attr('stroke-width', d => selectedId !== null && d.target.leaves().map(l => l.data.id).includes(selectedId) ? 2 : 1)
      .attr('d', d => `M${d.source.x},${d.source.y}H${d.target.x}V${d.target.y}`);
    const lvs = root.leaves();
    g.selectAll('circle.leaf').data(lvs).join('circle').attr('class', 'leaf')
      .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', 4)
      .attr('fill',   d => selectedId === d.data.id ? '#f8c948' : colorScale(d.data.id))
      .attr('stroke', d => selectedId !== null
        ? (selectedId === d.data.id ? '#fff' : 'none')
        : (hoveredId  === d.data.id ? '#cbd5e1' : 'none'))
      .attr('stroke-width', 1.5).style('cursor', 'pointer')
      .on('mouseenter', (_, d) => { hoveredId = d.data.id; updateDotStyles(); updateDendroStyles(); })
      .on('mouseleave', ()     => { hoveredId = null;       updateDotStyles(); updateDendroStyles(); })
      .on('click', (_, d) => {
        selectedId = String(selectedId) === String(d.data.id) ? null : d.data.id;
        updateMapStyles(); updateDendroStyles(); refreshInfo(); drawSubLabels(getMap());
      });
    if (selectedId !== null) {
      const s = lvs.find(l => l.data.id === selectedId);
      if (s) g.append('text').attr('x', s.x).attr('y', s.y + 13).attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#f8c948').text(s.data.id);
    }
    // snap rail
    const snapPYs = LEVEL_THRESHOLDS.map(d => d === null ? ih : yS(d));
    const rail = g.append('g');
    rail.append('line').attr('x1', iw + 10).attr('x2', iw + 10).attr('y1', snapPYs.at(-1)).attr('y2', snapPYs[0]).attr('stroke', '#1e3a5f').attr('stroke-width', 1);
    LEVEL_THRESHOLDS.forEach((_, lvl) => {
      const py = snapPYs[lvl], act = lvl === currentLevel;
      const grp = rail.append('g').attr('cursor', 'pointer').on('click', () => onLevelChange(lvl));
      grp.append('rect').attr('x', iw + 6).attr('y', py - 4).attr('width', 8).attr('height', 8)
        .attr('transform', `rotate(45,${iw + 10},${py})`).attr('fill', act ? '#f8c948' : '#1e3a5f').attr('stroke', act ? '#f8c948' : '#475569').attr('stroke-width', 1);
      grp.append('text').attr('x', iw + 22).attr('y', py + 3.5).attr('font-size', '9px').attr('fill', act ? '#f8c948' : '#64748b').attr('font-weight', act ? 'bold' : 'normal').text(LEVEL_LABELS[lvl]);
      grp.append('rect').attr('x', iw + 4).attr('y', py - 8).attr('width', m.right - 4).attr('height', 16).attr('fill', 'transparent');
    });
    // cut line
    const iPY = snapPYs[currentLevel];
    const cutG = g.append('g').style('cursor', 'ns-resize');
    const cutLine = cutG.append('line').attr('x1', -8).attr('x2', iw + 8).attr('y1', iPY).attr('y2', iPY).attr('stroke', '#f8c948').attr('stroke-width', 1.5).attr('stroke-dasharray', null);
    const hdl = cutG.append('g').attr('transform', `translate(-18,${iPY})`);
    hdl.append('circle').attr('r', 7).attr('fill', '#f8c948').attr('stroke', '#0f172a').attr('stroke-width', 1.5);
    hdl.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('font-size', '9px').attr('fill', '#0f172a').attr('font-weight', 'bold').text('↕');
    const cutLbl  = cutG.append('text').attr('x', -18).attr('y', iPY - 11).attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#f8c948').text(LEVEL_LABELS[currentLevel]);
    const cutBand = cutG.append('rect').attr('x', -8).attr('width', iw + 16).attr('y', iPY - 1).attr('height', 2).attr('fill', '#f8c948').attr('opacity', 0.15);
    const moveCut = py => { cutLine.attr('y1', py).attr('y2', py); hdl.attr('transform', `translate(-18,${py})`); cutLbl.attr('y', py - 11); cutBand.attr('y', py - 1); };
    cutG.call(d3.drag()
      .on('start', () => cutG.raise())
      .on('drag',  event => { const py = Math.max(0, Math.min(ih, event.y)); const n = snapPYs.reduce((b, sy, i) => Math.abs(sy - py) < Math.abs(snapPYs[b] - py) ? i : b, 0); moveCut(py); cutLbl.text(LEVEL_LABELS[n]); })
      .on('end',   event => { const py = Math.max(0, Math.min(ih, event.y)); const n = snapPYs.reduce((b, sy, i) => Math.abs(sy - py) < Math.abs(snapPYs[b] - py) ? i : b, 0); moveCut(snapPYs[n]); cutLbl.text(LEVEL_LABELS[n]); if (n !== currentLevel) onLevelChange(n); })
    );
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function onLevelChange(lvl) {
    currentLevel = lvl; selectedId = null; hoveredId = null;
    drawMap(); drawDendrogram(); refreshInfo();
  }

  function toggleDendro() {
    showDendro = !showDendro;
    requestAnimationFrame(() => { drawDendrogram(); });
  }

  // ── Mount ─────────────────────────────────────────────────────────────────────
  onMount(() => {
    initHierarchyColors();
    drawMap(); refreshInfo();

    ro = new ResizeObserver(() => { drawMap(); if (showDendro) drawDendrogram(); });
    ro.observe(getMap());

    const win    = document.getElementById('dendro-window');
    const handle = document.getElementById('dendro-drag-handle');
    if (win && handle) {
      let ox = 0, oy = 0, startX = 0, startY = 0;
      handle.addEventListener('mousedown', e => {
        e.preventDefault();
        startX = e.clientX; startY = e.clientY;
        const rect = win.getBoundingClientRect();
        ox = rect.left; oy = rect.top;
        win.style.right = 'auto'; win.style.bottom = 'auto';
        const onMove = e => {
          win.style.left = (ox + e.clientX - startX) + 'px';
          win.style.top  = (oy + e.clientY - startY) + 'px';
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    }

    return () => ro?.disconnect();
  });
</script>

<style>
  /* ── Overall shell ── */
  .shell {
    display: flex;
    height: 100%;
    min-height: 0;
    gap: 0;
  }

  /* ── Left sidebar ── */
  .sidebar {
    width: 52px;
    flex-shrink: 0;
    background: #1e293b;
    border-right: 1px solid #1e3a5f;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 0 10px;
    gap: 6px;
    z-index: 1;
  }
  .sidebar-label {
    font-size: 8px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: #334155; writing-mode: vertical-rl; transform: rotate(180deg);
    margin-bottom: 8px; user-select: none;
  }
  .lvl-btn {
    width: 36px; height: 36px; border-radius: 8px; border: 1px solid #334155;
    background: transparent; color: #475569; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1px; transition: all .15s; padding: 0;
  }
  .lvl-btn:hover  { border-color: #64748b; color: #94a3b8; background: #0f172a; }
  .lvl-btn.active { border-color: #f8c948; color: #f8c948; background: #1e3a5f; }
  .lvl-btn .icon  { font-size: 11px; line-height: 1; }
  .lvl-btn .lbl   { font-size: 7px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; line-height: 1; }
  .sidebar-spacer { flex: 1; }
  .tree-toggle {
    width: 36px; height: 36px; border-radius: 8px; border: 1px solid #334155;
    background: transparent; color: #475569; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px; transition: all .15s; padding: 0;
  }
  .tree-toggle:hover  { border-color: #64748b; color: #94a3b8; background: #0f172a; }
  .tree-toggle.active { border-color: #f8c948; color: #f8c948; background: #1e3a5f; }
  .tree-toggle .icon  { font-size: 14px; line-height: 1; }
  .tree-toggle .lbl   { font-size: 6px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; line-height: 1; }

  /* ── Main area ── */
  .main {
    flex: 1; min-width: 0; min-height: 0;
    display: flex; flex-direction: column;
    position: relative;
  }

  /* ── Main layout ── */
.main {
  flex: 1; min-width: 0; min-height: 0;
  display: flex;
  flex-direction: column; /* keep this */
  position: relative;
}

.main-row {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 10px;
  padding: 10px;
}

/* ── Map panel (left, big) ── */
.map-panel {
  flex: 0 0 65%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #d6deea;
  border-radius: 12px;
}


.map-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative; /* add this */
}

.map-body svg {
  display: block;
  width: 100%;
  height: 100%;
  position: absolute; /* add this */
  top: 0;
  left: 0;
}

/* ── Right column ── */
.right-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

/* ── Keyword panel (top right) ── */
.kw-panel {
  flex: 0 0 45%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #d6deea;
  border-radius: 12px;
}

.kw-panel-title {
  font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: #334155; padding: 8px 14px 6px;
  border-bottom: 1px solid #dbe4ef; flex-shrink: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.kw-scroll {
  overflow-y: auto; overflow-x: hidden;
  padding: 6px 10px 10px;
  display: flex; flex-wrap: wrap; gap: 4px;
  flex: 1;
}
.kw-scroll::-webkit-scrollbar       { width: 4px; }
.kw-scroll::-webkit-scrollbar-thumb { background: #c9d5e5; border-radius: 2px; }

/* ── Blank bottom-right panel ── */
.blank-panel {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #d6deea;
  border-radius: 12px;
  min-height: 0;
}

/* chips / keywords */
.chip {
  display: inline-block; background: #ffffff; border: 1px solid #c9d5e5;
  border-radius: 20px; padding: 2px 9px; font-size: 10px; color: #475569;
  transition: all .12s; white-space: nowrap;
}
.chip.bigram {
  white-space: normal; display: inline-flex; flex-direction: column;
  align-items: center; line-height: 1.05; padding: 4px 9px;
}
.chip:hover { background: #e8f0fe; border-color: #93c5fd; color: #1e3a8a; }
.kw-empty   { padding: 8px 14px; font-size: 11px; color: #64748b; }
  
  
  /* ── Floating dendrogram window ── */
  .dendro-window {
    position: absolute; top: 10px; right: 10px;
    width: 420px; height: 260px;
    background: #1e293b; border: 1px solid #334155; border-radius: 12px;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 10;
  }
  .dendro-window.hidden { display: none; }
  .dendro-header {
    display: flex; align-items: center; padding: 7px 10px 6px 14px;
    border-bottom: 1px solid #1e3a5f; flex-shrink: 0;
    cursor: move; user-select: none;
  }
  .dendro-title {
    font-size: 10px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: #64748b; flex: 1;
  }
  .dendro-close {
    width: 20px; height: 20px; border-radius: 4px; border: 1px solid #334155;
    background: transparent; color: #475569; cursor: pointer; font-size: 12px;
    display: flex; align-items: center; justify-content: center; transition: all .12s; flex-shrink: 0;
  }
  .dendro-close:hover { border-color: #f87171; color: #f87171; background: #1e1e2e; }
  .dendro-body { flex: 1; min-height: 0; overflow: hidden; }
  .dendro-body svg { display: block; width: 100%; height: 100%; }

  /* Light theme overrides */
  .sidebar { background: #eef3f9; border-right-color: #d6deea; }
  .sidebar-label { color: #64748b; }
  .lvl-btn, .tree-toggle {
    border-color: #c9d5e5;
    color: #475569;
    background: #ffffff;
  }
  .lvl-btn:hover, .tree-toggle:hover { background: #f4f7fb; border-color: #94a3b8; color: #334155; }
  .lvl-btn.active, .tree-toggle.active { background: #fff7db; color: #7c5a00; border-color: #f8c948; }
  .map-header { border-bottom-color: #dbe4ef; }
  .map-title, .dendro-title, .kw-strip-title { color: #334155; }
  .level-badge { background: #fff7db; border-color: #f8c948; color: #7c5a00; }
  .kw-strip { background: #ffffff; border-top-color: #dbe4ef; }
  .kw-strip-scroll::-webkit-scrollbar-thumb { background: #c9d5e5; }
  .chip { background: #ffffff; border-color: #c9d5e5; color: #475569; }
  .chip:hover { background: #e8f0fe; border-color: #93c5fd; color: #1e3a8a; }
  .kw-empty { color: #64748b; }
  .dendro-window { background: #ffffff; border-color: #d6deea; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); }
  .dendro-header { border-bottom-color: #dbe4ef; }
  .dendro-close { border-color: #c9d5e5; color: #475569; }
  .dendro-close:hover { border-color: #ef4444; color: #ef4444; background: #fff1f2; }
</style>

<div class="shell">

  <!-- ── Left sidebar ── -->
  <aside class="sidebar">
    <span class="sidebar-label">Granularity</span>
   {#each [...LEVEL_LABELS].reverse() as lbl, i}
  {@const lvl = LEVEL_LABELS.length - 1 - i}
  <button
    class="lvl-btn {currentLevel === lvl ? 'active' : ''}"
    onclick={() => onLevelChange(lvl)}
    title={lbl}
  >
    <span class="icon">{LEVEL_ICONS[lvl]}</span>
    <span class="lbl">{lbl}</span>
  </button>
{/each}
    <div class="sidebar-spacer"></div>
    <button
      class="tree-toggle {showDendro ? 'active' : ''}"
      onclick={toggleDendro}
      title={showDendro ? 'Hide dendrogram' : 'Show dendrogram'}
    >
      <span class="icon">⎇</span>
      <span class="lbl">{showDendro ? 'hide' : 'tree'}</span>
    </button>
  </aside>

  <!-- ── Main area ── -->
  <div class="main">
   <div class="main-row">

    <!-- LEFT: big map panel -->
    <div class="map-panel">
      <div class="map-header">
        <span class="map-title">
          {currentLevel === 0
            ? 'All keywords — hover to highlight'
            : 'Word map — size = keyword count · click to drill in'}
        </span>
        <span class="level-badge">{LEVEL_LABELS[currentLevel]}</span>
      </div>
      <div class="map-body">
        <svg id="map-svg"></svg>
      </div>
    </div>

    <!-- RIGHT column -->
    <div class="right-col">

      <!-- TOP RIGHT: keywords -->
      <div class="kw-panel">
        <div class="kw-panel-title">{listTitle}</div>
        {#if displayKws.length > 0}
          <div class="kw-scroll">
            {#each displayKws as kw}
              {#if splitBigram(kw)}
                <span class="chip bigram">
                  {splitBigram(kw)[0]}<br />{splitBigram(kw)[1]}
                </span>
              {:else}
                <span class="chip">{kw}</span>
              {/if}
            {/each}
          </div>
        {:else}
          <div class="kw-empty">
            {currentLevel === 0 ? 'Hover a dot' : 'Click a label'}
          </div>
        {/if}
      </div>

      <!-- BOTTOM RIGHT: blank space -->
      <div class="blank-panel"></div>

    </div>

  </div>

  <!-- floating dendrogram window (unchanged) -->
  <div id="dendro-window" class="dendro-window {showDendro ? '' : 'hidden'}">
    <div class="dendro-header" id="dendro-drag-handle">
      <span class="dendro-title">Dendrogram — drag ↕ cut-line or click level</span>
      <button class="dendro-close" onclick={toggleDendro} title="Close">✕</button>
    </div>
    <div class="dendro-body">
      <svg id="dendro-svg"></svg>
    </div>
  </div>

  </div>

</div>


