<script setup lang="ts">
import type { BUGRating } from "../core/types";

defineProps<{
  bug: BUGRating;
}>();
</script>

<template>
  <div class="bug-viewer-container">
    <div class="bug-card">
      <div class="bug-card-header">
        <span>IES TM-15-11 BUG Rating</span>
        <span class="bug-badge">{{ bug.fullRating }}</span>
      </div>

      <div class="bug-summary-row">
        <div class="rating-box">
          <div class="score">B{{ bug.bRating }}</div>
          <div class="sub">Backlight</div>
        </div>
        <div class="rating-box">
          <div class="score">U{{ bug.uRating }}</div>
          <div class="sub">Uplight</div>
        </div>
        <div class="rating-box">
          <div class="score">G{{ bug.gRating }}</div>
          <div class="sub">Glare</div>
        </div>
      </div>

      <div class="zones-breakdown">
        <h4>Zone Lumens Breakdown</h4>
        <div class="zone-grid">
          <div class="zone-col">
            <h5>Backlight Zones</h5>
            <div class="kv"><span>BL (0° - 30°)</span> <b>{{ bug.zones.bl }} lm</b></div>
            <div class="kv"><span>BM (30° - 60°)</span> <b>{{ bug.zones.bm }} lm</b></div>
            <div class="kv"><span>BH (60° - 80°)</span> <b>{{ bug.zones.bh }} lm</b></div>
            <div class="kv"><span>BVH (80° - 90°)</span> <b>{{ bug.zones.bvh }} lm</b></div>
          </div>

          <div class="zone-col">
            <h5>Forward Light Zones</h5>
            <div class="kv"><span>FL (0° - 30°)</span> <b>{{ bug.zones.fl }} lm</b></div>
            <div class="kv"><span>FM (30° - 60°)</span> <b>{{ bug.zones.fm }} lm</b></div>
            <div class="kv"><span>FH (60° - 80°)</span> <b>{{ bug.zones.fh }} lm</b></div>
            <div class="kv"><span>FVH (80° - 90°)</span> <b>{{ bug.zones.fvh }} lm</b></div>
          </div>

          <div class="zone-col">
            <h5>Uplight Zones</h5>
            <div class="kv"><span>UL (90° - 100°)</span> <b>{{ bug.zones.ul }} lm</b></div>
            <div class="kv"><span>UH (100° - 180°)</span> <b>{{ bug.zones.uh }} lm</b></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bug-viewer-container {
  width: 100%;
  height: 100%;
  padding: 16px;
  overflow: auto;
  background: var(--workspace, #26262d);
  display: flex;
  justify-content: center;
}

.bug-card {
  width: 100%;
  max-width: 680px;
  background: var(--panel, #33333c);
  border: 1px solid var(--line, #474750);
  border-radius: var(--control-radius, 4px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: max-content;
}

.bug-card-header {
  padding: 10px 16px;
  background: var(--well, #2a2a32);
  border-bottom: 1px solid var(--line, #474750);
  font-weight: 600;
  color: var(--text, #edebe8);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bug-badge {
  background: var(--accent-soft, #513f32);
  color: var(--accent, #fbbf24);
  padding: 3px 10px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
}

.bug-summary-row {
  display: flex;
  gap: 16px;
  padding: 16px;
  justify-content: center;
  border-bottom: 1px solid var(--line-soft, #3d3d46);
}

.rating-box {
  background: var(--well, #2a2a32);
  border: 1px solid var(--line, #474750);
  border-radius: var(--control-radius, 4px);
  padding: 12px 24px;
  text-align: center;
  min-width: 110px;
}

.rating-box .score {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--accent, #fbbf24);
}

.rating-box .sub {
  font-size: 0.75rem;
  color: var(--muted, #bebdbd);
  text-transform: uppercase;
  margin-top: 2px;
}

.zones-breakdown {
  padding: 16px;
}

.zones-breakdown h4 {
  font-size: 0.82rem;
  color: var(--text, #edebe8);
  margin-bottom: 12px;
  font-weight: 600;
}

.zone-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.zone-col {
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: var(--control-radius, 4px);
  padding: 10px 12px;
}

.zone-col h5 {
  font-size: 0.72rem;
  color: var(--hint, #a7a7a8);
  text-transform: uppercase;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line-soft, #3d3d46);
}

.kv {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  padding: 3px 0;
  color: var(--muted, #bebdbd);
}

.kv b {
  color: var(--text, #edebe8);
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
}
</style>
