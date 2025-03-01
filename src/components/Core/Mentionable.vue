<template>
  <div ref="el" :class="$attrs.class" class="mentionable" style="width: 100%">
    <slot />
    <VDropdown
      v-if="displayedItems.length"
      ref="popper"
      :auto-hide="false"
      :shown="currentKey !== null"
      :style="
        caretPosition
          ? {
              top: `${caretPosition.top + 128}px`,
              left: `${caretPosition.left + 2}px`
            }
          : {}
      "
      :theme="theme"
      class="bg-card-secondary-dark"
      style="position: absolute"
      v-bind="{ ...$attrs, class: undefined }"
    >
      <div
        :style="
          caretPosition
            ? {
                height: `${caretPosition.height}px`
              }
            : {}
        "
      />

      <template #popper>
        <div
          v-for="(item, index) of displayedItems"
          :key="index"
          :class="{
            'mention-selected': selectedIndex === index
          }"
          class="mention-item rounded"
          @mousedown="applyMention(index)"
          @mouseover="selectedIndex = index"
        >
          <slot
            :index="index"
            :item="item"
            :name="`item-${currentKey || oldKey}`"
          >
            <slot :index="index" :item="item" name="item">
              {{ item.label || item.value }}ds
            </slot>
          </slot>
        </div>
      </template>
    </VDropdown>
  </div>
</template>
<script lang="ts">
//@ts-nocheck
import getCaretPosition from "textarea-caret";
import { Dropdown, options } from "floating-vue";
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  onUnmounted,
  onUpdated,
  PropType,
  ref,
  watch
} from "vue";
import { useChatStore } from "@/stores/chat.store";
import "floating-vue/dist/style.css";

options.themes.mentionable = {
  $extend: "dropdown",
  placement: "top-start",
  arrowPadding: 6,
  arrowOverflow: false
};

export interface MentionItem {
  searchText?: string;
  label?: string;
  value: any;
}

