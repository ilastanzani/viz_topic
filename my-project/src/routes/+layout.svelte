<!-- src/routes/+layout.svelte -->
<script>
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
    height: 100%;
  }

  .content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>

<div class="shell">
  <div class="content">
    {@render children()}
  </div>
</div>
