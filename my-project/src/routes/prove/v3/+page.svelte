<!-- src/routes/v3/+page.svelte  →  http://localhost:5173/v3 -->
<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { clusterKeywords, TREE, aggClusters, colorScale } from '$lib/data.js';

  // ── Level state ───────────────────────────────────────────────────────────────
  let currentLevel = $state(1);
  let selectedId   = $state(null);
  let hoveredId    = $state(null);
  let svgEl        = $state(null);
  let dendroEl     = $state(null);

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

  const allDists = [...new Set(collectMergeDistances(TREE))].sort((a, b) => a - b);
  const maxDist  = TREE.dist ?? allDists.at(-1) ?? 1;

  function quantileDist(q) {
    return allDists[Math.max(0, Math.floor(q * (allDists.length - 1)))];
  }

  const LEVEL_THRESHOLDS = [
    null,
    quantileDist(0.25),
    quantileDist(0.60),
    maxDist * 1.01,
  ];
  const LEVEL_LABELS = ['Keywords', 'Fine', 'Coarse', 'Root'];

  function buildLevelClusters(level) {
    if (level === 0) return [];
    const threshold  = LEVEL_THRESHOLDS[level];
    const superNodes = cutTree(TREE, threshold);
    return superNodes.map((sn, i) => {
      const ids     = leafIds(sn);
      const bases   = aggClusters.filter(a => ids.includes(a.id));
      const kwcount = bases.reduce((s, a) => s + (a.kwcount ?? 0), 0) || ids.length;
      const cx      = bases.length ? d3.mean(bases, a => a.cx) : 0;
      const cy      = bases.length ? d3.mean(bases, a => a.cy) : 0;
      const kws     = ids.flatMap(id => clusterKeywords[id] ?? []);
      return {
        id: ids[0], superIdx: i, ids, kwcount, cx, cy, kws,
        label: ids.length > 1 ? `[${ids.join(',')}]` : String(ids[0]),
      };
    });
  }

  // Keyword dots for level 0
  function buildKeywordDots() {
    const dots = [];
    const rng  = d3.randomNormal.source(d3.randomLcg(42))(0, 0.18);
    aggClusters.forEach(cl => {
      (clusterKeywords[cl.id] ?? []).forEach(kw => {
        dots.push({ kw, clusterId: cl.id, cx: cl.cx + rng(), cy: cl.cy + rng() });
      });
    });
    return dots;
  }
  const kwDots = buildKeywordDots();

  let levelClusters = $derived(buildLevelClusters(currentLevel));

  let activeSC = $derived(
    currentLevel === 0
      ? null
      : levelClusters.find(c => c.id === (selectedId ?? hoveredId)) ?? null
  );
  let displayKws = $derived(
    currentLevel === 0
      ? (hoveredId !== null ? (clusterKeywords[hoveredId] ?? []) : [])
      : (activeSC ? activeSC.kws : [])
  );
  let listTitle = $derived(
    currentLevel === 0
      ? (hoveredId !== null ? `Cluster ${hoveredId} keywords` : 'Hover a dot to see its cluster')
      : activeSC
        ? `${activeSC.label} — ${displayKws.length} keywords`
        : 'Click a cell to see keywords'
  );

  // ── Shared scale helpers ──────────────────────────────────────────────────────
  function makeScales(W, H, pad = 0.7) {
    const allX = aggClusters.map(d => d.cx);
    const allY = aggClusters.map(d => d.cy);
    const xExt = d3.extent(allX), yExt = d3.extent(allY);
    return {
      xS: d3.scaleLinear().domain([xExt[0]-pad, xExt[1]+pad]).range([0, W]),
      yS: d3.scaleLinear().domain([yExt[0]-pad, yExt[1]+pad]).range([H, 0]),
    };
  }

  // ── Voronoi helpers ───────────────────────────────────────────────────────────
  // Build a Voronoi diagram from cluster centroids, bounded to [0,W]×[0,H].
  // Returns { cells: [{id, path, cx, cy, kws, kwcount, ...}], voronoi }
  

  // ── Main Voronoi draw (levels 1–3) ───────────────────────────────────────────
  // _cells keeps a stable reference for style-only updates
  let _cells = [];

  // ── Icicle state ──────────────────────────────────────────────────────────────
let _icicleRoot = null;
let _xScale = null, _yScale = null;
let _currentFocus = null;

