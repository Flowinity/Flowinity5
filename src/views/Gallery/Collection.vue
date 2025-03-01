<template>
  <collection-settings
    @refresh="refresh"
    v-model="settings"
    :collection="collection"
  />
  <collection-sharing v-model="sharing" :collection="collection" />
  <gallery
    :path="`/collections/${route.params.id}`"
    :name="`${collection?.name} Collection`"
    :type="GalleryType.Collection"
    :id="id"
  >
    <template #extra-item-attributes="{ item }: { item: Upload }">
      <p>
        {{
          t("gallery.attributes.addedAt", {
            date: dayjs(item?.item?.createdAt).format("Do of MMMM YYYY, h:mm A")
          })
        }}
      </p>
      <p>
        {{
          t("gallery.attributes.createdBy", {
            name: item.user?.username
          })
        }}
      </p>
    </template>
  </gallery>
  <teleport to="#appbar-options-first">
    <transition mode="out-in" name="slide-up" appear>
      <div class="flex gap-2">
        <transition name="slide-up" mode="out-in">
          <leave-collection-dialog :collection="collection" v-slot="{ toggle }">
            <tpu-button
              icon
              v-if="collection?.userId !== userStore.user?.id"
              :key="collection?.userId"
              variant="passive"
              v-tooltip.bottom="t('collections.nav.leave')"
              @click="toggle"
            >
              <RiLogoutBoxLine style="width: 20px" />
            </tpu-button>
          </leave-collection-dialog>
        </transition>
        <transition name="slide-up" mode="out-in">
          <tpu-button
            icon
            v-if="!!collection?.shareLink"
            :key="collection?.userId"
            variant="passive"
            @click="
              functions.copy(
                `${appStore.state.hostnameWithProtocol}/collections/${collection?.shareLink}`
              );
              toast.success(t('generic.copied'));
            "
            v-tooltip.bottom="t('collections.nav.shareLink')"
          >
            <RiLink style="width: 20px" />
          </tpu-button>
        </transition>
        <tpu-button
          icon
          variant="passive"
          v-tooltip.bottom="t('collections.nav.share')"
          @click="sharing = true"
        >
          <RiShareForwardFill style="width: 20px" />
        </tpu-button>
        <tpu-button
          icon
          variant="passive"
          v-tooltip.bottom="t('collections.nav.settings')"
          @click="settings = true"
        >
          <RiSettings5Line style="width: 20px" />
        </tpu-button>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import Gallery from "@/views/Gallery/Gallery.vue";
import { useRoute, useRouter } from "vue-router";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { Collection } from "@/gql/graphql";
import { Chat, GalleryType, Upload } from "@/gql/graphql";
import { useCollectionsStore } from "@/stores/collections.store";
import { isNumeric } from "@/plugins/isNumeric";
import type { ComputedRef } from "vue";
import { RailMode, useAppStore } from "@/stores/app.store";
import TpuButton from "@/components/Framework/Button/TpuButton.vue";
import RiShareForwardFill from "vue-remix-icons/icons/ri-share-forward-fill.vue";
import RiSettings5Line from "vue-remix-icons/icons/ri-settings-5-line.vue";
import { useI18n } from "vue-i18n";
import TpuDivider from "@/components/Framework/Divider/TpuDivider.vue";
import CollectionSettings from "@/components/Collections/CollectionSettings.vue";
import { useSocket } from "@/boot/socket.service";
import RiImageEditLine from "vue-remix-icons/icons/ri-image-edit-line.vue";
import CollectionSharing from "@/components/Collections/CollectionSharing.vue";
import SetPictureDialog from "@/components/Core/Dialogs/SetPictureDialog.vue";
import axios from "@/plugins/axios.ts";
import functions from "@/plugins/functions";
import { useToast } from "vue-toastification";
const collectionsStore = useCollectionsStore();
const collection = ref<Collection | undefined>(undefined);
const route = useRoute();
const appStore = useAppStore();
const { t } = useI18n();
const settings = ref(false);
const sharing = ref(false);
const id: ComputedRef<number | string> = computed(() => {
  const rid = <string>route.params.id;
  return isNumeric(rid) ? (typeof rid === "number" ? rid : parseInt(rid)) : rid;
});
import RiLink from "vue-remix-icons/icons/ri-link.vue";
import dayjs from "@/plugins/dayjs";
import { h, markRaw } from "vue";
import UserAvatar from "@/components/User/UserAvatar.vue";
import RiCollageLine from "vue-remix-icons/icons/ri-collage-line.vue";
import RiCollageFill from "vue-remix-icons/icons/ri-collage-fill.vue";
import { useSubscription } from "@vue/apollo-composable";
import {
  CollectionRemovedSubscription,
  CollectionUpdatedSubscription,
  CollectionUserAddSubscription,
  CollectionUserRemoveSubscription,
  CollectionUserUpdateSubscription
} from "@/graphql/collections/subscriptions/updateCollection.graphql";
import { useUserStore } from "@/stores/user.store";
import RiLogoutBoxLine from "vue-remix-icons/icons/ri-logout-box-line.vue";
import LeaveCollectionDialog from "@/components/Collections/LeaveCollectionDialog.vue";

