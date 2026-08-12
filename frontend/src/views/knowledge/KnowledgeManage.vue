<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { Library, Tag } from './api';
import {
  createLibrary,
  createTag,
  deleteLibrary,
  deleteTag,
  listLibraries,
  listTags
} from './api';
import KnowledgeDocPanel from './KnowledgeDocPanel.vue';
import KnowledgeExpPanel from './KnowledgeExpPanel.vue';

const SUB_TYPE_LABEL: Record<string, string> = {
  doc: '文档库',
  knowledge: '知识库',
  experience: '经验库'
};

const libraries = ref<Library[]>([]);
const activeLibId = ref('');
const tags = ref<Tag[]>([]);
const activeTagId = ref('');

const showCreate = ref(false);
const createForm = ref({
  name: '',
  owner_type: 'owner' as 'owner' | 'personal',
  sub_type: 'doc' as 'doc' | 'knowledge' | 'experience',
  owner: '',
  description: ''
});

const ownerLibs = computed(() => libraries.value.filter((l) => l.owner_type === 'owner'));
const personalLibs = computed(() => libraries.value.filter((l) => l.owner_type === 'personal'));
const activeLib = computed(
  () => libraries.value.find((l) => l.id_library === activeLibId.value) || null
);

interface TagNode extends Tag {
  depth: number;
}

/** 扁平化目录树（先序遍历 + depth 缩进），供模板直接 v-for。 */
const tagTree = computed<TagNode[]>(() => {
  const byParent = new Map<string, Tag[]>();
  for (const t of tags.value) {
    const key = t.parent_id_tag || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }
  const out: TagNode[] = [];
  const walk = (parentId: string, depth: number) => {
    for (const t of byParent.get(parentId) || []) {
      out.push({ ...t, depth });
      walk(t.id_tag, depth + 1);
    }
  };
  walk('', 0);
  return out;
});

async function refreshLibraries(keepSelection = true) {
  libraries.value = await listLibraries();
  if (!keepSelection || !libraries.value.some((l) => l.id_library === activeLibId.value)) {
    activeLibId.value = libraries.value[0]?.id_library || '';
  }
}

async function refreshTags() {
  if (!activeLibId.value) {
    tags.value = [];
    return;
  }
  tags.value = await listTags(activeLibId.value);
  if (!tags.value.some((t) => t.id_tag === activeTagId.value)) activeTagId.value = '';
}