function buildIcicleRoot() {
  const root = d3.hierarchy(TREE, n => n.children)
    .sum(n => {
      if (!n.children) {
        const base = aggClusters.find(a => a.id === n.id);
        return base?.kwcount ?? 1;
      }
      return 0;
    })
    .sort((a, b) => b.value - a.value);
  d3.partition()(root);
  return root;
}

function nodeLevel(node) {
  const maxDepth = _icicleRoot ? _icicleRoot.height : 3;
  return maxDepth - node.depth;
}

function drawVoronoi(el) {
  if (!el) return;
  if (currentLevel === 0) { drawKeywordDots(el); return; }
  drawIcicle(el);
}

function drawIcicle(el) {
  if (!el) return;
  const W = el.clientWidth || 600, H = el.clientHeight || 500;

  _icicleRoot   = buildIcicleRoot();
  _currentFocus = _icicleRoot;

  _xScale = d3.scaleLinear().range([0, W]);
  _yScale = d3.scaleLinear().range([0, H]);

  const svg = d3.select(el).attr('width', W).attr('height', H);
  svg.selectAll('*').remove();

  svg.append('defs').append('clipPath').attr('id', 'icicle-clip')
    .append('rect').attr('width', W).attr('height', H);

  const g = svg.append('g').attr('clip-path', 'url(#icicle-clip)');

  const allNodes = _icicleRoot.descendants();

  const cell = g.selectAll('g.inode')
    .data(allNodes, d => d.data.id ?? d.data.dist)
    .join('g')
      .attr('class', 'inode')
      .attr('transform', d => `translate(${_xScale(d.x0)},${_yScale(d.y0)})`)
      .style('cursor', d => d.children ? 'pointer' : 'default');

  cell.append('rect')
    .attr('width',  d => Math.max(0, _xScale(d.x1) - _xScale(d.x0) - 1))
    .attr('height', d => Math.max(0, _yScale(d.y1) - _yScale(d.y0) - 1))
    .attr('rx', 3).attr('ry', 3)
    .attr('fill', d => {
      let n = d; while (n.children) n = n.children[0];
      return colorScale(n.data.id);
    })
    .attr('fill-opacity', d => {
      const inSel = selectedId !== null && d.descendants().some(dd => !dd.children && dd.data.id === selectedId);
      const inHov = hoveredId  !== null && d.descendants().some(dd => !dd.children && dd.data.id === hoveredId);
      if (selectedId !== null) return inSel ? 0.85 : 0.2;
      return inHov ? 0.85 : 0.55;
    })
    .attr('stroke', d => {
      const inSel = selectedId !== null && d.descendants().some(dd => !dd.children && dd.data.id === selectedId);
      return inSel ? '#f8c948' : '#0f172a';
    })
    .attr('stroke-width', d => {
      const inSel = selectedId !== null && d.descendants().some(dd => !dd.children && dd.data.id === selectedId);
      return inSel ? 1.5 : 0.5;
    });

  cell.append('text')
    .attr('pointer-events', 'none')
    .attr('x', 4)
    .attr('y', d => (_yScale(d.y1) - _yScale(d.y0)) / 2)
    .attr('dominant-baseline', 'central')
    .attr('font-size', d => {
      const h = _yScale(d.y1) - _yScale(d.y0);
      return Math.min(12, Math.max(7, h * 0.35)) + 'px';
    })
    .attr('font-weight', '600')
    .attr('fill', '#e2e8f0')
    .attr('paint-order', 'stroke')
    .attr('stroke', '#0f172a')
    .attr('stroke-width', '2px')
    .attr('stroke-linejoin', 'round')
    .text(d => {
      const w = _xScale(d.x1) - _xScale(d.x0);
      if (w < 20) return '';
      let n = d; while (n.children) n = n.children[0];
      const kw = clusterKeywords[n.data.id]?.[0] ?? String(n.data.id);
      const maxChars = Math.floor(w / 6.5);
      return kw.length > maxChars ? kw.slice(0, maxChars - 1) + '…' : kw;
    });

  // Cut-level line
  const cutNodes = allNodes.filter(d => nodeLevel(d) === currentLevel);
  if (cutNodes.length) {
    svg.append('line')
      .attr('x1', 0).attr('x2', W)
      .attr('y1', _yScale(cutNodes[0].y0)).attr('y2', _yScale(cutNodes[0].y0))
      .attr('stroke', '#f8c948').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,3')
      .attr('pointer-events', 'none');
  }

  cell
    .on('click', (event, d) => {
      event.stopPropagation();
      if (!d.children) {
        selectedId = selectedId === d.data.id ? null : d.data.id;
        hoveredId  = null;
        updateIcicleStyles();
        updateDendroStyles();
        return;
      }
      zoomIcicle(el, d, W, H);
    })
    .on('mouseenter', (_, d) => {
      let n = d; while (n.children) n = n.children[0];
      hoveredId = n.data.id;
      updateIcicleStyles();
    })
    .on('mouseleave', () => {
      hoveredId = null;
      updateIcicleStyles();
    });

  svg.on('click', () => {
    if (_currentFocus !== _icicleRoot) {
      zoomIcicle(el, _icicleRoot, W, H);
    } else {
      selectedId = null;
      updateIcicleStyles();
      updateDendroStyles();
    }
  });
}

