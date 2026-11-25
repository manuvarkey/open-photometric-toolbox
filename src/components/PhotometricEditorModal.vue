<script setup lang="ts">
import { ref } from "vue";
import AppIcon from "./AppIcon.vue";
import ThemedSelect from "./ThemedSelect.vue";
import { computePhotometrics } from "../core/calculations";
import type { PhotometricData } from "../core/types";

const props = defineProps<{
  data: PhotometricData;
}>();

const emit = defineEmits<{
  (e: "save", updated: PhotometricData): void;
  (e: "close"): void;
}>();

// Form state
const lumcat = ref(props.data.keywords["LUMCAT"] || "");
const luminaire = ref(props.data.keywords["LUMINAIRE"] || "");
const manufac = ref(props.data.keywords["MANUFAC"] || "");
const lamp = ref(props.data.keywords["LAMP"] || "");
const testlab = ref(props.data.keywords["TESTLAB"] || "");
const date = ref(props.data.keywords["DATE"] || "");

const multiplier = ref(props.data.multiplier);
const ballastFactor = ref(props.data.ballastFactor);
const inputWatts = ref(props.data.inputWatts);
const lumensPerLamp = ref(props.data.lumensPerLamp);
const lampCount = ref(props.data.lampCount);

const luminousLength = ref(props.data.luminousLength);
const luminousWidth = ref(props.data.luminousWidth);
const luminousHeight = ref(props.data.luminousHeight);
const unitsType = ref<1 | 2>(props.data.unitsType);

const candelaScale = ref(1.0);

