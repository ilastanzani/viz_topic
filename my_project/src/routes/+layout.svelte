export const prerender = true;
<!-- src/routes/+layout.svelte -->
<script>
  import { page } from '$app/stores';
  let { children } = $props();
</script>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #f4f7fb;
    color: #1f2937;
    font-family: 'Inter', 'Segoe UI', sans-serif;
    overflow: hidden;
  }
  :global(*) { box-sizing: border-box; }

  .shell {
    display: flex;
    flex-direction: column;
    height: 100%;        /* fills the 100%-height body */
  }

  nav {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 16px;
    background: #ffffff;
    border-bottom: 1px solid #d6deea;
    flex-shrink: 0;      /* nav never shrinks */
  }
  .brand {
    font-size: 11px; font-weight: 700; letter-spacing: .12em;
    text-transform: uppercase; color: #334155; margin-right: 8px;
  }
  a {
    font-size: 11px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: #475569;
    padding: 5px 14px; border-radius: 7px;
    border: 1px solid #c9d5e5; text-decoration: none;
    transition: all .15s;
  }
  a:hover { color: #0f172a; border-color: #94a3b8; background: #f8fafc; }
  a.active { color: #7c5a00; border-color: #f8c948; background: #fff7db; }

  /* slot wrapper — must flex so the child can fill with height:100% */
  .content {
    flex: 1;
    min-height: 0;       /* critical: lets flex child shrink below content size */
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>

<div class="shell">
  <nav>
    <span class="brand">Cluster Explorer</span>
    <a href="/"   class:active={$page.url.pathname === '/'  }>▦ Treemap</a>
    <a href="/v2" class:active={$page.url.pathname === '/v2'}>◉ Bubble Chart</a>
    <a href="/v3" class:active={$page.url.pathname === '/v3'}>◉ Zoomable icicle</a>
    <a href="/v4" class:active={$page.url.pathname === '/v4'}>◉ Sunburst</a>
    <a href="/v5" class:active={$page.url.pathname === '/v5'}>◉ Word-clouds</a>
  </nav>
  <div class="content">
    {@render children()}
  </div>
</div>
