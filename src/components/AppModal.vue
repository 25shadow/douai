<template>
  <Transition name="modal-fade">
    <div v-if="open" class="modal-backdrop" @mousedown.self="$emit('close')">
      <section
        class="desktop-modal-window"
        :class="`size-${size}`"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.esc.stop.prevent="$emit('close')"
      >
        <header class="modal-header">
          <div class="header-text-wrap">
            <span v-if="eyebrow" class="modal-eyebrow">{{ eyebrow }}</span>
            <h2 :id="titleId">{{ title }}</h2>
            <p v-if="description">{{ description }}</p>
          </div>
          <button class="modal-close-btn" type="button" aria-label="关闭弹窗" title="关闭" @click="$emit('close')">
            <X :size="16" />
          </button>
        </header>

        <div class="modal-body-content">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="modal-footer-bar">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { X } from '@lucide/vue';

const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  description?: string;
  eyebrow?: string;
  size?: 'narrow' | 'medium' | 'wide';
}>(), { size: 'medium' });

const emit = defineEmits<{ close: [] }>();
const titleId = `app-modal-title-${Math.random().toString(36).slice(2)}`;
let previousFocus: HTMLElement | null = null;

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  }
}

watch(() => props.open, open => {
  document.body.classList.toggle('modal-open', open);
  if (open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.addEventListener('keydown', onDocumentKeydown);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.desktop-modal-window input:not([disabled]), .desktop-modal-window button:not([disabled]), .desktop-modal-window [tabindex="0"]')?.focus();
    });
  } else {
    document.removeEventListener('keydown', onDocumentKeydown);
    previousFocus?.focus();
  }
}, { immediate: true });

onBeforeUnmount(() => {
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', onDocumentKeydown);
});
</script>

<style scoped>
body.modal-open {
  overflow: hidden;
}

.modal-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
}

.desktop-modal-window {
  display: flex;
  flex-direction: column;
  width: min(100%, 580px);
  max-height: min(85vh, 720px);
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.25), 0 0 1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  color: var(--text-main, #1e293b);
  animation: modalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalPop {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(6px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.desktop-modal-window.size-narrow {
  max-width: 440px;
}
.desktop-modal-window.size-wide {
  max-width: 860px;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid #f1f5f9;
  background: #ffffff;
}

.header-text-wrap {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.modal-eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #10b981;
}

.modal-header h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #1e293b;
}

.modal-header p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.modal-close-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #94a3b8;
  background: transparent;
  transition: all 0.15s;
}

.modal-close-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.modal-body-content {
  padding: 20px 22px;
  overflow-y: auto;
  font-size: 13px;
  color: #334155;
  background: #ffffff;
}

.modal-footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 22px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
}

.modal-footer-bar small {
  font-size: 11px;
  color: #64748b;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