const userStore = useUserStore();
const toast = useToast();

const banner = computed(() => {
  if (!collection.value?.banner) return null;
  return appStore.domain + collection.value?.banner;
});

watch(
  () => banner.value,
  (val) => {
    appStore.appBarImage = val;
  }
);

onMounted(async () => {
  collection.value = await collectionsStore.getCollection(id.value);
});

function setAppBar() {
  appStore.currentNavItem = {
    item: {
      name: collection.value?.name || "Loading...",
      icon: collection.value?.avatar
        ? h(UserAvatar, {
            username: collection.value?.name,
            src: appStore.domain + collection.value?.avatar,
            size: 32,
            style: "margin: 0px 4px 0px 4px"
          })
        : markRaw(RiCollageLine),
      path: route.path,
      selectedIcon: markRaw(RiCollageFill),
      _rail: RailMode.GALLERY
    },
    rail: [
      appStore.navigation.railOptions.find(
        (rail) => rail.id === RailMode.GALLERY
      )
    ]
  };
}

watch(
  () => collection.value?.name,
  (val) => {
    setAppBar();
  }
);

async function refresh() {
  collection.value = await collectionsStore.getCollection(id.value);
}

const subscriptions: Record<string, any> = {
  update: null,
  userUpdate: null,
  userAdd: null,
  userRemove: null,
  remove: null
};

function registerSubscriptions() {
  console.log(id.value);
  Object.values(subscriptions).forEach((sub) => {
    if (sub) sub.off();
  });
  subscriptions.update = useSubscription(CollectionUpdatedSubscription, {
    input: {
      collectionId: id.value
    }
  }).onResult(({ data }) => {
    if (!data) return;
    refresh();
  });
  subscriptions.userUpdate = useSubscription(CollectionUserUpdateSubscription, {
    input: {
      collectionId: id.value
    }
  }).onResult(({ data }) => {
    if (!data) return;
    refresh();
  });
  subscriptions.userAdd = useSubscription(CollectionUserAddSubscription, {
    input: {
      collectionId: id.value
    }
  }).onResult(({ data }) => {
    if (!data) return;
    refresh();
  });
  subscriptions.userRemove = useSubscription(CollectionUserRemoveSubscription, {
    input: {
      collectionId: id.value
    }
  }).onResult(({ data }) => {
    console.log(data);
    if (!data) return;
    refresh();
  });
  subscriptions.remove = useSubscription(CollectionRemovedSubscription, {
    input: {
      collectionId: id.value
    }
  }).onResult(({ data }) => {
    if (!data) return;
    const router = useRouter();
    router.push({ name: "Gallery" });
  });
}

onMounted(() => {
  setAppBar();
  registerSubscriptions();
});

watch(
  () => route.params.id,
  async () => {
    if (!id.value) {
      appStore.appBarImage = null;
      return;
    }
    collection.value = await collectionsStore.getCollection(id.value);
    registerSubscriptions();
  }
);

onUnmounted(() => {
  appStore.appBarImage = null;
});
</script>

<style scoped></style>
