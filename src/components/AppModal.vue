<template>
  <Transition name="modal">
    <div v-if="open" class="modal-backdrop" @mousedown.self="$emit('close')">
      <section
        class="app-modal"
        :class="`size-${size}`"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.esc.stop.prevent="$emit('close')"
      >
        <header class="modal-header">
          <div class="modal-title">
            <span v-if="eyebrow" class="modal-eyebrow">{{ eyebrow }}</span>
            <h2 :id="titleId">{{ title }}</h2>
            <p v-if="description">{{ description }}</p>
          </div>
          <button class="modal-close" type="button" aria-label="关闭弹窗" title="关闭" @click="$emit('close')">×</button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';

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
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.app-modal input:not([disabled]), .app-modal button:not([disabled]), .app-modal [tabindex="0"]')?.focus());
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

<style>
body.modal-open{overflow:hidden}
.modal-backdrop{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:24px;background:rgba(5,9,7,.72);backdrop-filter:blur(5px)}
.app-modal{display:flex;flex-direction:column;width:min(100%,640px);max-height:min(820px,calc(100dvh - 48px));border:1px solid rgba(203,216,208,.2);border-radius:8px;color:var(--ink,#e8eeea);background:#171d1a;box-shadow:0 24px 80px rgba(0,0,0,.42);overflow:hidden}
.app-modal.size-narrow{max-width:460px}.app-modal.size-wide{max-width:920px}
.modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:20px 22px;border-bottom:1px solid var(--line,rgba(203,216,208,.14))}
.modal-title{min-width:0}.modal-eyebrow{color:var(--accent-2,#d2b16f);font-size:9px;font-weight:750;letter-spacing:.1em}
.modal-title h2{margin:5px 0 0;font-size:18px;font-weight:650}.modal-title p{margin:5px 0 0;color:var(--muted,#a1ada6);font-size:11px;line-height:1.5}
.modal-close{display:grid;place-items:center;flex:0 0 30px;width:30px;height:30px;border:1px solid var(--line,rgba(203,216,208,.14));border-radius:4px;color:var(--muted,#a1ada6);background:transparent;font-size:20px;line-height:1}
.modal-close:hover{border-color:var(--accent,#89cfbd);color:var(--ink,#e8eeea)}
.modal-body{min-height:0;padding:20px 22px;overflow:auto;overscroll-behavior:contain}
.modal-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 22px;border-top:1px solid var(--line,rgba(203,216,208,.14))}
.modal-footer small{color:var(--muted,#a1ada6);font-size:10px;line-height:1.5}
.modal-enter-active,.modal-leave-active{transition:opacity .16s ease}.modal-enter-active .app-modal,.modal-leave-active .app-modal{transition:transform .16s ease}
.modal-enter-from,.modal-leave-to{opacity:0}.modal-enter-from .app-modal,.modal-leave-to .app-modal{transform:translateY(8px) scale(.99)}
@media(max-width:600px){.modal-backdrop{align-items:end;padding:0}.app-modal,.app-modal.size-wide,.app-modal.size-medium,.app-modal.size-narrow{width:100%;max-width:none;max-height:92dvh;border-radius:9px 9px 0 0}.modal-header{padding:17px 18px}.modal-body{padding:16px 18px}.modal-footer{padding:12px 18px}}
</style>