function zoomIcicle(el, focus, W, H) {
  _currentFocus = focus;
  _xScale.domain([focus.x0, focus.x1]);
  _yScale.domain([focus.y0, 1]);

  const svg = d3.select(el);
  const t   = svg.transition().duration(600).ease(d3.easeCubicInOut);

  svg.selectAll('g.inode').transition(t)
    .attr('transform', d => `translate(${_xScale(d.x0)},${_yScale(d.y0)})`);

  svg.selectAll('g.inode rect').transition(t)
    .attr('width',  d => Math.max(0, _xScale(d.x1) - _xScale(d.x0) - 1))
    .attr('height', d => Math.max(0, _yScale(d.y1) - _yScale(d.y0) - 1));

  svg.selectAll('g.inode text').transition(t)
    .attr('y', d => (_yScale(d.y1) - _yScale(d.y0)) / 2)
    .attr('font-size', d => {
      const h = _yScale(d.y1) - _yScale(d.y0);
      return Math.min(12, Math.max(7, h * 0.35)) + 'px';
    })
    .text(d => {
      const w = _xScale(d.x1) - _xScale(d.x0);
      if (w < 20) return '';
      let n = d; while (n.children) n = n.children[0];
      const kw = clusterKeywords[n.data.id]?.[0] ?? String(n.data.id);
      const maxChars = Math.floor(w / 6.5);
      return kw.length > maxChars ? kw.slice(0, maxChars - 1) + '…' : kw;
    });
}

function updateIcicleStyles() {
  if (!svgEl || currentLevel === 0) return;
  d3.select(svgEl).selectAll('g.inode rect')
    .attr('fill-opacity', d => {
      const inSel = selectedId !== null && d.descendants().some(dd => !dd.children && dd.data.id === selectedId);
      const inHov = hoveredId  !== null && d.descendants().some(dd => !dd.children && dd.data.id === hoveredId);
      if (selectedId !== null) return inSel ? 0.85 : 0.2;
      return inHov ? 0.85 : 0.55;
    })
    .attr('stroke', d => {
      const inSel = selectedId !== null && d.descendants().some(dd => !dd.children && dd.data.id === selectedId);
      return inSel ? '#f8c948' : '#0f172a';
    })
    .attr('stroke-width', d => {
      const inSel = selectedId !== null && d.descendants().some(dd => !dd.children && dd.data.id === selectedId);
      return inSel ? 1.5 : 0.5;
    });
}

// Keep this name so the $effect and dendro clicks still work
function updateVoronoiStyles() { updateIcicleStyles(); }

