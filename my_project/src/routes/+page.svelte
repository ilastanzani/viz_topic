<!-- Treemap — http://localhost:5173/ -->
<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { clusterKeywords, TREE, colorScale } from '$lib/data.js';

  let currentLevel = $state(1);
  let selectedId = $state(null);
  let hoveredId = $state(null);
  let svgEl = $state(null);
  let dendroEl = $state(null);
  let showDendro = $state(false);
  let fineColorById = new Map();
  let coarseColorById = new Map();

  const LEVEL_LABELS = ['Keywords', 'Fine', 'Coarse', 'Root'];
  const LEVEL_ICONS  = ['⬤', '◉', '◎', '○'];

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
  const maxDist = TREE.dist ?? allDists.at(-1) ?? 1;
  const quantileDist = q => allDists[Math.max(0, Math.floor(q * (allDists.length - 1)))];
  const LEVEL_THRESHOLDS = [null, quantileDist(0.25), quantileDist(0.60), maxDist * 1.01];

  function buildLevelClusters(level) {
    if (level === 0) return [];
    const superNodes = cutTree(TREE, LEVEL_THRESHOLDS[level]);
    return superNodes.map(sn => {
      const ids = leafIds(sn);
      const kws = ids.flatMap(id => clusterKeywords[id] ?? []);
      return {
        id: ids[0],
        ids,
        kwcount: kws.length || ids.length,
        kw0: clusterKeywords[ids[0]]?.[0] ?? String(ids[0]),
        kws
      };
    });
  }

  function buildItemsForLevel(level) {
    if (level === 0) {
      const fine = buildLevelClusters(1);
      return fine.flatMap(fc =>
        (clusterKeywords[fc.id] ?? []).map((kw, i) => ({
          id: `${fc.id}:${i}`,
          sourceId: fc.id,
          kw0: kw,
          kwcount: 1,
          kws: [kw]
        }))
      );
    }
    return buildLevelClusters(level);
  }

  function initHierarchyColors() {
    const fine = buildLevelClusters(1).sort((a, b) => a.id - b.id);
    const coarse = buildLevelClusters(2).sort((a, b) => a.id - b.id);
    const base = [
  '#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3',
  '#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd',
  '#ccebc5','#ffed6f'
].slice(0, coarse.length);

    fineColorById = new Map();
    coarseColorById = new Map();
    coarse.forEach((cc, cIdx) => {
      const coarseBase = d3.hsl(base[cIdx % base.length]);
      coarseColorById.set(cc.id, coarseBase.formatHex());
      const coarseLeafSet = new Set(cc.ids);
      const kids = fine
        .filter(fc => fc.ids.every(id => coarseLeafSet.has(id)))
        .sort((a, b) => a.id - b.id);

      kids.forEach((fc, kIdx) => {
        const t = kids.length <= 1 ? 0.5 : (kIdx / (kids.length - 1));
        const l = 0.34 + t * 0.34;
        const s = Math.min(1, Math.max(0.45, coarseBase.s));
        fineColorById.set(fc.id, d3.hsl(coarseBase.h, s, l).formatHex());
      });
    });
  }

  function itemColor(d) {
    if (currentLevel === 0) return fineColorById.get(d.sourceId) ?? colorScale(d.sourceId ?? 0);
    if (currentLevel === 1) return fineColorById.get(d.id) ?? colorScale(d.id);
    if (currentLevel === 2) return coarseColorById.get(d.id) ?? colorScale(d.id);
    return colorScale(d.id);
  }

  function splitBigram(kw) {
    const raw = String(kw ?? '').trim();
    const normalized = raw.includes(' ') ? raw : raw.replace(/[_-]+/g, ' ');
    const parts = normalized.split(/\s+/).filter(Boolean);
    return parts.length === 2 ? parts : null;
  }

  let levelItems = $derived(buildItemsForLevel(currentLevel));
  let activeId = $derived(selectedId ?? hoveredId);
  let activeItem = $derived(levelItems.find(d => String(d.id) === String(activeId)) ?? null);
  let displayKws = $derived(activeItem ? activeItem.kws : []);
  let listTitle = $derived(
    activeItem ? `${activeItem.kw0} — ${displayKws.length} keywords` : 'Click a cell to see keywords'
  );

  function getNextLevelParentMap(level) {
    const map = new Map();
    if (level >= 3) return map;
    const next = buildLevelClusters(level + 1);
    next.forEach(parent => {
      parent.ids.forEach(id => map.set(id, parent.id));
    });
    return map;
  }

  function buildGroupedTreemapData(items, level) {
    if (level >= 3) return { children: items };
    const parentMap = level === 1 ? getNextLevelParentMap(1) : null;

    const groups = d3.group(items, item => {
      if (level === 0) return `fine:${item.sourceId}`;
      if (level === 1) {
        return `coarse:${parentMap.get(item.id) ?? item.id}`;
      }
      if (level === 2) return 'root:0';
      return 'root:0';
    });

    return {
      children: Array.from(groups, ([id, children]) => ({ id, children }))
    };
  }

  function drawTreemap(el) {
    if (!el) return;
    const W = el.clientWidth || 600, H = el.clientHeight || 500;
    const items = levelItems;
    const hierData = buildGroupedTreemapData(items, currentLevel);
    const hier = d3.hierarchy(hierData).sum(d => d.kwcount ?? 0).sort((a, b) => b.value - a.value);
    d3.treemap().size([W, H]).paddingOuter(0).paddingInner(1).paddingTop(0).round(false)(hier);
    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    const cells = hier.leaves();

    svg.selectAll('rect.node').data(cells).join('rect').attr('class', 'node')
      .attr('x', d => d.x0).attr('y', d => d.y0)
      .attr('width',  d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill',   d => selectedId === d.data.id ? '#f8c948' : itemColor(d.data))
      .attr('opacity', d => { if (selectedId !== null) return selectedId === d.data.id ? 1 : 0.25; return hoveredId === d.data.id ? 1 : 0.85; })
      .attr('stroke', d => selectedId === d.data.id ? '#fff' : '#0f172a')
      .attr('stroke-width', d => selectedId === d.data.id ? 2 : 0.5)
      .style('cursor', 'pointer')
      .on('mouseenter', (_, d) => { hoveredId = d.data.id; })
      .on('mouseleave', ()     => { hoveredId = null; })
      .on('click',      (_, d) => { selectedId = selectedId === d.data.id ? null : d.data.id; hoveredId = null; });

    

    svg.selectAll('text.sub').data(cells).join('text').attr('class', 'sub')
      .attr('x', d => d.x0 + 4).attr('y', d => d.y0 + 23)
      .attr('font-size', '10px')
      .attr('fill', d => selectedId === d.data.id ? '#0f172a' : '#0f172a')
      .text(d => {
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        if (w < 50 || h < 26) return '';
        const t = d.data.kw0 || '';
        const m = Math.floor(w / 5);
        return t.length > m ? t.slice(0, m) + '\u2026' : t;
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
      .call(ax => { ax.select('.domain').remove(); ax.selectAll('.tick line').attr('stroke', '#1e3a5f').attr('stroke-dasharray', '2,3'); ax.selectAll('.tick text').attr('fill', '#475569').attr('font-size', '9px'); });
    g.selectAll('path.link').data(root.links()).join('path').attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', d => { const ids = d.target.leaves().map(l => l.data.id); if (selectedId === null) return '#334155'; return ids.includes(selectedId) ? '#f8c948' : '#1e3a5f'; })
      .attr('stroke-width', d => { const ids = d.target.leaves().map(l => l.data.id); if (selectedId === null) return 1; return ids.includes(selectedId) ? 2 : 0.8; })
      .attr('d', d => `M${d.source.x},${d.source.y}H${d.target.x}V${d.target.y}`);
    const lvs = root.leaves();
    g.selectAll('circle.leaf').data(lvs).join('circle').attr('class', 'leaf')
      .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', 4)
      .attr('fill', d => selectedId === d.data.id ? '#f8c948' : (fineColorById.get(d.data.id) ?? colorScale(d.data.id)))
      .attr('stroke', d => { if (selectedId !== null) return selectedId === d.data.id ? '#fff' : 'none'; return hoveredId === d.data.id ? '#cbd5e1' : 'none'; })
      .attr('stroke-width', 1.5).style('cursor', 'pointer')
      .on('mouseenter', (_, d) => { hoveredId = d.data.id; })
      .on('mouseleave', ()     => { hoveredId = null; })
      .on('click', (_, d) => {
        const leafId = d.data.id;
        if (currentLevel === 1) {
          selectedId = String(selectedId) === String(leafId) ? null : leafId;
          return;
        }
        if (currentLevel === 2 || currentLevel === 3) {
          const target = buildLevelClusters(currentLevel).find(c => c.ids.includes(leafId));
          selectedId = target ? (String(selectedId) === String(target.id) ? null : target.id) : null;
          return;
        }
        selectedId = null;
      });
    if (selectedId !== null) {
      const s = lvs.find(l => l.data.id === selectedId);
      if (s) g.append('text').attr('x', s.x).attr('y', s.y + 13).attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#f8c948').text(s.data.id);
    }

    const snapPYs = LEVEL_THRESHOLDS.map(d => d === null ? ih : yS(d));
    const rail = g.append('g');
    rail.append('line').attr('x1', iw + 10).attr('x2', iw + 10).attr('y1', snapPYs.at(-1)).attr('y2', snapPYs[0]).attr('stroke', '#1e3a5f').attr('stroke-width', 1);
    LEVEL_THRESHOLDS.forEach((_, lvl) => {
      const py = snapPYs[lvl];
      const grp = rail.append('g').attr('cursor', 'pointer').on('click', () => onLevelChange(lvl));
      grp.append('rect').attr('x', iw + 6).attr('y', py - 4).attr('width', 8).attr('height', 8)
        .attr('transform', `rotate(45,${iw + 10},${py})`).attr('fill', lvl === currentLevel ? '#f8c948' : '#1e3a5f').attr('stroke', lvl === currentLevel ? '#f8c948' : '#475569').attr('stroke-width', 1);
      grp.append('text').attr('x', iw + 22).attr('y', py + 3.5).attr('font-size', '9px').attr('fill', lvl === currentLevel ? '#f8c948' : '#64748b').attr('font-weight', lvl === currentLevel ? 'bold' : 'normal').text(LEVEL_LABELS[lvl]);
      grp.append('rect').attr('x', iw + 4).attr('y', py - 8).attr('width', m.right - 4).attr('height', 16).attr('fill', 'transparent');
    });

    const initPY = snapPYs[currentLevel];
    const cutG = g.append('g').style('cursor', 'ns-resize');
    const cutLine = cutG.append('line').attr('x1', -8).attr('x2', iw + 8).attr('y1', initPY).attr('y2', initPY).attr('stroke', '#f8c948').attr('stroke-width', 1.5).attr('stroke-dasharray', '5,3');
    const hdl = cutG.append('g').attr('transform', `translate(-18,${initPY})`);
    hdl.append('circle').attr('r', 7).attr('fill', '#f8c948').attr('stroke', '#0f172a').attr('stroke-width', 1.5);
    hdl.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('font-size', '9px').attr('fill', '#0f172a').attr('font-weight', 'bold').text('↕');
    const cutLbl = cutG.append('text').attr('x', -18).attr('y', initPY - 11).attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#f8c948').text(LEVEL_LABELS[currentLevel]);
    const cutBand = cutG.append('rect').attr('x', -8).attr('width', iw + 16).attr('y', initPY - 1).attr('height', 2).attr('fill', '#f8c948').attr('opacity', 0.15);
    const moveCut = py => { cutLine.attr('y1', py).attr('y2', py); hdl.attr('transform', `translate(-18,${py})`); cutLbl.attr('y', py - 11); cutBand.attr('y', py - 1); };
    cutG.call(d3.drag()
      .on('start', () => cutG.raise())
      .on('drag', event => {
        const py = Math.max(0, Math.min(ih, event.y));
        moveCut(py);
        const n = snapPYs.reduce((b, sy, i) => Math.abs(sy - py) < Math.abs(snapPYs[b] - py) ? i : b, 0);
        cutLbl.text(LEVEL_LABELS[n]);
      })
      .on('end', event => {
        const py = Math.max(0, Math.min(ih, event.y));
        const n = snapPYs.reduce((b, sy, i) => Math.abs(sy - py) < Math.abs(snapPYs[b] - py) ? i : b, 0);
        moveCut(snapPYs[n]);
        cutLbl.text(LEVEL_LABELS[n]);
        if (n !== currentLevel) onLevelChange(n);
      })
    );
  }

  function onLevelChange(lvl) {
    currentLevel = lvl;
    selectedId = null;
    hoveredId = null;
  }

  $effect(() => {
    const _lvl = currentLevel;
    const _tree = showDendro;
    const _s = selectedId, _h = hoveredId;
    if (svgEl) drawTreemap(svgEl);
    if (showDendro && dendroEl) drawDendrogram(dendroEl);
  });

  onMount(() => {
    initHierarchyColors();
    const ro = new ResizeObserver(() => {
      if (svgEl) drawTreemap(svgEl);
      if (showDendro && dendroEl) drawDendrogram(dendroEl);
    });
    [svgEl, dendroEl].forEach(el => el && ro.observe(el));
    return () => ro.disconnect();
  });
</script>

<style>
  .shell {
    display: flex;
    height: 100%;
    min-height: 0;
    gap: 0;
    position: relative;
  }
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
    letter-spacing: 0.12em;
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
    transition: all 0.15s;
    padding: 0;
  }
  .lvl-btn:hover  { border-color: #64748b; color: #94a3b8; background: #0f172a; }
  .lvl-btn.active { border-color: #f8c948; color: #f8c948; background: #1e3a5f; }
  .lvl-btn .icon { font-size: 11px; line-height: 1; }
  .lvl-btn .lbl  { font-size: 7px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1; }
  .sidebar-spacer { flex: 1; }
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
    transition: all 0.15s;
    padding: 0;
  }
  .tree-toggle:hover  { border-color: #64748b; color: #94a3b8; background: #0f172a; }
  .tree-toggle.active { border-color: #f8c948; color: #f8c948; background: #1e3a5f; }
  .tree-toggle .icon { font-size: 14px; line-height: 1; }
  .tree-toggle .lbl  { font-size: 6px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1; }

  .main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .main-row {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 10px;
    padding: 10px;
    position: relative;
  }
  .panel { background:#1e293b; border:1px solid #334155; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; }
  .panel-title { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#64748b; padding:8px 14px 6px; border-bottom:1px solid #1e3a5f; flex-shrink:0; display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
  .level-badge {
    display: inline-block;
    margin-left: 4px;
    background: #1e3a5f;
    border: 1px solid #334155;
    border-radius: 20px;
    padding: 1px 8px;
    font-size: 9px;
    color: #f8c948;
    letter-spacing: 0.06em;
    text-transform: none;
    white-space: nowrap;
  }
  .panel-body  { flex:1; overflow:hidden; }
  .panel-body svg { display:block; width:100%; height:100%; }
  .left  { flex:0 0 62%; }
  .right { flex:1; display:flex; flex-direction:column; gap:10px; }
  .kw-panel { flex:0 0 36% !important; }
  .panel-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .panel-btn {
    height: 20px; border-radius: 6px; border: 1px solid #334155;
    background: transparent; color: #94a3b8; font-size: 10px; padding: 0 8px; cursor: pointer;
  }
  .panel-btn:hover { border-color:#64748b; color:#e2e8f0; background:#0f172a; }
  .dendro-window {
    position: absolute; top: 14px; right: 14px;
    width: 420px; height: 260px;
    background: #1e293b; border: 1px solid #334155; border-radius: 12px;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 20;
  }
  .dendro-window.hidden { display:none; }
  .list-sub { padding:5px 14px; font-size:11px; color:#94a3b8; border-bottom:1px solid #1e3a5f; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .kw-list  { flex:1; overflow-y:auto; padding:6px 10px; }
  .kw-list::-webkit-scrollbar { width:4px; }
  .kw-list::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }
  .chip { display:inline-block; background:#0f172a; border:1px solid #334155; border-radius:20px; padding:3px 10px; margin:3px; font-size:11px; color:#94a3b8; transition:all .12s; }
  .chip:hover { background:#1e40af; border-color:#3b82f6; color:#fff; }
  .chip.bigram { white-space:normal; display:inline-flex; flex-direction:column; align-items:center; line-height:1.05; padding:4px 10px; }
  .empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#334155; font-size:12px; gap:6px; }

  /* Light theme overrides */
  .sidebar { background: #eef3f9; border-right-color: #d6deea; }
  .sidebar-label { color: #64748b; }
  .lvl-btn, .tree-toggle { border-color: #c9d5e5; color: #475569; background: #ffffff; }
  .lvl-btn:hover, .tree-toggle:hover { background: #f4f7fb; border-color: #94a3b8; color: #334155; }
  .lvl-btn.active, .tree-toggle.active { background: #fff7db; color: #7c5a00; border-color: #f8c948; }
  .panel { background: #ffffff; border-color: #d6deea; }
  .panel-title { color: #334155; border-bottom-color: #dbe4ef; }
  .level-badge { background: #fff7db; border-color: #f8c948; color: #7c5a00; }
  .list-sub { color: #475569; border-bottom-color: #dbe4ef; }
  .kw-list::-webkit-scrollbar-thumb { background: #c9d5e5; }
  .chip { background: #ffffff; border-color: #c9d5e5; color: #475569; }
  .chip:hover { background: #e8f0fe; border-color: #93c5fd; color: #1e3a8a; }
  .dendro-window { background: #ffffff; border-color: #d6deea; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); }
</style>

<div class="shell">
  <aside class="sidebar">
    <span class="sidebar-label">Granularity</span>
    {#each LEVEL_LABELS as lbl, lvl}
      <button
        type="button"
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
      type="button"
      class="tree-toggle {showDendro ? 'active' : ''}"
      onclick={() => (showDendro = !showDendro)}
      title={showDendro ? 'Hide dendrogram' : 'Show dendrogram'}
    >
      <span class="icon">⎇</span>
      <span class="lbl">{showDendro ? 'hide' : 'tree'}</span>
    </button>
  </aside>

  <div class="main">
  <div class="main-row">
  <div class="panel left">
    <div class="panel-title">
      {currentLevel === 0
        ? 'Keyword Treemap — one cell per keyword'
        : 'Cluster Treemap — size ∝ keyword count'}
      <span class="level-badge">{LEVEL_LABELS[currentLevel]}</span>
    </div>
    <div class="panel-body"><svg bind:this={svgEl}></svg></div>
  </div>

  <div class="right">
    <div class="panel kw-panel">
      <div class="panel-title">Keywords</div>
      <div class="list-sub">{listTitle}</div>
      <div class="kw-list">
        {#if displayKws.length > 0}
          {#each displayKws as kw}
            {#if splitBigram(kw)}
              <span class="chip bigram">{splitBigram(kw)[0]}<br />{splitBigram(kw)[1]}</span>
            {:else}
              <span class="chip">{kw}</span>
            {/if}
          {/each}
        {:else}
          <div class="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            Select a cluster
          </div>
        {/if}
      </div>
    </div>
  </div>
  </div>

  <div class="dendro-window {showDendro ? '' : 'hidden'}">
    <div class="panel-title panel-head">
      <span>Agglomerative Dendrogram</span>
      <button class="panel-btn" onclick={() => showDendro = false}>Hide</button>
    </div>
    <div class="panel-body"><svg bind:this={dendroEl}></svg></div>
  </div>
  </div>
</div>
