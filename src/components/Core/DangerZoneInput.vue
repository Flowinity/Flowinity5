<template>
  <text-field
    :label="$t('dangerZone.password')"
    v-if="!userStore.user?.totpEnable || passwordMode"
    autofocus
    type="password"
    @keydown.enter="$emit('confirm')"
    @update:model-value="$emit('update:password', $event)"
    :model-value="password"
    parent-classes="flex-col"
  >
    <div class="flex justify-end" v-if="userStore.user?.totpEnable">
      <a
        class="select-none cursor-pointer text-blue"
        @click="$emit('update:passwordMode', false)"
      >
        {{ $t("dangerZone.useTotp") }}
      </a>
    </div>
  </text-field>
  <text-field
    :label="$t('dangerZone.totp')"
    v-else
    autofocus
    @keydown.enter="$emit('confirm')"
    @update:model-value="$emit('update:totp', $event)"
    :model-value="totp"
    parent-classes="flex-col"
    type="number"
    max="6"
  >
    <div class="flex justify-end">
      <a
        class="select-none cursor-pointer text-blue"
        @click="$emit('update:passwordMode', true)"
      >
        {{ $t("dangerZone.usePassword") }}
      </a>
    </div>
  </text-field>
</template>

<script setup lang="ts">
import TextField from "@/components/Framework/Input/TextField.vue";
import { useUserStore } from "@/stores/user.store";
import { onMounted } from "vue";
const userStore = useUserStore();
const props = defineProps({
  password: String,
  totp: String,
  passwordMode: Boolean,
  requireBoth: Boolean
});
const emit = defineEmits([
  "update:password",
  "update:totp",
  "update:passwordMode",
  "confirm"
]);

onMounted(() => {
  if (!userStore.user?.totpEnable) {
    emit("update:passwordMode", true);
  }
});
</script>

<style scoped></style>