// ── Keyword dot view (level 0) ────────────────────────────────────────────────
function drawKeywordDots(el) {
  if (!el) return;
  const W = el.clientWidth || 600, H = el.clientHeight || 500;
  const { xS, yS } = makeScales(W, H);

  const svg = d3.select(el).attr('width', W).attr('height', H);
  svg.selectAll('*').remove();

  const basePts      = aggClusters.map(c => [xS(c.cx), yS(c.cy)]);
  const baseDelaunay = d3.Delaunay.from(basePts);
  const baseVoronoi  = baseDelaunay.voronoi([0, 0, W, H]);

  svg.append('g').attr('class', 'bg-voronoi')
    .selectAll('path').data(aggClusters).join('path')
      .attr('d', (_, i) => baseVoronoi.renderCell(i))
      .attr('fill', d => colorScale(d.id))
      .attr('fill-opacity', d => hoveredId === d.id ? 0.14 : 0.05)
      .attr('stroke', '#1e3a5f').attr('stroke-width', 0.5)
      .attr('pointer-events', 'none');

  const dots = kwDots.map(d => ({ ...d, px: xS(d.cx), py: yS(d.cy) }));

  svg.selectAll('circle.kwdot').data(dots).join('circle')
    .attr('class', 'kwdot')
    .attr('cx', d => d.px).attr('cy', d => d.py).attr('r', 3)
    .attr('fill', d => colorScale(d.clusterId))
    .attr('opacity', d => hoveredId === d.clusterId ? 1 : 0.55)
    .attr('stroke', d => hoveredId === d.clusterId ? '#fff' : 'none')
    .attr('stroke-width', 0.8)
    .style('cursor', 'default')
    .on('mouseenter', (_, d) => { hoveredId = d.clusterId; updateDotStyles(); })
    .on('mouseleave', ()     => { hoveredId = null;        updateDotStyles(); });

  svg.append('g').attr('class', 'kwlabels')
    .selectAll('text').data(dots).join('text')
      .attr('x', d => d.px + 4).attr('y', d => d.py + 3)
      .attr('font-size', '7px').attr('fill', '#94a3b8')
      .attr('pointer-events', 'none')
      .attr('opacity', d => hoveredId === d.clusterId ? 1 : 0)
      .text(d => d.kw);
}

