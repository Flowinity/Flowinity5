<template>
  <component
    :is="props.component || 'div'"
    class="flex items-center justify-center z-10"
    :class="{
      fixed: !props.absolute,
      absolute: props.absolute,
      'inset-0': modelValue
    }"
    v-bind="$attrs"
  >
    <div>
      <div
        v-if="props.modelValue"
        class="bg-black opacity-50"
        style="width: 100%; height: 100%; left: 0; top: 0"
        :class="{
          fixed: !props.absolute,
          absolute: props.absolute,
          ...overlayClasses
        }"
      ></div>
      <div v-if="props.modelValue" class="relative">
        <slot></slot>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
const props = defineProps({
  modelValue: Boolean,
  absolute: Boolean,
  component: String,
  overlayClasses: Object
});
defineEmits(["update:modelValue"]);
</script>