export default defineComponent({
  components: {
    VDropdown: Dropdown
  },
  inheritAttrs: false,
  props: {
    id: {
      type: String,
      required: true
    },
    keys: {
      type: Array as PropType<string[]>,
      required: true
    },
    items: {
      type: Array as PropType<MentionItem[]>,
      default: () => []
    },
    omitKey: {
      type: Boolean,
      default: false
    },
    filteringDisabled: {
      type: Boolean,
      default: false
    },
    insertSpace: {
      type: Boolean,
      default: false
    },
    mapInsert: {
      type: Function as PropType<(item: MentionItem, key: string) => string>,
      default: null
    },
    limit: {
      type: Number,
      default: 8
    },
    theme: {
      type: String,
      default: "mentionable"
    },
    caretHeight: {
      type: Number,
      default: 0
    }
  },
  emits: ["search", "open", "close", "apply"],
  setup(props, { emit }) {
    const currentKey = ref<string | null>(null);
    let currentKeyIndex: number;
    const oldKey = ref<string>(null);
    // Items
    const searchText = ref<string>(null);
    watch(searchText, (value, oldValue) => {
      if (value) {
        emit("search", value, oldValue);
      }
    });
    const filteredItems = computed(() => {
      if (!searchText.value || props.filteringDisabled) {
        return props.items;
      }
      const finalSearchText = searchText.value.toLowerCase();
      return props.items.filter((item) => {
        let text: string;
        if (item.searchText) {
          text = item.searchText;
        } else if (item.label) {
          text = item.label;
        } else {
          text = "";
          for (const key in item) {
            text += item[key];
          }
        }
        return text.toLowerCase().includes(finalSearchText);
      });
    });
    const displayedItems = computed(() =>
      filteredItems.value.slice(0, props.limit)
    );
    // Selection
    const selectedIndex = ref(0);
    watch(
      displayedItems,
      () => {
        selectedIndex.value = 0;
      },
      {
        deep: true
      }
    );
    // Input element management
    let input: HTMLElement;
    const el = ref<HTMLDivElement>(null);

    function getInput() {
      return document.querySelector(props.id);
    }

    onMounted(() => {
      input = getInput();
      attach();
    });
    onUpdated(() => {
      const newInput = getInput();
      if (newInput !== input) {
        detach();
        input = newInput;
        attach();
      }
    });
    onUnmounted(() => {
      detach();
    });

    function onFocus() {
      checkKey();
    }

    // Events
    function attach() {
      if (input) {
        input.addEventListener("input", onInput);
        input.addEventListener("keydown", onKeyDown);
        input.addEventListener("keyup", onKeyUp);
        input.addEventListener("scroll", onScroll);
        input.addEventListener("blur", onBlur);
        input.addEventListener("focus", onFocus);
      }
    }

    function detach() {
      if (input) {
        input.removeEventListener("input", onInput);
        input.removeEventListener("keydown", onKeyDown);
        input.removeEventListener("keyup", onKeyUp);
        input.removeEventListener("scroll", onScroll);
        input.removeEventListener("blur", onBlur);
        input.removeEventListener("focus", onFocus);
      }
    }

    function onInput() {
      checkKey();
    }

    function onBlur() {
      closeMenu();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (currentKey.value) {
        if (e.key === "ArrowDown") {
          selectedIndex.value++;
          if (selectedIndex.value >= displayedItems.value.length) {
            selectedIndex.value = 0;
          }
          cancelEvent(e);
        }
        if (e.key === "ArrowUp") {
          selectedIndex.value--;
          if (selectedIndex.value < 0) {
            selectedIndex.value = displayedItems.value.length - 1;
          }
          cancelEvent(e);
        }
        if (
          (e.key === "Enter" || e.key === "Tab") &&
          displayedItems.value.length > 0
        ) {
          applyMention(selectedIndex.value);
          cancelEvent(e);
        }
        if (e.key === "Escape") {
          closeMenu();
          cancelEvent(e);
        }
      }
    }

    let cancelKeyUp = null;

    function onKeyUp(e: KeyboardEvent) {
      if (cancelKeyUp && e.key === cancelKeyUp) {
        cancelEvent(e);
      }
      cancelKeyUp = null;
    }

    function cancelEvent(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      cancelKeyUp = e.key;
    }

    function onScroll() {
      updateCaretPosition();
    }

    function getSelectionStart() {
      return input.isContentEditable
        ? window.getSelection().anchorOffset
        : (input as HTMLInputElement).selectionStart;
    }

    function setCaretPosition(index: number) {
      nextTick(() => {
        (input as HTMLInputElement).selectionEnd = index;
      });
    }

    function getValue() {
      return input.isContentEditable
        ? window.getSelection().anchorNode.textContent
        : (input as HTMLInputElement).value;
    }

    function setValue(value) {
      (input as HTMLInputElement).value = value;
      emitInputEvent("input");
    }

    function emitInputEvent(type: string) {
      input.dispatchEvent(new Event(type));
    }

    let lastSearchText: string = null;

    function checkKey() {
      const index = getSelectionStart();
      if (index >= 0) {
        const { key, keyIndex } = getLastKeyBeforeCaret(index);
        const text = (lastSearchText = getLastSearchText(index, keyIndex));
        if (key.includes("") && getValue() === "") {
          console.log(69);
          openMenu(key, keyIndex);
          searchText.value = text;
          return true;
        }
        if (
          !key.includes("!") &&
          !(keyIndex < 1 || /\s/.test(getValue()[keyIndex - 1]))
        ) {
          return false;
        }
        if (text != null) {
          openMenu(key, keyIndex);
          searchText.value = text;
          return true;
        }
      }
      closeMenu();
      return false;
    }

    function getLastKeyBeforeCaret(caretIndex: number) {
      const [keyData] = props.keys
        .map((key) => ({
          key: key === "!" ? getValue().split("!")[0] + "!" : key,
          keyIndex: getValue().lastIndexOf(key, caretIndex - 1)
        }))
        .sort((a, b) => b.keyIndex - a.keyIndex);
      return keyData;
    }

    function getLastSearchText(caretIndex: number, keyIndex: number) {
      if (keyIndex !== -1) {
        const text = getValue().substring(keyIndex + 1, caretIndex);
        // If there is a space we close the menu
        if (!/\s/.test(text)) {
          return text;
        }
      }
      return null;
    }

    // Position of the popper
    const caretPosition = ref<{ top: number; left: number; height: number }>(
      null
    );

    console.log(input);

    function updateCaretPosition() {
      console.log("called");
      if (currentKey.value !== undefined) {
        if (input.isContentEditable) {
          const rect = window
            .getSelection()
            .getRangeAt(0)
            .getBoundingClientRect();
          const inputRect = input.getBoundingClientRect();
          caretPosition.value = {
            left: rect.left - inputRect.left,
            top: rect.top - inputRect.top,
            height: rect.height
          };
        } else {
          caretPosition.value = getCaretPosition(input, currentKeyIndex);
        }
        caretPosition.value.top -= input.scrollTop;
        if (props.caretHeight) {
          caretPosition.value.height = props.caretHeight;
        } else if (isNaN(caretPosition.value.height)) {
          caretPosition.value.height = 16;
        }
      }
    }

    // Open/close
    function openMenu(key: string, keyIndex: number) {
      console.log(currentKey.value, key);
      if (currentKey.value !== key) {
        currentKey.value = key;
        currentKeyIndex = keyIndex;
        updateCaretPosition();
        selectedIndex.value = 0;
        emit("open", currentKey.value);
      }
    }

    function closeMenu() {
      if (currentKey.value != null) {
        oldKey.value = currentKey.value;
        currentKey.value = null;
        emit("close", oldKey.value);
      }
    }

    // Apply
    function applyMention(itemIndex: number) {
      const item = displayedItems.value[itemIndex];
      let end: string;
      let start: string;
      switch (currentKey.value) {
        case "@":
          start = "<@";
          end = ">";
          break;
        case "&":
          start = "<&";
          end = ">";
          break;
        case "#":
          start = "<#";
          end = ">";
          break;
        case ":":
          start = ":";
          end = ":";
          const id = item.emoji?.id || item.value;
          const chat = useChatStore();
          if (!chat.recentEmoji[id]) {
            chat.recentEmoji = {
              [id]: 1,
              ...chat.recentEmoji
            };
          } else {
            const val = chat.recentEmoji[id] + 1;
            delete chat.recentEmoji[id];
            chat.recentEmoji = {
              [id]: val,
              ...chat.recentEmoji
            };
          }
          const keys = Object.keys(chat.recentEmoji);

          if (keys.length > 20) {
            const keysToDelete = keys.slice(20);

            keysToDelete.forEach((key) => {
              delete chat.recentEmoji[key];
            });
          }
          localStorage.setItem("emojiStore", JSON.stringify(chat.recentEmoji));
          break;
        default:
          start = currentKey.value;
          end = "";
          break;
      }
      const value =
        (props.omitKey ? "" : currentKey.value) +
        String(
          props.mapInsert
            ? start + props.mapInsert(item, currentKey.value) + end
            : start + item.value + end
        ) +
        (props.insertSpace ? " " : "");
      if (value.includes("!")) {
        setValue(value);
      } else if (input.isContentEditable) {
        const range = window.getSelection().getRangeAt(0);
        range.setStart(
          range.startContainer,
          range.startOffset -
            currentKey.value.length -
            (lastSearchText ? lastSearchText.length : 0)
        );
        range.deleteContents();
        range.insertNode(document.createTextNode(value));
        range.setStart(range.endContainer, range.endOffset);
        emitInputEvent("input");
      } else {
        setValue(
          replaceText(getValue(), searchText.value, value, currentKeyIndex)
        );
        setCaretPosition(currentKeyIndex + value.length);
      }
      emit("apply", item, currentKey.value, value);
      closeMenu();
    }

    function replaceText(
      text: string,
      searchString: string,
      newText: string,
      index: number
    ) {
      return (
        text.slice(0, index) +
        newText +
        text.slice(index + searchString.length + 1, text.length)
      );
    }

    return {
      el,
      currentKey,
      oldKey,
      caretPosition,
      displayedItems,
      selectedIndex,
      applyMention
    };
  }
});
</script>

<style lang="postcss">
.popper {
  padding: 2px;
}
</style>