function updateDotStyles() {
  if (!svgEl || currentLevel !== 0) return;
  d3.select(svgEl).selectAll('circle.kwdot')
    .attr('opacity', d => hoveredId === d.clusterId ? 1 : 0.55)
    .attr('stroke',  d => hoveredId === d.clusterId ? '#fff' : 'none');
  d3.select(svgEl).selectAll('text.kwtext')
    .attr('opacity', d => hoveredId === d.clusterId ? 1 : 0);
  d3.select(svgEl).selectAll('.bg-voronoi path')
    .attr('fill-opacity', d => hoveredId === d.id ? 0.14 : 0.05);
}



  // ── Sub-level overlay ─────────────────────────────────────────────────────────
  // Level 1 (Fine)   → keyword dots inside the selected Voronoi cell
  // Level 2 (Coarse) → Fine-level sub-Voronoi inside the selected cell
  // Both are clipped to the cell's polygon path.

  let _subSim = null;

  

  

  // ── Dendrogram ────────────────────────────────────────────────────────────────
  function updateDendroStyles() {
    if (!dendroEl) return;
    d3.select(dendroEl).selectAll('path.link')
      .attr('stroke', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        if (selectedId === null) return '#334155';
        return ids.includes(selectedId) ? '#f8c948' : '#1e3a5f';
      })
      .attr('stroke-width', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        if (selectedId === null) return 1;
        return ids.includes(selectedId) ? 2 : 0.8;
      });
    d3.select(dendroEl).selectAll('circle.leaf')
      .attr('fill', d => selectedId === d.data.id ? '#f8c948' : colorScale(d.data.id))
      .attr('stroke', d => {
        if (selectedId !== null) return selectedId === d.data.id ? '#fff' : 'none';
        return hoveredId === d.data.id ? '#cbd5e1' : 'none';
      });
  }

  function drawDendrogram(el) {
    if (!el) return;
    const W = el.clientWidth || 400, H = el.clientHeight || 220;
    const m = { top: 14, right: 64, bottom: 10, left: 38 };
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
        ax.selectAll('.tick line').attr('stroke', '#1e3a5f').attr('stroke-dasharray', '2,3');
        ax.selectAll('.tick text').attr('fill', '#475569').attr('font-size', '9px');
      });

    g.selectAll('path.link').data(root.links()).join('path').attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        if (selectedId === null) return '#334155';
        return ids.includes(selectedId) ? '#f8c948' : '#1e3a5f';
      })
      .attr('stroke-width', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        if (selectedId === null) return 1;
        return ids.includes(selectedId) ? 2 : 0.8;
      })
      .attr('d', d => `M${d.source.x},${d.source.y}H${d.target.x}V${d.target.y}`);

    const lvs = root.leaves();
    g.selectAll('circle.leaf').data(lvs).join('circle').attr('class', 'leaf')
      .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', 4)
      .attr('fill', d => selectedId === d.data.id ? '#f8c948' : colorScale(d.data.id))
      .attr('stroke', d => {
        if (selectedId !== null) return selectedId === d.data.id ? '#fff' : 'none';
        return hoveredId === d.data.id ? '#cbd5e1' : 'none';
      })
      .attr('stroke-width', 1.5).style('cursor', 'pointer')
      .on('mouseenter', (_, d) => { hoveredId = d.data.id; updateDotStyles(); })
      .on('mouseleave', ()     => { hoveredId = null;      updateDotStyles(); })
      .on('click', (_, d) => {
        selectedId = String(selectedId) === String(d.data.id) ? null : d.data.id;
        updateVoronoiStyles();
        updateDendroStyles();
        drawSubLevel(svgEl);
      });

    if (selectedId !== null) {
      const s = lvs.find(l => l.data.id === selectedId);
      if (s) g.append('text').attr('x', s.x).attr('y', s.y + 13)
        .attr('text-anchor', 'middle').attr('font-size', '8px')
        .attr('fill', '#f8c948').text(s.data.id);
    }

    // ── Right rail with snap indicators ──────────────────────────────────────
    const snapPYs = LEVEL_THRESHOLDS.map(d => d === null ? ih : yS(d));
    const rail    = g.append('g').attr('class', 'rail');

    rail.append('line')
      .attr('x1', iw + 10).attr('x2', iw + 10)
      .attr('y1', snapPYs.at(-1)).attr('y2', snapPYs[0])
      .attr('stroke', '#1e3a5f').attr('stroke-width', 1);

    LEVEL_THRESHOLDS.forEach((_, lvl) => {
      const py       = snapPYs[lvl];
      const isActive = lvl === currentLevel;
      const grp      = rail.append('g').attr('cursor', 'pointer')
        .on('click', () => { currentLevel = lvl; selectedId = null; });

      grp.append('rect')
        .attr('x', iw + 6).attr('y', py - 4).attr('width', 8).attr('height', 8)
        .attr('transform', `rotate(45, ${iw + 10}, ${py})`)
        .attr('fill',   isActive ? '#f8c948' : '#1e3a5f')
        .attr('stroke', isActive ? '#f8c948' : '#475569')
        .attr('stroke-width', 1);

      grp.append('text')
        .attr('x', iw + 22).attr('y', py + 3.5)
        .attr('font-size', '9px')
        .attr('fill',       isActive ? '#f8c948' : '#64748b')
        .attr('font-weight', isActive ? 'bold'   : 'normal')
        .text(LEVEL_LABELS[lvl]);

      grp.append('rect')
        .attr('x', iw + 4).attr('y', py - 8)
        .attr('width', m.right - 4).attr('height', 16)
        .attr('fill', 'transparent');
    });

    // ── Draggable cut-line ────────────────────────────────────────────────────
    const initPY = snapPYs[currentLevel];
    const cutG   = g.append('g').attr('class', 'cut-line').style('cursor', 'ns-resize');

    const cutLine = cutG.append('line')
      .attr('x1', -8).attr('x2', iw + 8)
      .attr('y1', initPY).attr('y2', initPY)
      .attr('stroke', '#f8c948').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,3');

    const handle = cutG.append('g').attr('transform', `translate(-18, ${initPY})`);
    handle.append('circle').attr('r', 7)
      .attr('fill', '#f8c948').attr('stroke', '#0f172a').attr('stroke-width', 1.5);
    handle.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', '9px').attr('fill', '#0f172a').attr('font-weight', 'bold').text('↕');

    const cutLabel = cutG.append('text')
      .attr('x', -18).attr('y', initPY - 11)
      .attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#f8c948')
      .text(LEVEL_LABELS[currentLevel]);

    const cutBand = cutG.append('rect')
      .attr('x', -8).attr('width', iw + 16)
      .attr('y', initPY - 1).attr('height', 2)
      .attr('fill', '#f8c948').attr('opacity', 0.15);

    function moveCutTo(py) {
      cutLine.attr('y1', py).attr('y2', py);
      handle.attr('transform', `translate(-18, ${py})`);
      cutLabel.attr('y', py - 11);
      cutBand.attr('y', py - 1);
    }

    cutG.call(
      d3.drag()
        .on('start', () => cutG.raise())
        .on('drag', event => {
          const py      = Math.max(0, Math.min(ih, event.y));
          const nearest = snapPYs.reduce((best, sy, i) =>
            Math.abs(sy - py) < Math.abs(snapPYs[best] - py) ? i : best, 0);
          moveCutTo(py);
          cutLabel.text(LEVEL_LABELS[nearest]);
        })
        .on('end', event => {
          const py      = Math.max(0, Math.min(ih, event.y));
          const nearest = snapPYs.reduce((best, sy, i) =>
            Math.abs(sy - py) < Math.abs(snapPYs[best] - py) ? i : best, 0);
          moveCutTo(snapPYs[nearest]);
          cutLabel.text(LEVEL_LABELS[nearest]);
          if (nearest !== currentLevel) { currentLevel = nearest; selectedId = null; }
        })
    );
  }

  // ── Effects & mount ───────────────────────────────────────────────────────────
  $effect(() => {
    const _lvl = currentLevel; // track reactively
    if (svgEl)    drawVoronoi(svgEl);
    if (dendroEl) drawDendrogram(dendroEl);
  });

  onMount(() => {
    if (svgEl)    drawVoronoi(svgEl);
    if (dendroEl) drawDendrogram(dendroEl);

    const ro = new ResizeObserver(() => {
      if (svgEl)    drawVoronoi(svgEl);
      if (dendroEl) drawDendrogram(dendroEl);
    });
    [svgEl, dendroEl].forEach(el => el && ro.observe(el));
    return () => { ro.disconnect(); if (_subSim) _subSim.stop(); };
  });