function handleApply() {
  const updatedKeywords = { ...props.data.keywords };
  for (const [key, value] of Object.entries({ LUMCAT: lumcat.value, LUMINAIRE: luminaire.value, MANUFAC: manufac.value, LAMP: lamp.value, TESTLAB: testlab.value, DATE: date.value })) {
    if (value) updatedKeywords[key] = value;
    else delete updatedKeywords[key];
  }

  // Clone and scale candela matrix if candelaScale != 1.0
  const scale = candelaScale.value > 0 ? candelaScale.value : 1.0;
  const newCandela = props.data.candela.map((plane) => plane.map((v) => v * scale));

  const newMult = multiplier.value;
  const newWatts = inputWatts.value;

  // Re-run computation engine
  const calculated = computePhotometrics(
    props.data.verticalAngles,
    props.data.horizontalAngles,
    newCandela,
    lampCount.value,
    lumensPerLamp.value,
    newMult,
    newWatts,
    luminousLength.value,
    luminousWidth.value,
    luminousHeight.value,
    unitsType.value,
    props.data.photometricType
  );

  const updatedData: PhotometricData = {
    ...props.data,
    keywords: updatedKeywords,
    multiplier: newMult,
    ballastFactor: ballastFactor.value,
    inputWatts: newWatts,
    lumensPerLamp: lumensPerLamp.value,
    lampCount: lampCount.value,
    luminousLength: luminousLength.value,
    luminousWidth: luminousWidth.value,
    luminousHeight: luminousHeight.value,
    unitsType: unitsType.value,
    candela: newCandela,
    calculated,
  };

  emit("save", updatedData);
  emit("close");
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="editor-modal" role="dialog" aria-modal="true" aria-label="Photometric File Editor">
      <div class="editor-header">
        <div class="title-wrap">
          <AppIcon name="edit" :size="18" />
          <span>Photometric File Editor</span>
        </div>
        <button class="icon-button" aria-label="Close" @click="emit('close')">
          <AppIcon name="close" :size="14" />
        </button>
      </div>

      <div class="editor-body">
        <!-- Luminaire Identity -->
        <fieldset class="editor-section">
          <legend>Luminaire Identity Keywords</legend>
          <div class="form-grid">
            <div class="field">
              <label for="editor-field-1">[LUMCAT] Catalog Number</label>
              <input id="editor-field-1" v-model="lumcat" type="text" />
            </div>
            <div class="field">
              <label for="editor-field-2">[MANUFAC] Manufacturer</label>
              <input id="editor-field-2" v-model="manufac" type="text" />
            </div>
            <div class="field span-2">
              <label for="editor-field-3">[LUMINAIRE] Description</label>
              <input id="editor-field-3" v-model="luminaire" type="text" />
            </div>
            <div class="field span-2">
              <label for="editor-field-4">[LAMP] Lamp Description</label>
              <input id="editor-field-4" v-model="lamp" type="text" />
            </div>
            <div class="field">
              <label for="editor-field-5">[TESTLAB] Test Laboratory</label>
              <input id="editor-field-5" v-model="testlab" type="text" />
            </div>
            <div class="field">
              <label for="editor-field-6">[DATE] Test Date</label>
              <input id="editor-field-6" v-model="date" type="text" />
            </div>
          </div>
        </fieldset>

        <!-- Electrical & Photometric Parameters -->
        <fieldset class="editor-section">
          <legend>Electrical & Photometric Parameters</legend>
          <div class="form-grid four-col">
            <div class="field">
              <label for="editor-field-7">Input Watts (W)</label>
              <input id="editor-field-7" v-model.number="inputWatts" type="number" step="0.5" />
            </div>
            <div class="field">
              <label for="editor-field-8">Multiplier</label>
              <input id="editor-field-8" v-model.number="multiplier" type="number" step="0.01" />
            </div>
            <div class="field">
              <label for="editor-field-9">Lumens / Lamp</label>
              <input id="editor-field-9" v-model.number="lumensPerLamp" type="number" step="10" />
            </div>
            <div class="field">
              <label for="editor-field-10">Lamp Count</label>
              <input id="editor-field-10" v-model.number="lampCount" type="number" step="1" />
            </div>
          </div>
        </fieldset>

        <!-- Luminous Dimensions -->
        <fieldset class="editor-section">
          <legend>Luminous Dimensions & Scaling</legend>
          <div class="form-grid four-col">
            <div class="field">
              <label for="editor-field-11">Length</label>
              <input id="editor-field-11" v-model.number="luminousLength" type="number" step="0.05" />
            </div>
            <div class="field">
              <label for="editor-field-12">Width</label>
              <input id="editor-field-12" v-model.number="luminousWidth" type="number" step="0.05" />
            </div>
            <div class="field">
              <label for="editor-field-13">Height</label>
              <input id="editor-field-13" v-model.number="luminousHeight" type="number" step="0.05" />
            </div>
            <div class="field">
              <label for="editor-field-14">Units</label>
              <ThemedSelect label="Units" v-model="unitsType" :options="[{label:'Feet',value:1},{label:'Metres',value:2}]" />
            </div>
            <div class="field span-2">
              <label for="editor-field-15">Candela Array Scale Factor</label>
              <input id="editor-field-15" v-model.number="candelaScale" type="number" step="0.05" />
              <small class="field-hint">1.0 = unchanged, 1.1 = +10% intensity</small>
            </div>
          </div>
        </fieldset>
      </div>

      <div class="editor-footer">
        <button class="btn-cancel" @click="emit('close')">Cancel</button>
        <button class="btn-save" @click="handleApply">Apply</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.editor-modal {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  width: 680px;
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
}

.editor-header {
  padding: 12px 18px;
  background: var(--well);
  border-bottom: 1px solid var(--line-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text);
}

.editor-body {
  padding: 16px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.editor-section {
  border: 1px solid var(--line-soft);
  border-radius: var(--control-radius);
  padding: 12px 14px;
}

.editor-section legend {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0 6px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.form-grid.four-col {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.field {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 4px;
}

.field.span-2 {
  grid-column: span 2;
}

.field label {
  font-size: 0.75rem;
  color: var(--muted);
}

.field input,
.select-input {
  width: 100%;
  min-width: 0;
  padding: 6px 10px;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  color: var(--text);
  font-size: 0.82rem;
  outline: none;
}

.field-hint {
  font-size: 0.7rem;
  color: var(--hint);
}

.editor-footer {
  padding: 12px 18px;
  border-top: 1px solid var(--line-soft);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: var(--well);
}

.btn-cancel {
  padding: 6px 14px;
  background: none;
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  color: var(--muted);
  cursor: pointer;
  font-size: 0.82rem;
}

.btn-save {
  padding: 6px 18px;
  background: var(--accent);
  border: 0;
  border-radius: var(--control-radius);
  color: #fff;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 500;
}
</style>
