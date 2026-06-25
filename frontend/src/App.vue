<script setup lang="ts">
import AppShell from './components/AppShell.vue';
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <RouterView v-if="route.meta.layout === 'bare'" />
  <AppShell v-else />
</template>