</script>

<style>
  .page        { display:flex; height:100%; gap:10px; padding:10px; }
  .panel       { background:#1e293b; border:1px solid #334155; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; }
  .panel-title { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#64748b; padding:8px 14px 6px; border-bottom:1px solid #1e3a5f; flex-shrink:0; }
  .panel-body  { flex:1; overflow:hidden; }
  .panel-body svg { display:block; width:100%; height:100%; }
  .left        { flex:0 0 62%; }
  .right       { flex:1; display:flex; flex-direction:column; gap:10px; }
  .right .panel { flex:1; }
  .kw-panel    { flex:0 0 34% !important; }
  .level-badge {
    display:inline-block; margin-left:8px;
    background:#1e3a5f; border:1px solid #334155; border-radius:20px;
    padding:1px 8px; font-size:9px; color:#f8c948; letter-spacing:.06em;
    vertical-align:middle; text-transform:none;
  }
  .list-sub  { padding:5px 14px; font-size:11px; color:#94a3b8; border-bottom:1px solid #1e3a5f; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .kw-list   { flex:1; overflow-y:auto; padding:6px 10px; }
  .kw-list::-webkit-scrollbar       { width:4px; }
  .kw-list::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }
  .chip      { display:inline-block; background:#0f172a; border:1px solid #334155; border-radius:20px; padding:3px 10px; margin:3px; font-size:11px; color:#94a3b8; transition:all .12s; }
  .chip:hover { background:#1e40af; border-color:#3b82f6; color:#fff; }
  .empty     { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#334155; font-size:12px; gap:6px; }

  /* Light theme overrides */
  .panel { background:#ffffff; border-color:#d6deea; }
  .panel-title { color:#334155; border-bottom-color:#dbe4ef; }
  .level-badge { background:#fff7db; border-color:#f8c948; color:#7c5a00; }
  .list-sub { color:#475569; border-bottom-color:#dbe4ef; }
  .kw-list::-webkit-scrollbar-thumb { background:#c9d5e5; }
  .chip { background:#ffffff; border-color:#c9d5e5; color:#475569; }
  .chip:hover { background:#e8f0fe; border-color:#93c5fd; color:#1e3a8a; }
</style>

<div class="page">
  <div class="panel left">
    <div class="panel-title">
      {currentLevel === 0 ? 'Keyword Map — hover to highlight cluster' : 'Voronoi Tessellation — click a cell to explore'}
      <span class="level-badge">L{currentLevel}: {LEVEL_LABELS[currentLevel]}</span>
    </div>
    <div class="panel-body"><svg bind:this={svgEl}></svg></div>
  </div>

  <div class="right">
    <div class="panel">
      <div class="panel-title">Dendrogram — drag ↕ or click level to switch</div>
      <div class="panel-body"><svg bind:this={dendroEl}></svg></div>
    </div>
    <div class="panel kw-panel">
      <div class="panel-title">Keywords</div>
      <div class="list-sub">{listTitle}</div>
      <div class="kw-list">
        {#if displayKws.length > 0}
          {#each displayKws as kw}<span class="chip">{kw}</span>{/each}
        {:else}
          <div class="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            {currentLevel === 0 ? 'Hover a dot' : 'Click a cell'}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
