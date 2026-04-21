 <script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  import { clusterKeywords, TREE, aggClusters, colorScale } from '$lib/data.js';

  // ── Granularity helpers ───────────────────────────────────────────────────────
  function cutTree(node, threshold) {
    if (!node.children) return [[node.id]];
    if (node.dist <= threshold) {
      var leaves = [];
      function collectLeaves(n) {
        if ('id' in n) leaves.push(n.id);
        else if (n.children) n.children.forEach(collectLeaves);
      }
      collectLeaves(node);
      return [leaves];
    }
    return node.children.reduce(function(acc, c) {
      return acc.concat(cutTree(c, threshold));
    }, []);
  }

  var LEVEL_THRESHOLDS = [0, 2.0, 6.5, 14.0, 25.0];
  var LEVEL_LABELS = ['Keywords', 'Fine', 'Medium', 'Coarse', 'Root'];

  function getGroupsAtLevel(level) {
    return cutTree(TREE, LEVEL_THRESHOLDS[level]);
  }

  function buildMergedCluster(ids, groupIdx) {
    var leaves = aggClusters.filter(function(c) { return ids.indexOf(c.id) !== -1; });
    var cx = d3.mean(leaves, function(d) { return d.cx; });
    var cy = d3.mean(leaves, function(d) { return d.cy; });
    var kwcount = d3.sum(leaves, function(d) { return d.kwcount; });
    var kw0 = leaves.length > 0 ? leaves[0].kw0 : '';
    return { id: groupIdx, ids: ids, cx: cx, cy: cy, kwcount: kwcount, kw0: kw0 };
  }

  function getGroupColor(ids) {
    return colorScale(d3.mean(ids));
  }

  function getDisplayClusters(level) {
    if (level === 0) {
      return aggClusters.map(function(d) {
        return Object.assign({}, d, { ids: [d.id], groupIdx: d.id, color: colorScale(d.id) });
      });
    }
    var groups = getGroupsAtLevel(level);
    return groups.map(function(ids, groupIdx) {
      var m = buildMergedCluster(ids, groupIdx);
      return Object.assign({}, m, { groupIdx: groupIdx, color: getGroupColor(ids) });
    });
  }

  // ── State ─────────────────────────────────────────────────────────────────────
  let selectedId = null;
  let hoveredId  = null;
  let granularity = 2;
  let isTransitioning = false;

  // Svelte 4 reactive declarations
  $: activeDisplayClusters = getDisplayClusters(granularity);
  $: activeCluster = selectedId !== null ? activeDisplayClusters[selectedId] : null;
  $: displayKws = (function() {
    if (!activeCluster) return [];
    if (granularity === 0) return clusterKeywords[activeCluster.id] || [];
    var allKws = (activeCluster.ids || []).reduce(function(acc, id) {
      return acc.concat(clusterKeywords[id] || []);
    }, []);
    return allKws.slice(0, 40);
  })();
  $: listTitle = selectedId !== null
    ? ('Cluster ' + selectedId + ' — ' + (activeCluster && activeCluster.ids ? activeCluster.ids.length : 1) + ' leaf cluster' + ((activeCluster && activeCluster.ids && activeCluster.ids.length !== 1) ? 's' : ''))
    : hoveredId !== null
    ? ('Cluster ' + hoveredId + ' (hover)')
    : 'Click a bubble to see keywords';
  $: granTrackWidth = (granularity / 4) * 100;

  let bubbleEl;
  let dendroEl;
  let simulation;
  let bubbleNodes = [];

  // ── BUBBLE CHART ──────────────────────────────────────────────────────────────
  function drawBubble(el, animate) {
    animate = animate || false;
    var W = el.clientWidth  || 600;
    var H = el.clientHeight || 500;

    var displayClusters = getDisplayClusters(granularity);

    var xExt = d3.extent(aggClusters, function(d) { return d.cx; });
    var yExt = d3.extent(aggClusters, function(d) { return d.cy; });
    var xSc  = d3.scaleLinear().domain([xExt[0]-0.5, xExt[1]+0.5]).range([0, W]);
    var ySc  = d3.scaleLinear().domain([yExt[0]-0.5, yExt[1]+0.5]).range([H, 0]);
    var rSc  = d3.scaleSqrt().domain([3, 300]).range([7, 45]);

    var svg = d3.select(el).attr('width', W).attr('height', H);

    var prevByKey = {};
    bubbleNodes.forEach(function(n) {
      var key = n.ids ? n.ids.slice().sort().join(',') : String(n.groupIdx);
      prevByKey[key] = n;
    });

    var newNodes = displayClusters.map(function(d) {
      var tx = xSc(d.cx);
      var ty = ySc(d.cy);
      var r  = rSc(d.kwcount);
      var key = d.ids ? d.ids.slice().sort().join(',') : String(d.groupIdx);
      var prev = prevByKey[key];
      return Object.assign({}, d, {
        r: r, tx: tx, ty: ty,
        x: prev ? prev.x : tx + (Math.random() - 0.5) * 10,
        y: prev ? prev.y : ty + (Math.random() - 0.5) * 10,
        vx: 0, vy: 0
      });
    });

    bubbleNodes = newNodes;
    svg.selectAll('*').remove();

    svg.selectAll('line.cx-h').data(bubbleNodes).join('line').attr('class','cx-h')
      .attr('x1', function(d) { return d.tx-5; }).attr('x2', function(d) { return d.tx+5; })
      .attr('y1', function(d) { return d.ty; }).attr('y2', function(d) { return d.ty; })
      .attr('stroke','#ffffff10').attr('stroke-width',1);
    svg.selectAll('line.cx-v').data(bubbleNodes).join('line').attr('class','cx-v')
      .attr('x1', function(d) { return d.tx; }).attr('x2', function(d) { return d.tx; })
      .attr('y1', function(d) { return d.ty-5; }).attr('y2', function(d) { return d.ty+5; })
      .attr('stroke','#ffffff10').attr('stroke-width',1);

    var keyFn = function(d) { return d.ids ? d.ids.slice().sort().join(',') : String(d.groupIdx); };

    var circles = svg.selectAll('circle.bubble')
      .data(bubbleNodes, keyFn)
      .join(
        function(enter) {
          var e = enter.append('circle').attr('class','bubble')
            .attr('cx', function(d) { return d.tx; })
            .attr('cy', function(d) { return d.ty; })
            .attr('r', 0).attr('opacity', 0);
          if (animate) {
            e.transition().duration(500).delay(function(_, i) { return i * 6; })
              .attr('r', function(d) { return d.r; }).attr('opacity', 0.82);
          } else {
            e.attr('r', function(d) { return d.r; }).attr('opacity', 0.82);
          }
          return e;
        },
        function(update) { return update; },
        function(exit) {
          return exit.transition().duration(350).attr('r', 0).attr('opacity', 0).remove();
        }
      )
      .attr('fill', function(d) { return d.color; })
      .attr('stroke','none').attr('stroke-width',2)
      .style('cursor','pointer')
      .on('mouseenter', function(event, d) {
        hoveredId = d.groupIdx;
        circles
          .attr('r',       function(n) { return n.groupIdx===d.groupIdx ? n.r*1.35 : n.r; })
          .attr('opacity', function(n) { return n.groupIdx===d.groupIdx ? 1 : 0.4; })
          .attr('stroke',  function(n) { return n.groupIdx===d.groupIdx ? '#ffffffcc' : 'none'; });
        labels
          .attr('font-size',   function(n) { return n.groupIdx===d.groupIdx ? '11px' : (n.r>16?'9px':'7px'); })
          .attr('font-weight', function(n) { return n.groupIdx===d.groupIdx ? 'bold' : 'normal'; });
        if (dendroEl) drawDendrogram(dendroEl);
      })
      .on('mouseleave', function() {
        hoveredId = null;
        refreshBubbleStyles();
        if (dendroEl) drawDendrogram(dendroEl);
      })
      .on('click', function(event, d) {
        selectedId = selectedId === d.groupIdx ? null : d.groupIdx;
        refreshBubbleStyles();
        if (dendroEl) drawDendrogram(dendroEl);
      });

    var labels = svg.selectAll('text.blbl')
      .data(bubbleNodes, keyFn)
      .join('text').attr('class','blbl')
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-size', function(d) { return d.r > 16 ? '9px' : '7px'; })
      .attr('fill','#fff').attr('pointer-events','none')
      .text(function(d) {
        if (granularity === 0) return d.id;
        return d.ids && d.ids.length > 1 ? String(d.ids.length) : String(d.ids ? d.ids[0] : d.id);
      });

    refreshBubbleStyles();

    if (simulation) simulation.stop();
    simulation = d3.forceSimulation(bubbleNodes)
      .force('x', d3.forceX(function(d) { return d.tx; }).strength(0.4))
      .force('y', d3.forceY(function(d) { return d.ty; }).strength(0.4))
      .force('collide', d3.forceCollide(function(d) { return d.r + 2; }).strength(0.9).iterations(4))
      .alphaDecay(0.025)
      .on('tick', function() {
        circles.attr('cx', function(d) { return d.x; }).attr('cy', function(d) { return d.y; });
        labels.attr('x', function(d) { return d.x; }).attr('y', function(d) { return d.y; });
      });
  }

  function refreshBubbleStyles() {
    if (!bubbleEl) return;
    var svg = d3.select(bubbleEl);
    svg.selectAll('circle.bubble')
      .attr('r', function(d) { return d.r; })
      .attr('fill', function(d) { return selectedId === d.groupIdx ? '#f8c948' : d.color; })
      .attr('opacity', function(d) { return selectedId === null ? 0.82 : selectedId === d.groupIdx ? 1 : 0.25; })
      .attr('stroke', function(d) { return selectedId === d.groupIdx ? '#fff' : 'none'; });
    svg.selectAll('text.blbl')
      .attr('fill', function(d) { return selectedId === d.groupIdx ? '#0f172a' : '#fff'; })
      .attr('font-weight', function(d) { return selectedId === d.groupIdx ? 'bold' : 'normal'; })
      .attr('font-size', function(d) { return d.r > 16 ? '9px' : '7px'; });
  }

  // ── DENDROGRAM ───────────────────────────────────────────────────────────────
  function drawDendrogram(el) {
    var W = el.clientWidth  || 400;
    var H = el.clientHeight || 240;
    var m  = { top:14, right:12, bottom:24, left:38 };
    var iw = W - m.left - m.right;
    var ih = H - m.top  - m.bottom;
    var maxDist = TREE.dist;
    var root = d3.hierarchy(TREE, function(n) { return n.children; });
    d3.cluster().size([iw, ih])(root);
    var yScale = d3.scaleLinear().domain([0, maxDist]).range([ih, 0]);
    root.each(function(node) {
      node.y = yScale(node.data.dist != null ? node.data.dist : 0);
    });

    var cutY = yScale(LEVEL_THRESHOLDS[granularity]);

    var svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

    g.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(-iw))
      .call(function(ax) {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').attr('stroke','#1e3a5f').attr('stroke-dasharray','2,3');
        ax.selectAll('.tick text').attr('fill','#475569').attr('font-size','9px');
      });

    if (granularity > 0 && granularity < 4) {
      g.append('line')
        .attr('x1', 0).attr('x2', iw)
        .attr('y1', cutY).attr('y2', cutY)
        .attr('stroke', '#f8c94855').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');
      g.append('text')
        .attr('x', iw - 2).attr('y', cutY - 3)
        .attr('text-anchor', 'end')
        .attr('font-size', '8px').attr('fill', '#f8c948aa')
        .text(LEVEL_LABELS[granularity]);
    }

    var displayClusters = getDisplayClusters(granularity);
    var activeLeafIds = (selectedId !== null && displayClusters[selectedId] && displayClusters[selectedId].ids)
      ? displayClusters[selectedId].ids : [];

    g.selectAll('path.link')
      .data(root.links()).join('path').attr('class','link')
      .attr('fill','none')
      .attr('stroke', function(d) {
        if (selectedId === null) {
          return d.source.y > cutY ? '#334155' : '#4a6fa5';
        }
        var leafIds = d.target.leaves().map(function(l) { return l.data.id; });
        return leafIds.some(function(id) { return activeLeafIds.indexOf(id) !== -1; })
          ? '#f8c948' : '#1e3a5f';
      })
      .attr('stroke-width', function(d) {
        if (selectedId === null) return 1;
        var leafIds = d.target.leaves().map(function(l) { return l.data.id; });
        return leafIds.some(function(id) { return activeLeafIds.indexOf(id) !== -1; }) ? 2 : 0.7;
      })
      .attr('d', function(d) {
        return 'M' + d.source.x + ',' + d.source.y + 'H' + d.target.x + 'V' + d.target.y;
      });

    var leaves = root.leaves();
    g.selectAll('circle.leaf')
      .data(leaves).join('circle').attr('class','leaf')
      .attr('cx', function(d) { return d.x; }).attr('cy', function(d) { return d.y; }).attr('r', 3.5)
      .attr('fill', function(d) {
        if (selectedId !== null) {
          return activeLeafIds.indexOf(d.data.id) !== -1 ? '#f8c948' : colorScale(d.data.id);
        }
        return colorScale(d.data.id);
      })
      .attr('stroke-width', 1.5).style('cursor','pointer')
      .on('click', function(event, d) {
        var idx = displayClusters.findIndex(function(c) {
          return c.ids && c.ids.indexOf(d.data.id) !== -1;
        });
        if (idx !== -1) {
          selectedId = selectedId === idx ? null : idx;
          redrawAll();
        }
      });
  }

  // ── Granularity change ────────────────────────────────────────────────────────
  function setGranularity(newLevel) {
    if (newLevel === granularity || isTransitioning) return;
    isTransitioning = true;
    selectedId = null;
    granularity = newLevel;
    if (bubbleEl) drawBubble(bubbleEl, true);
    if (dendroEl) drawDendrogram(dendroEl);
    setTimeout(function() { isTransitioning = false; }, 700);
  }

  function redrawAll() {
    if (bubbleEl) drawBubble(bubbleEl, false);
    if (dendroEl) drawDendrogram(dendroEl);
  }

  onMount(function() {
    redrawAll();
    var ro = new ResizeObserver(redrawAll);
    ro.observe(bubbleEl);
    ro.observe(dendroEl);
    return function() {
      ro.disconnect();
      if (simulation) simulation.stop();
    };
  });
