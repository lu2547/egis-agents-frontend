<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { MessagePlugin } from 'tdesign-vue-next';
import type { Library, QueryHit, Tag } from './api';
import { docAssetUrl, listLibraries, listTags, queryKnowledge } from './api';

const SUB_TYPE_LABEL: Record<string, string> = {
  doc: '文档库',
  knowledge: '知识库',
  experience: '经验库'
};

const libraries = ref<Library[]>([]);
const checkedLibIds = ref<string[]>([]);
const tagsByLib = ref<Record<string, Tag[]>>({});
const checkedTagIds = ref<string[]>([]);

const query = ref('');
const mode = ref<'hybrid' | 'dense' | 'sparse'>('hybrid');
const topK = ref(10);
const threshold = ref(0);
const searching = ref(false);
const hits = ref<QueryHit[]>([]);
const expanded = ref<Set<string>>(new Set());

const ownerLibs = computed(() => libraries.value.filter((l) => l.owner_type === 'owner'));
const personalLibs = computed(() => libraries.value.filter((l) => l.owner_type === 'personal'));

/** 只展示已勾选库的目录，供二次过滤。 */
const visibleTagGroups = computed(() =>
  checkedLibIds.value
    .map((id) => ({
      lib: libraries.value.find((l) => l.id_library === id)!,
      tags: tagsByLib.value[id] || []
    }))
    .filter((g) => g.lib)
);

function tagDepth(tags: Tag[], tag: Tag): number {
  let depth = 0;
  let cur = tag;
  while (cur.parent_id_tag) {
    const parent = tags.find((t) => t.id_tag === cur.parent_id_tag);
    if (!parent) break;
    depth += 1;
    cur = parent;
  }
  return depth;
}

async function loadTagsFor(libId: string) {
  if (tagsByLib.value[libId]) return;
  try {
    tagsByLib.value[libId] = await listTags(libId);
  } catch {
    tagsByLib.value[libId] = [];
  }
}

watch(checkedLibIds, (ids) => {
  ids.forEach(loadTagsFor);
  const valid = new Set(ids.flatMap((id) => (tagsByLib.value[id] || []).map((t) => t.id_tag)));
  checkedTagIds.value = checkedTagIds.value.filter((id) => valid.has(id));
});

/** 分数阈值过滤（页面可选），召回顺序已按分数降序。 */
const visibleHits = computed(() =>
  hits.value.filter((h) => h.score >= threshold.value)
);

async function onSearch() {
  if (!query.value.trim()) {
    MessagePlugin.warning('请输入查询内容');
    return;
  }
  if (!checkedLibIds.value.length) {
    MessagePlugin.warning('请至少勾选一个库');
    return;
  }
  searching.value = true;
  try {
    const r = await queryKnowledge({
      library_ids: checkedLibIds.value,
      query: query.value.trim(),
      tag_ids: checkedTagIds.value.length ? checkedTagIds.value : undefined,
      mode: mode.value,
      top_k: topK.value
    });
    hits.value = r.hits;
    expanded.value = new Set(r.hits.map((h) => h.chunk_id));
    if (!r.total) MessagePlugin.info('未召回相关知识');
  } catch (e: any) {
    MessagePlugin.error(e.message);
  } finally {
    searching.value = false;
  }
}

function toggleHit(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id);
  else expanded.value.add(id);
  expanded.value = new Set(expanded.value);
}

/** 命中块按 Markdown 渲染（表格/图片同抽屉），图片地址重写为文档资产路由。 */
function renderBlock(md: string, docId: string): string {
  const rewritten = md.replace(
    /\]\(images\//g,
    `](${docAssetUrl(docId, 'images/')}`
  );
  return DOMPurify.sanitize(marked.parse(rewritten) as string);
}

