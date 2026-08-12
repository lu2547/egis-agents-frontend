<script setup lang="ts">
import { ref, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { Experience, Library } from './api';
import {
  createExperience,
  deleteExperience,
  importExperiences,
  listExperiences
} from './api';

const props = defineProps<{ library: Library }>();

const experiences = ref<Experience[]>([]);
const loading = ref(false);
const showForm = ref(false);
const saving = ref(false);
const importing = ref(false);
const fileInput = ref<HTMLInputElement>();

const emptyForm = () => ({
  category: '',
  question: '',
  reasoning_path: '',
  reference_doc_path: '',
  output_format: ''
});
const form = ref(emptyForm());

async function refresh() {
  if (!props.library) return;
  loading.value = true;
  try {
    experiences.value = await listExperiences(props.library.id_library);
  } catch (e: any) {
    MessagePlugin.error(e.message);
  } finally {
    loading.value = false;
  }
}

async function onCreate() {
  if (!form.value.question.trim()) {
    MessagePlugin.warning('问题不能为空');
    return;
  }
  saving.value = true;
  try {
    await createExperience(props.library.id_library, form.value);
    MessagePlugin.success('已录入');
    form.value = emptyForm();
    showForm.value = false;
    await refresh();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  } finally {
    saving.value = false;
  }
}

async function onImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  importing.value = true;
  try {
    const r = await importExperiences(props.library.id_library, file);
    MessagePlugin.success(`导入完成：新增 ${r.created} 条，跳过 ${r.skipped} 条`);
    await refresh();
  } catch (err: any) {
    MessagePlugin.error(err.message);
  } finally {
    importing.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

async function onDelete(exp: Experience) {
  try {
    await deleteExperience(exp.id_experience);
    MessagePlugin.success('已删除');
    await refresh();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

watch(() => props.library?.id_library, refresh, { immediate: true });
</script>

<template>
  <div class="exp-panel">
    <div class="exp-toolbar">
      <t-button size="small" theme="primary" @click="showForm = !showForm">
        {{ showForm ? '收起表单' : '在线录入' }}
      </t-button>
      <t-button size="small" variant="outline" :loading="importing" @click="fileInput?.click()">
        Excel 导入
      </t-button>
      <input
        ref="fileInput"
        type="file"
        style="display: none"
        accept=".xlsx,.xls"
        @change="onImport"
      />
      <span class="exp-hint">Excel 列：问题分类 / 问题 / 思维链路径 / 参考文档路径 / 输出格式</span>
    </div>

    <div v-if="showForm" class="exp-form">
      <t-input v-model="form.category" placeholder="问题分类（如：报销流程）" size="small" />
      <t-textarea v-model="form.question" placeholder="问题" :autosize="{ minRows: 2 }" />
      <t-textarea
        v-model="form.reasoning_path"
        placeholder="思维链 / Skills 路径"
        :autosize="{ minRows: 2 }"
      />
      <t-input v-model="form.reference_doc_path" placeholder="参考文档路径" size="small" />
      <t-input v-model="form.output_format" placeholder="输出格式要求" size="small" />
      <div class="exp-form-actions">
        <t-button size="small" theme="primary" :loading="saving" @click="onCreate">保存</t-button>
        <t-button size="small" variant="text" @click="showForm = false">取消</t-button>
      </div>
    </div>

    <div v-if="!experiences.length && !loading" class="exp-empty">当前经验库暂无数据</div>
    <ul class="exp-list">
      <li v-for="exp in experiences" :key="exp.id_experience" class="exp-item">
        <div class="exp-head">
          <span v-if="exp.category" class="exp-category">{{ exp.category }}</span>
          <span class="exp-question">{{ exp.question }}</span>
          <t-button size="small" variant="text" theme="danger" @click="onDelete(exp)">
            删除
          </t-button>
        </div>
        <p v-if="exp.reasoning_path" class="exp-field">思维链：{{ exp.reasoning_path }}</p>
        <p v-if="exp.reference_doc_path" class="exp-field">参考文档：{{ exp.reference_doc_path }}</p>
        <p v-if="exp.output_format" class="exp-field">输出格式：{{ exp.output_format }}</p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.exp-panel { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.exp-toolbar { display: flex; align-items: center; gap: 8px; }
.exp-hint { font-size: 12px; color: #98a2b3; }
.exp-form {
  display: flex; flex-direction: column; gap: 8px;
  padding: 12px; border: 1px solid #e7ebf2; border-radius: 8px; background: #f8fafd;
}
.exp-form-actions { display: flex; gap: 8px; justify-content: flex-end; }
.exp-empty { padding: 32px 0; text-align: center; color: #98a2b3; font-size: 13px; }
.exp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.exp-item { padding: 10px 12px; border: 1px solid #e7ebf2; border-radius: 8px; background: #fff; }
.exp-head { display: flex; align-items: center; gap: 8px; }
.exp-category {
  flex: 0 0 auto; font-size: 11px; padding: 1px 8px; border-radius: 9px;
  background: #e0eaff; color: #2f5bff;
}
.exp-question { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: #1d2939; }
.exp-field { margin: 4px 0 0; font-size: 12px; color: #667085; line-height: 1.6; word-break: break-all; }
</style>