</script>

<style>
  :global(body) { margin:0; background:#0f172a; color:#e2e8f0; font-family:'Inter','Segoe UI',sans-serif; overflow:hidden; }
  .app { display:flex; height:100vh; padding:12px; gap:12px; box-sizing:border-box; }
  .panel { background:#1e293b; border:1px solid #334155; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; }
  .panel-title { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#64748b; padding:9px 14px 7px; border-bottom:1px solid #1e3a5f; flex-shrink:0; }
  .panel-body { flex:1; overflow:hidden; }
  .left { flex:0 0 62%; }
  .left svg, .right svg { display:block; width:100%; height:100%; }
  .right { flex:1; display:flex; flex-direction:column; gap:12px; }
  .right .panel { flex:1; }
  .list-sub { padding:6px 14px; font-size:11px; color:#94a3b8; border-bottom:1px solid #1e3a5f; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .keyword-list { flex:1; overflow-y:auto; padding:8px 10px; }
  .keyword-list::-webkit-scrollbar { width:4px; }
  .keyword-list::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }
  .chip { display:inline-block; background:#0f172a; border:1px solid #334155; border-radius:20px; padding:3px 10px; margin:3px; font-size:11px; color:#94a3b8; transition:all .12s; }
  .chip:hover { background:#1e40af; border-color:#3b82f6; color:#fff; }
  .empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#334155; font-size:12px; gap:6px; }
  .nav { display:flex; gap:6px; padding:8px 14px; background:#0f172a; border-bottom:1px solid #1e3a5f; flex-shrink:0; }
  .nav a { font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#475569; text-decoration:none; padding:4px 10px; border-radius:6px; border:1px solid #334155; transition:all .12s; }
  .nav a:hover { color:#e2e8f0; border-color:#64748b; }
  .nav a.active { color:#f8c948; border-color:#f8c948; }

  .granularity-bar {
    display: flex;
    align-items: center;
    padding: 8px 14px 6px;
    border-bottom: 1px solid #1e3a5f;
    flex-shrink: 0;
    background: #0f172a;
    gap: 8px;
  }
  .gran-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #475569;
    white-space: nowrap;
  }
  .gran-steps {
    display: flex;
    align-items: flex-start;
    flex: 1;
    position: relative;
    padding-top: 7px;
    padding-bottom: 16px;
  }
  .gran-track {
    position: absolute;
    left: 7px;
    right: 7px;
    height: 2px;
    background: #1e3a5f;
    top: 14px;
    pointer-events: none;
    z-index: 0;
    border-radius: 1px;
  }
  .gran-track-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #f8c948);
    transition: width 0.35s ease;
    border-radius: 1px;
  }
  .gran-step {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    cursor: pointer;
    gap: 4px;
  }
  .gran-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid #334155;
    background: #0f172a;
    transition: all 0.22s ease;
    flex-shrink: 0;
  }
  .gran-step.active .gran-dot {
    background: #f8c948;
    border-color: #f8c948;
    box-shadow: 0 0 8px #f8c94877;
    transform: scale(1.3);
  }
  .gran-step.passed .gran-dot {
    background: #3b82f6;
    border-color: #3b82f6;
  }
  .gran-step:hover .gran-dot {
    border-color: #94a3b8;
  }
  .gran-step-label {
    font-size: 8px;
    font-weight: 600;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: #475569;
    white-space: nowrap;
    transition: color 0.2s;
  }
  .gran-step.active .gran-step-label { color: #f8c948; }
  .gran-step.passed .gran-step-label { color: #3b82f6; }

  .dendro-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .dendro-svg-wrap {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  .dendro-svg-wrap svg {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>

<div class="app">
  <div class="panel left">
    <div class="nav">
      <a href="/">Voronoi</a>
      <a href="/v2">Treemap</a>
      <a href="/v3" class="active">Bubble</a>
    </div>
    <div class="panel-title">Plot Cluster — Bubble Chart</div>
    <div class="panel-body"><svg bind:this={bubbleEl}></svg></div>
  </div>

  <div class="right">
    <div class="panel">
      <div class="panel-title">Agglomerative Clusters</div>
      <div class="dendro-body">
        <div class="granularity-bar">
          <span class="gran-label">Granularity</span>
          <div class="gran-steps">
            <div class="gran-track">
              <div class="gran-track-fill" style="width: {granTrackWidth}%"></div>
            </div>
            {#each LEVEL_LABELS as label, i}
              <div
                class="gran-step {i === granularity ? 'active' : ''} {i < granularity ? 'passed' : ''}"
                on:click={() => setGranularity(i)}
                title="{label}"
              >
                <div class="gran-dot"></div>
                <span class="gran-step-label">{label}</span>
              </div>
            {/each}
          </div>
        </div>
        <div class="dendro-svg-wrap">
          <svg bind:this={dendroEl}></svg>
        </div>
      </div>
    </div>

    <div class="panel" style="flex:0 0 38%;">
      <div class="panel-title">Lista Cluster</div>
      <div class="list-sub">{listTitle}</div>
      <div class="keyword-list">
        {#if displayKws.length > 0}
          {#each displayKws as kw}<span class="chip">{kw}</span>{/each}
        {:else}
          <div class="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            Seleziona una bolla
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>