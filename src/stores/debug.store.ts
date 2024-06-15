import { defineStore } from "pinia";
import { ref, watch } from "vue";

type Operation = {
  id: string;
  name: string;
  args: any;
  result: any;
  time: number;
  type: "query" | "mutation" | "subscription";
  pending: boolean;
  timestamp: number;
  sdl: string;
};

export const useDebugStore = defineStore("debug", () => {
  const recentOperations = ref<Operation[]>([]);

  watch(recentOperations, (value) => {
    if (value.length > 100) {
      // proritize operations that do not contain "Pulse"
      const prioritized = value.filter((op) => !op.name.includes("Pulse"));
      const pulse = value.filter((op) => op.name.includes("Pulse"));
      if (pulse.length > 100) {
        recentOperations.value = [...prioritized, ...pulse.slice(0, 100)].sort(
          (a, b) => a.timestamp - b.timestamp
        );
      }

      if (prioritized.length > 100) {
        recentOperations.value = [...prioritized.slice(0, 100), ...pulse].sort(
          (a, b) => a.timestamp - b.timestamp
        );
      }
    }

    recentOperations.value = value.sort((a, b) => {
      if (a.pending) return -1;
      if (b.pending) return 1;
      return a.timestamp - b.timestamp;
    });
  });

  return {
    recentOperations
  };
});