async function onCreateLibrary() {
  if (!createForm.value.name.trim()) {
    MessagePlugin.warning('库名称不能为空');
    return;
  }
  try {
    const lib = await createLibrary(createForm.value);
    MessagePlugin.success('已创建');
    showCreate.value = false;
    createForm.value = { name: '', owner_type: 'owner', sub_type: 'doc', owner: '', description: '' };
    await refreshLibraries();
    activeLibId.value = lib.id_library;
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

async function onDeleteLibrary(lib: Library) {
  try {
    await deleteLibrary(lib.id_library);
    MessagePlugin.success('已删除');
    await refreshLibraries(false);
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

async function onAddTag(parentId: string) {
  const name = window.prompt(parentId ? '子目录名称' : '根目录名称');
  if (!name?.trim()) return;
  try {
    await createTag(activeLibId.value, name.trim(), parentId);
    await refreshTags();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

async function onDeleteTag(tag: Tag) {
  try {
    await deleteTag(tag.id_tag);
    if (activeTagId.value === tag.id_tag) activeTagId.value = '';
    await refreshTags();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

function onTagsChanged(selectTagId?: string) {
  refreshTags().then(() => {
    if (selectTagId) activeTagId.value = selectTagId;
  });
}

watch(activeLibId, () => {
  activeTagId.value = '';
  refreshTags();
});
onMounted(async () => {
  try {
    await refreshLibraries();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
});
</script>

<template>
  <div class="manage-panel">
    <aside class="side-column">
      <div class="side-section lib-section">
        <div class="col-head">
          <span>库</span>
          <t-button size="small" theme="primary" @click="showCreate = true">新建库</t-button>
        </div>
        <div class="side-scroll">
          <template v-for="group in [
            { label: '属主库', libs: ownerLibs },
            { label: '个人库', libs: personalLibs }
          ]" :key="group.label">
            <p class="lib-group">{{ group.label }}</p>
            <ul class="lib-list">
              <li
                v-for="lib in group.libs"
                :key="lib.id_library"
                class="lib-item"
                :class="{ active: lib.id_library === activeLibId }"
                @click="activeLibId = lib.id_library"
              >
                <span class="lib-name">{{ lib.name }}</span>
                <span class="lib-badge">{{ SUB_TYPE_LABEL[lib.sub_type] }}</span>
                <span class="lib-del" title="删除库" @click.stop="onDeleteLibrary(lib)">×</span>
              </li>
              <li v-if="!group.libs.length" class="lib-empty">暂无</li>
            </ul>
          </template>
        </div>
      </div>

      <div class="side-section tag-section">
        <div class="col-head">
          <span>目录</span>
          <t-button
            size="small"
            variant="outline"
            :disabled="!activeLib"
            @click="onAddTag('')"
          >
            加根目录
          </t-button>
        </div>
        <div class="side-scroll">
          <div v-if="!activeLib" class="tag-empty">先选择一个库</div>
          <ul v-else class="tag-list">
            <li
              v-for="tag in tagTree"
              :key="tag.id_tag"
              class="tag-item"
              :class="{ active: tag.id_tag === activeTagId }"
              :style="{ paddingLeft: `${10 + tag.depth * 16}px` }"
              @click="activeTagId = activeTagId === tag.id_tag ? '' : tag.id_tag"
            >
              <span class="tag-name">{{ tag.name }}</span>
              <span v-if="tag.doc_count_all" class="tag-count" :title="`含子目录共 ${tag.doc_count_all} 个文档`">
                {{ tag.doc_count_all }}
              </span>
              <span class="tag-op" title="加子目录" @click.stop="onAddTag(tag.id_tag)">＋</span>
              <span class="tag-op" title="删除目录" @click.stop="onDeleteTag(tag)">×</span>
            </li>
            <li v-if="!tagTree.length" class="tag-empty">暂无目录，可点右上「加根目录」</li>
          </ul>
        </div>
      </div>
    </aside>

    <div class="content-column">
      <template v-if="activeLib">
        <div class="content-title">
          <strong>{{ activeLib.name }}</strong>
          <span class="lib-badge">{{ SUB_TYPE_LABEL[activeLib.sub_type] }}</span>
          <span v-if="activeLib.description" class="content-desc">{{ activeLib.description }}</span>
        </div>
        <KnowledgeExpPanel v-if="activeLib.sub_type === 'experience'" :library="activeLib" />
        <KnowledgeDocPanel
          v-else
          :library="activeLib"
          :tags="tags"
          :active-tag-id="activeTagId"
          @tags-changed="onTagsChanged"
        />
      </template>
      <div v-else class="content-empty">请选择或新建一个库</div>
    </div>

    <t-dialog
      v-model:visible="showCreate"
      header="新建库"
      :on-confirm="onCreateLibrary"
      width="420px"
    >
      <div class="create-form">
        <t-input v-model="createForm.name" placeholder="库名称" />
        <t-select
          v-model="createForm.owner_type"
          :options="[
            { label: '属主库', value: 'owner' },
            { label: '个人库', value: 'personal' }
          ]"
        />
        <t-select
          v-model="createForm.sub_type"
          :options="[
            { label: '文档库', value: 'doc' },
            { label: '知识库', value: 'knowledge' },
            { label: '经验库', value: 'experience' }
          ]"
        />
        <t-input
          v-model="createForm.owner"
          :placeholder="createForm.owner_type === 'personal' ? '属主（个人库必填）' : '属主（可选）'"
        />
        <t-textarea v-model="createForm.description" placeholder="描述（可选）" :autosize="{ minRows: 2 }" />
      </div>
    </t-dialog>
  </div>
</template>

<style scoped>
.manage-panel {
  display: flex; gap: 12px; height: 100%; min-height: 0;
  padding: 14px; box-sizing: border-box;
}
.side-column {
  flex: 0 0 250px;
  display: flex; flex-direction: column; gap: 10px; min-height: 0;
}
.side-section {
  display: flex; flex-direction: column; gap: 8px; min-height: 0;
  padding: 12px; border: 1px solid #e7ebf2; border-radius: 10px; background: #fff;
}
.lib-section { flex: 0 1 auto; max-height: 46%; }
.tag-section { flex: 1 1 auto; }
.side-scroll { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.col-head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; font-weight: 600; color: #1d2939;
}
.lib-group { margin: 6px 0 0; font-size: 11px; color: #98a2b3; }
.lib-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.lib-item {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 9px; border-radius: 7px; cursor: pointer; font-size: 13px;
}
.lib-item:hover { background: #f2f6ff; }
.lib-item.active { background: #e0eaff; }
.lib-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1d2939; }
.lib-badge {
  flex: 0 0 auto; font-size: 10px; padding: 1px 6px; border-radius: 8px;
  background: #f2f4f7; color: #667085;
}
.lib-del { color: #c0c6d4; font-size: 14px; padding: 0 2px; }
.lib-del:hover { color: #d92d20; }
.lib-empty, .tag-empty { font-size: 12px; color: #c0c6d4; padding: 6px 2px; list-style: none; }
.tag-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.tag-item {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 13px;
}
.tag-item:hover { background: #f2f6ff; }
.tag-item.active { background: #e0eaff; }
.tag-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1d2939; }
.tag-count {
  flex: 0 0 auto; font-size: 10px; padding: 0 6px; border-radius: 8px;
  background: #e0eaff; color: #0052d9;
}
.tag-op { color: #c0c6d4; font-size: 13px; padding: 0 3px; }
.tag-op:hover { color: #2f5bff; }
.content-column {
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;
  padding: 12px; border: 1px solid #e7ebf2; border-radius: 10px; background: #fff;
  overflow-y: auto;
}
.content-title { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #1d2939; }
.content-desc { font-size: 12px; color: #98a2b3; }
.content-empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  color: #98a2b3; font-size: 13px;
}
.create-form { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
</style>
