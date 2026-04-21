<!-- src/routes/v3/+page.svelte -->
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
  let ro         = null;

  const getMap    = () => document.getElementById('map-svg');
  const getDendro = () => document.getElementById('dendro-svg');

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

  const LEVEL_THRESHOLDS = [null, quantileDist(0.25), quantileDist(0.60), maxDist * 1.01];
  const LEVEL_LABELS     = ['Keywords', 'Fine', 'Coarse', 'Root'];
  const LEVEL_ICONS      = ['⬤', '◉', '◎', '○'];

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
    const el = getMap();
    if (!el) return;
    if (currentLevel === 0) { drawKeywordDots(el); return; }

    const clusters = buildLevelClusters(currentLevel);
    const W = el.clientWidth || 600, H = el.clientHeight || 500;
    const { xS, yS } = makeScales(W, H);
    const fontScale  = d3.scaleSqrt()
      .domain([d3.min(clusters, d => d.kwcount), d3.max(clusters, d => d.kwcount)])
      .range([9, 26]).clamp(true);

    const pts     = clusters.map(c => [xS(c.cx), yS(c.cy)]);
    const voronoi = d3.Delaunay.from(pts).voronoi([0, 0, W, H]);

    _cells = clusters.map((c, i) => ({
      ...c, screenX: pts[i][0], screenY: pts[i][1],
      path: voronoi.renderCell(i), fontSize: fontScale(c.kwcount),
    }));

    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    svg.append('g').attr('class', 'hits')
      .selectAll('path').data(_cells, d => d.id).join('path')
        .attr('class', 'hit').attr('d', d => d.path)
        .attr('fill', d => colorScale(d.id))
        .attr('fill-opacity', d => selectedId !== null ? (selectedId===d.id ? 0.18 : 0.04) : (hoveredId===d.id ? 0.14 : 0.04))
        .attr('stroke', d => selectedId===d.id ? colorScale(d.id) : hoveredId===d.id ? '#334155' : '#1e3a5f')
        .attr('stroke-width', d => (selectedId===d.id || hoveredId===d.id) ? 1 : 0.5)
        .attr('stroke-dasharray', d => selectedId===d.id ? 'none' : '3,3')
        .style('cursor', 'pointer')
        .on('mouseenter', (_, d) => { hoveredId = d.id;  updateMapStyles(); updateDendroStyles(); refreshInfo(); })
        .on('mouseleave', ()     => { hoveredId = null;  updateMapStyles(); updateDendroStyles(); refreshInfo(); })
        .on('click',      (_, d) => {
          selectedId = selectedId===d.id ? null : d.id; hoveredId = null;
          updateMapStyles(); updateDendroStyles(); refreshInfo(); drawSubLabels(el);
        });

    svg.append('g').attr('class', 'labels')
      .selectAll('text').data(_cells, d => d.id).join('text')
        .attr('x', d => d.screenX).attr('y', d => d.screenY)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
        .attr('font-size', d => d.fontSize + 'px')
        .attr('font-weight', d => selectedId===d.id ? '700' : '500')
        .attr('fill', d => lblColor(d))
        .attr('paint-order', 'stroke').attr('stroke', '#0f172a')
        .attr('stroke-width', d => selectedId===d.id ? '3px' : '2px')
        .attr('stroke-linejoin', 'round').attr('pointer-events', 'none')
        .text(d => d.kw0);

    svg.append('g').attr('class', 'sublevel-layer');
    if (selectedId !== null) drawSubLabels(el);
  }

  function lblColor(d) {
    if (selectedId===d.id) return '#f8c948';
    const col = d3.color(colorScale(d.id));
    if (col) { col.opacity = selectedId!==null ? 0.3 : hoveredId===d.id ? 1 : 0.85; return col+''; }
    return colorScale(d.id);
  }

  function updateMapStyles() {
    const el = getMap(); if (!el || currentLevel===0) return;
    d3.select(el).selectAll('path.hit')
      .attr('fill-opacity', d => selectedId!==null ? (selectedId===d.id ? 0.18 : 0.04) : (hoveredId===d.id ? 0.14 : 0.04))
      .attr('stroke', d => selectedId===d.id ? colorScale(d.id) : hoveredId===d.id ? '#334155' : '#1e3a5f')
      .attr('stroke-width', d => (selectedId===d.id||hoveredId===d.id) ? 1 : 0.5)
      .attr('stroke-dasharray', d => selectedId===d.id ? 'none' : '3,3');
    d3.select(el).selectAll('.labels text')
      .attr('font-weight', d => selectedId===d.id ? '700' : '500')
      .attr('fill', d => lblColor(d))
      .attr('stroke-width', d => selectedId===d.id ? '3px' : '2px');
  }

  function drawSubLabels(el) {
    const svg = d3.select(el);
    svg.select('g.sublevel-layer').selectAll('*').remove();
    svg.selectAll('defs.sub-defs').remove();
    if (!selectedId) return;
    const selCell = _cells.find(c => c.id === selectedId); if (!selCell) return;
    const W = el.clientWidth||600, H = el.clientHeight||500;
    const { xS, yS } = makeScales(W, H);
    const clipId = `clip-${selCell.id}`;
    svg.append('defs').attr('class', 'sub-defs')
      .append('clipPath').attr('id', clipId).append('path').attr('d', selCell.path);
    const grp = svg.select('g.sublevel-layer').append('g')
      .attr('clip-path', `url(#${clipId})`).attr('pointer-events', 'none');

    if (currentLevel === 1) {
      const kws = clusterKeywords[selCell.id] ?? []; if (!kws.length) return;
      const hits  = el.querySelectorAll('path.hit');
      const idx   = _cells.findIndex(c => c.id===selectedId);
      const bbox  = hits[idx]?.getBBox() ?? { width:140, height:140 };
      const inner = Math.max(Math.min(bbox.width, bbox.height) * 0.38 - 4, 20);
      grp.selectAll('text').data(kws.map((kw, i) => {
        const a = i*2.399963, r = inner*Math.sqrt((i+0.5)/kws.length);
        return { kw, x: selCell.screenX+r*Math.cos(a), y: selCell.screenY+r*Math.sin(a) };
      })).join('text')
        .attr('x', d=>d.x).attr('y', d=>d.y).attr('text-anchor','middle').attr('dominant-baseline','central')
        .attr('font-size','7px').attr('fill','#cbd5e1')
        .attr('paint-order','stroke').attr('stroke','#0f172a').attr('stroke-width','2px').attr('stroke-linejoin','round')
        .text(d=>d.kw);
    } else if (currentLevel === 2) {
      const subs = buildLevelClusters(1).filter(fc => selCell.ids.some(id => fc.ids.includes(id)));
      if (!subs.length) return;
      const subFont = d3.scaleSqrt().domain([d3.min(subs,d=>d.kwcount),d3.max(subs,d=>d.kwcount)]).range([7,14]).clamp(true);
      const subPts  = subs.map(s=>[xS(s.cx),yS(s.cy)]);
      const subV    = d3.Delaunay.from(subPts).voronoi([0,0,W,H]);
      const sc      = subs.map((s,i)=>({...s, screenX:subPts[i][0], screenY:subPts[i][1], path:subV.renderCell(i)}));
      grp.selectAll('path').data(sc).join('path').attr('d',d=>d.path)
        .attr('fill',d=>colorScale(d.id)).attr('fill-opacity',0.08)
        .attr('stroke','#1e3a5f').attr('stroke-width',0.6).attr('stroke-dasharray','2,2');
      grp.selectAll('text').data(sc).join('text')
        .attr('x',d=>d.screenX).attr('y',d=>d.screenY).attr('text-anchor','middle').attr('dominant-baseline','central')
        .attr('font-size',d=>subFont(d.kwcount)+'px').attr('font-weight','600').attr('fill',d=>colorScale(d.id))
        .attr('paint-order','stroke').attr('stroke','#0f172a').attr('stroke-width','2.5px').attr('stroke-linejoin','round')
        .text(d=>d.kw0);
    }
  }

  function drawKeywordDots(el) {
    const W = el.clientWidth||600, H = el.clientHeight||500;
    const { xS, yS } = makeScales(W, H);
    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    const bv = d3.Delaunay.from(aggClusters.map(c=>[xS(c.cx),yS(c.cy)])).voronoi([0,0,W,H]);
    svg.append('g').selectAll('path').data(aggClusters).join('path')
      .attr('d',(_, i)=>bv.renderCell(i)).attr('fill',d=>colorScale(d.id))
      .attr('fill-opacity',d=>hoveredId===d.id ? 0.14 : 0.05).attr('stroke','#1e3a5f').attr('stroke-width',0.5).attr('pointer-events','none');
    svg.selectAll('text').data(kwDots.map(d=>({...d,px:xS(d.cx),py:yS(d.cy)}))).join('text')
      .attr('x',d=>d.px).attr('y',d=>d.py).attr('text-anchor','middle').attr('dominant-baseline','central')
      .attr('font-size','7px').attr('fill',d=>colorScale(d.clusterId))
      .attr('opacity',d=>hoveredId===d.clusterId ? 1 : 0.5)
      .attr('paint-order','stroke').attr('stroke','#0f172a').attr('stroke-width','1.5px').style('cursor','default')
      .on('mouseenter',(_, d)=>{ hoveredId=d.clusterId; updateDotStyles(); refreshInfo(); })
      .on('mouseleave',()=>{ hoveredId=null; updateDotStyles(); refreshInfo(); });
  }

  function updateDotStyles() {
    const el = getMap(); if (!el||currentLevel!==0) return;
    d3.select(el).selectAll('text').attr('opacity',d=>hoveredId===d.clusterId ? 1 : 0.5);
  }

  // ── Dendrogram ────────────────────────────────────────────────────────────────
  function updateDendroStyles() {
    const el = getDendro(); if (!el) return;
    d3.select(el).selectAll('path.link')
      .attr('stroke', d => selectedId!==null && d.target.leaves().map(l=>l.data.id).includes(selectedId) ? '#f8c948' : '#334155')
      .attr('stroke-width', d => selectedId!==null && d.target.leaves().map(l=>l.data.id).includes(selectedId) ? 2 : 1);
    d3.select(el).selectAll('circle.leaf')
      .attr('fill', d => selectedId===d.data.id ? '#f8c948' : colorScale(d.data.id))
      .attr('stroke', d => selectedId!==null ? (selectedId===d.data.id ? '#fff':'none') : (hoveredId===d.data.id ? '#cbd5e1':'none'));
  }

  function drawDendrogram() {
    const el = getDendro(); if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    const m  = { top:14, right:64, bottom:10, left:38 };
    const iw = W-m.left-m.right, ih = H-m.top-m.bottom;
    const root = d3.hierarchy(TREE, n=>n.children);
    d3.cluster().size([iw, ih])(root);
    const yS = d3.scaleLinear().domain([0, maxDist]).range([ih, 0]);
    root.each(n => { n.y = yS(n.data.dist ?? 0); });
    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    g.append('g').call(d3.axisLeft(yS).ticks(5).tickSize(-iw))
      .call(ax => {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').attr('stroke','#1e3a5f').attr('stroke-dasharray','2,3');
        ax.selectAll('.tick text').attr('fill','#475569').attr('font-size','9px');
      });
    g.selectAll('path.link').data(root.links()).join('path').attr('class','link')
      .attr('fill','none')
      .attr('stroke', d => selectedId!==null && d.target.leaves().map(l=>l.data.id).includes(selectedId) ? '#f8c948' : '#334155')
      .attr('stroke-width', d => selectedId!==null && d.target.leaves().map(l=>l.data.id).includes(selectedId) ? 2 : 1)
      .attr('d', d=>`M${d.source.x},${d.source.y}H${d.target.x}V${d.target.y}`);
    const lvs = root.leaves();
    g.selectAll('circle.leaf').data(lvs).join('circle').attr('class','leaf')
      .attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',4)
      .attr('fill',d=>selectedId===d.data.id ? '#f8c948' : colorScale(d.data.id))
      .attr('stroke',d=>selectedId!==null?(selectedId===d.data.id?'#fff':'none'):(hoveredId===d.data.id?'#cbd5e1':'none'))
      .attr('stroke-width',1.5).style('cursor','pointer')
      .on('mouseenter',(_, d)=>{ hoveredId=d.data.id; updateDotStyles(); updateDendroStyles(); })
      .on('mouseleave',()=>{ hoveredId=null; updateDotStyles(); updateDendroStyles(); })
      .on('click',(_, d)=>{
        selectedId = String(selectedId)===String(d.data.id) ? null : d.data.id;
        updateMapStyles(); updateDendroStyles(); refreshInfo(); drawSubLabels(getMap());
      });
    if (selectedId!==null) {
      const s = lvs.find(l=>l.data.id===selectedId);
      if (s) g.append('text').attr('x',s.x).attr('y',s.y+13).attr('text-anchor','middle').attr('font-size','8px').attr('fill','#f8c948').text(s.data.id);
    }
    // snap rail
    const snapPYs = LEVEL_THRESHOLDS.map(d => d===null ? ih : yS(d));
    const rail = g.append('g');
    rail.append('line').attr('x1',iw+10).attr('x2',iw+10).attr('y1',snapPYs.at(-1)).attr('y2',snapPYs[0]).attr('stroke','#1e3a5f').attr('stroke-width',1);
    LEVEL_THRESHOLDS.forEach((_,lvl)=>{
      const py=snapPYs[lvl], act=lvl===currentLevel;
      const grp=rail.append('g').attr('cursor','pointer').on('click',()=>onLevelChange(lvl));
      grp.append('rect').attr('x',iw+6).attr('y',py-4).attr('width',8).attr('height',8)
        .attr('transform',`rotate(45,${iw+10},${py})`).attr('fill',act?'#f8c948':'#1e3a5f').attr('stroke',act?'#f8c948':'#475569').attr('stroke-width',1);
      grp.append('text').attr('x',iw+22).attr('y',py+3.5).attr('font-size','9px').attr('fill',act?'#f8c948':'#64748b').attr('font-weight',act?'bold':'normal').text(LEVEL_LABELS[lvl]);
      grp.append('rect').attr('x',iw+4).attr('y',py-8).attr('width',m.right-4).attr('height',16).attr('fill','transparent');
    });
    // cut line
    const iPY=snapPYs[currentLevel];
    const cutG=g.append('g').style('cursor','ns-resize');
    const cutLine=cutG.append('line').attr('x1',-8).attr('x2',iw+8).attr('y1',iPY).attr('y2',iPY).attr('stroke','#f8c948').attr('stroke-width',1.5).attr('stroke-dasharray','5,3');
    const hdl=cutG.append('g').attr('transform',`translate(-18,${iPY})`);
    hdl.append('circle').attr('r',7).attr('fill','#f8c948').attr('stroke','#0f172a').attr('stroke-width',1.5);
    hdl.append('text').attr('text-anchor','middle').attr('dominant-baseline','central').attr('font-size','9px').attr('fill','#0f172a').attr('font-weight','bold').text('↕');
    const cutLbl=cutG.append('text').attr('x',-18).attr('y',iPY-11).attr('text-anchor','middle').attr('font-size','8px').attr('fill','#f8c948').text(LEVEL_LABELS[currentLevel]);
    const cutBand=cutG.append('rect').attr('x',-8).attr('width',iw+16).attr('y',iPY-1).attr('height',2).attr('fill','#f8c948').attr('opacity',0.15);
    const moveCut=py=>{ cutLine.attr('y1',py).attr('y2',py); hdl.attr('transform',`translate(-18,${py})`); cutLbl.attr('y',py-11); cutBand.attr('y',py-1); };
    cutG.call(d3.drag()
      .on('start',()=>cutG.raise())
      .on('drag',event=>{ const py=Math.max(0,Math.min(ih,event.y)); const n=snapPYs.reduce((b,sy,i)=>Math.abs(sy-py)<Math.abs(snapPYs[b]-py)?i:b,0); moveCut(py); cutLbl.text(LEVEL_LABELS[n]); })
      .on('end',event=>{ const py=Math.max(0,Math.min(ih,event.y)); const n=snapPYs.reduce((b,sy,i)=>Math.abs(sy-py)<Math.abs(snapPYs[b]-py)?i:b,0); moveCut(snapPYs[n]); cutLbl.text(LEVEL_LABELS[n]); if(n!==currentLevel) onLevelChange(n); })
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
    drawMap(); refreshInfo();

    ro = new ResizeObserver(() => { drawMap(); if (showDendro) drawDendrogram(); });
    ro.observe(getMap());

    // Make the floating dendrogram window draggable
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

  /* ── Left sidebar: always visible, vertical level selector ── */
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
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: #334155;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    margin-bottom: 8px;
    user-select: none;
  }

  .lvl-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid #334155;
    background: transparent;
    color: #475569;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    transition: all .15s;
    padding: 0;
  }
  .lvl-btn:hover { border-color: #64748b; color: #94a3b8; background: #0f172a; }
  .lvl-btn.active { border-color: #f8c948; color: #f8c948; background: #1e3a5f; }
  .lvl-btn .icon  { font-size: 11px; line-height: 1; }
  .lvl-btn .lbl   { font-size: 7px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; line-height: 1; }

  .sidebar-spacer { flex: 1; }

  /* Tree toggle button at bottom of sidebar */
  .tree-toggle {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid #334155;
    background: transparent;
    color: #475569;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    transition: all .15s;
    padding: 0;
  }
  .tree-toggle:hover { border-color: #64748b; color: #94a3b8; background: #0f172a; }
  .tree-toggle.active { border-color: #f8c948; color: #f8c948; background: #1e3a5f; }
  .tree-toggle .icon { font-size: 14px; line-height: 1; }
  .tree-toggle .lbl  { font-size: 6px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; line-height: 1; }

  /* ── Main area ── */
  .main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;   /* anchor for the floating dendro window */
  }

  /* ── Map panel ── */
  .map-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .map-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px 6px;
    border-bottom: 1px solid #1e3a5f;
    flex-shrink: 0;
  }
  .map-title {
    font-size: 10px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: #64748b; flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .level-badge {
    background: #1e3a5f; border: 1px solid #334155; border-radius: 20px;
    padding: 1px 8px; font-size: 9px; color: #f8c948; letter-spacing: .06em;
    text-transform: none; white-space: nowrap; flex-shrink: 0;
  }
  .map-body { flex: 1; min-height: 0; overflow: hidden; }
  .map-body svg { display: block; width: 100%; height: 100%; }

  /* ── Keyword strip at bottom ── */
  .kw-strip {
    flex-shrink: 0;
    max-height: 30vh; /*1220px;*/
    border-top: 1px solid #1e3a5f;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #1e293b;
  }
  .kw-strip-title {
    font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    color: #475569; padding: 5px 14px 3px; flex-shrink: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .kw-strip-scroll {
    overflow-x: auto; overflow-y: auto;
    flex-wrap: wrap; 
    display: flex;
    padding: 2px 10px 8px;
    white-space: nowrap;
    flex: 1;
  }
  .kw-strip-scroll::-webkit-scrollbar { height: 3px; }
  .kw-strip-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
  .chip {
    display: inline-block; background: #0f172a; border: 1px solid #334155; border-radius: 20px;
    padding: 2px 9px; margin: 2px; font-size: 10px; color: #94a3b8; transition: all .12s;
    white-space: nowrap;
  }
  .chip:hover { background: #1e40af; border-color: #3b82f6; color: #fff; }
  .kw-empty {
    padding: 8px 14px; font-size: 11px; color: #334155;
  }

  /* ── Floating dendrogram window ── */
  .dendro-window {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 420px;
    height: 260px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 10;
    /* draggable via JS */
  }
  .dendro-window.hidden { display: none; }

  .dendro-header {
    display: flex;
    align-items: center;
    padding: 7px 10px 6px 14px;
    border-bottom: 1px solid #1e3a5f;
    flex-shrink: 0;
    cursor: move;
    user-select: none;
  }
  .dendro-title {
    font-size: 10px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: #64748b; flex: 1;
  }
  .dendro-close {
    width: 20px; height: 20px; border-radius: 4px; border: 1px solid #334155;
    background: transparent; color: #475569; cursor: pointer; font-size: 12px;
    display: flex; align-items: center; justify-content: center; transition: all .12s;
    flex-shrink: 0;
  }
  .dendro-close:hover { border-color: #f87171; color: #f87171; background: #1e1e2e; }

  .dendro-body { flex: 1; min-height: 0; overflow: hidden; }
  .dendro-body svg { display: block; width: 100%; height: 100%; }
</style>

<div class="shell">

  <!-- ── Left sidebar: permanent granularity selector ── -->
  <aside class="sidebar">
    <span class="sidebar-label">Granularity</span>

    {#each LEVEL_LABELS as lbl, lvl}
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

    <!-- dendrogram toggle at bottom of sidebar -->
    <button
      class="tree-toggle {showDendro ? 'active' : ''}"
      onclick={toggleDendro}
      title={showDendro ? 'Hide dendrogram' : 'Show dendrogram'}
    >
      <span class="icon">⎇</span>
      <span class="lbl">{showDendro ? 'hide' : 'tree'}</span>
    </button>
  </aside>

  <!-- ── Main area: map + keyword strip + floating dendro window ── -->
  <div class="main">

    <!-- map -->
    <div class="map-panel">
      <div class="map-header">
        <span class="map-title">
          {currentLevel === 0 ? 'All keywords — hover to highlight' : 'Word map — size = keyword count · click to drill in'}
        </span>
        <span class="level-badge">{LEVEL_LABELS[currentLevel]}</span>
      </div>
      <div class="map-body">
        <svg id="map-svg"></svg>
      </div>
    </div>

    <!-- keyword strip -->
    <div class="kw-strip">
      <div class="kw-strip-title">{listTitle}</div>
      {#if displayKws.length > 0}
        <div class="kw-strip-scroll">
          {#each displayKws as kw}<span class="chip">{kw}</span>{/each}
        </div>
      {:else}
        <div class="kw-empty">{currentLevel === 0 ? 'Hover a dot' : 'Click a label'}</div>
      {/if}
    </div>

    <!-- floating dendrogram window -->
    <div
      id="dendro-window"
      class="dendro-window {showDendro ? '' : 'hidden'}"
    >
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