onMounted(async () => {
  try {
    libraries.value = await listLibraries();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
});
</script>

<template>
  <div class="query-panel">
    <aside class="filter-column">
      <p class="filter-title">选择库</p>
      <template v-for="group in [
        { label: '属主库', libs: ownerLibs },
        { label: '个人库', libs: personalLibs }
      ]" :key="group.label">
        <p class="filter-group">{{ group.label }}</p>
        <t-checkbox-group v-model="checkedLibIds">
          <div v-for="lib in group.libs" :key="lib.id_library" class="filter-item">
            <t-checkbox :value="lib.id_library">
              {{ lib.name }}
              <span class="lib-badge">{{ SUB_TYPE_LABEL[lib.sub_type] }}</span>
            </t-checkbox>
          </div>
        </t-checkbox-group>
      </template>

      <template v-if="visibleTagGroups.length">
        <p class="filter-title">目录过滤（可选）</p>
        <t-checkbox-group v-model="checkedTagIds">
          <template v-for="g in visibleTagGroups" :key="g.lib.id_library">
            <div v-for="tag in g.tags" :key="tag.id_tag" class="filter-item">
              <t-checkbox
                :value="tag.id_tag"
                :style="{ paddingLeft: `${tagDepth(g.tags, tag) * 14}px` }"
              >
                {{ tag.name }}
              </t-checkbox>
            </div>
          </template>
        </t-checkbox-group>
      </template>
    </aside>

    <div class="result-column">
      <div class="search-bar">
        <t-input
          v-model="query"
          placeholder="输入查询，支持关键字 + 语义混合召回"
          clearable
          @enter="onSearch"
        />
        <t-select
          v-model="mode"
          size="small"
          style="width: 110px"
          :options="[
            { label: '混合', value: 'hybrid' },
            { label: '语义', value: 'dense' },
            { label: '关键字', value: 'sparse' }
          ]"
        />
        <span class="bar-label">topK</span>
        <t-input-number
          v-model="topK"
          :min="1"
          :max="50"
          size="small"
          theme="normal"
          style="width: 80px"
        />
        <span class="bar-label">阈值</span>
        <t-input-number
          v-model="threshold"
          :min="0"
          :max="1"
          :step="0.05"
          size="small"
          theme="normal"
          style="width: 100px"
        />
        <t-button theme="primary" :loading="searching" @click="onSearch">查询</t-button>
      </div>

      <div v-if="!hits.length && !searching" class="result-empty">
        查询结果以块列表展示，点击块头可折叠/展开
      </div>
      <ul class="result-list">
        <li v-for="h in visibleHits" :key="h.chunk_id" class="result-item">
          <div class="result-head" @click="toggleHit(h.chunk_id)">
            <span class="result-toggle">{{ expanded.has(h.chunk_id) ? '−' : '+' }}</span>
            <span class="hit-channel" :class="`is-${h.channel}`">
              {{ h.channel === 'dense' ? '语义' : h.channel === 'sparse' ? '关键字' : h.channel }}
            </span>
            <span class="result-name">{{ h.file_name || h.document_id }}</span>
            <span class="chunk-no">#{{ h.chunk_index + 1 }}</span>
            <span class="result-score">{{ h.score.toFixed(4) }}</span>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            v-if="expanded.has(h.chunk_id)"
            class="hit-block"
            v-html="renderBlock(h.block || h.snippet, h.document_id)"
          />
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.query-panel {
  display: flex; gap: 12px; height: 100%; min-height: 0;
  padding: 14px; box-sizing: border-box;
}
.filter-column {
  flex: 0 0 250px; display: flex; flex-direction: column; gap: 6px;
  padding: 12px; border: 1px solid #e7ebf2; border-radius: 10px; background: #fff;
  overflow-y: auto;
}
.filter-title { margin: 4px 0; font-size: 13px; font-weight: 600; color: #1d2939; }
.filter-group { margin: 4px 0 0; font-size: 11px; color: #98a2b3; }
.filter-item { padding: 2px 0; }
.lib-badge {
  font-size: 10px; padding: 1px 6px; border-radius: 8px;
  background: #f2f4f7; color: #667085; margin-left: 4px;
}
.result-column {
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;
  padding: 12px; border: 1px solid #e7ebf2; border-radius: 10px; background: #fff;
  overflow-y: auto;
}
.search-bar { display: flex; align-items: center; gap: 8px; }
.result-empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  color: #98a2b3; font-size: 13px;
}
.result-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.result-item { border: 1px solid #e7ebf2; border-radius: 8px; overflow: hidden; }
.result-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; cursor: pointer; background: #f8fafd;
}
.result-head:hover { background: #f2f6ff; }
.result-toggle { color: #2f5bff; font-size: 14px; width: 14px; }
.result-name { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: #1d2939; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-score { font-size: 12px; color: #98a2b3; font-variant-numeric: tabular-nums; }
.hit-list { list-style: none; margin: 0; padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; }
.hit-item { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
.hit-channel { font-size: 10px; padding: 1px 6px; border-radius: 8px; }
.hit-channel.is-dense { background: #e0eaff; color: #2f5bff; }
.hit-channel.is-sparse { background: #fef0e6; color: #d46b08; }
.hit-score { font-size: 11px; color: #98a2b3; font-variant-numeric: tabular-nums; }
.hit-block {
  flex-basis: 100%; margin: 4px 0 0; font-size: 12px; color: #4a5568; line-height: 1.7;
  word-break: break-all;
}
.hit-block :deep(em) { color: #d4380d; font-style: normal; font-weight: 600; background: #fff2e8; }
.hit-block :deep(p) { margin: 4px 0; }
.hit-block :deep(table) { border-collapse: collapse; margin: 6px 0; width: 100%; }
.hit-block :deep(td), .hit-block :deep(th) {
  border: 1px solid #d5dce6; padding: 4px 8px; font-size: 12px; text-align: left;
}
.bar-label { font-size: 12px; color: #667085; }
.chunk-no { font-size: 12px; color: #2f5bff; font-weight: 600; }
</style>
