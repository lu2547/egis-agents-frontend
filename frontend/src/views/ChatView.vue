<script setup lang="ts">
import { ref } from 'vue';
import {
  ChatAddIcon,
  CheckCircleIcon,
  CircleIcon,
  LoadingIcon,
  ArrowUpIcon,
  BookOpenIcon,
  ChevronRightIcon,
  CloseIcon,
  DataSearchIcon,
  FileIcon,
  InternetIcon,
  SearchIcon
} from 'tdesign-icons-vue-next';
import { useChat } from './chat/useChat';
import { useScopeSelection } from './chat/scope';
import { renderMarkdown } from './chat/markdown';
import { activeStepId, completedCount, displayTodoSteps, todoSteps, todoSummary, todoTitle } from './chat/todo';

const showScopePanel = ref(false);
const showPreciseScope = ref(false);

const {
  scopeGroups,
  internetSearchEnabled,
  selectedScopeIds,
  selectedTagIds,
  selectedFileIds,
  activeScopeLibraryId,
  scopeSearchKeyword,
  activeScopeLibrary,
  filteredActiveScopeFiles,
  scopeLabel,
  selectedScopeBadges,
  isLibraryAllTagsSelected,
  isScopeGroupAllSelected,
  toggleScopeLibrary,
  toggleScopeGroup,
  toggleTag,
  toggleFile,
  toggleLibraryAllTags,
  removeSelectedScopeBadge,
  preparePreciseScope,
  clearScope
} = useScopeSelection();

const {
  selectedAgent,
  inputValue,
  messages,
  isLoading,
  chatBodyRef,
  currentTaskTitle,
  recentPrompts,
  commonAgents,
  annuityAgents,
  selectAgent,
  fillPrompt,
  sendMessage
} = useChat(
  { internetSearchEnabled, selectedScopeIds, selectedTagIds, selectedFileIds },
  () => {
    showScopePanel.value = false;
    showPreciseScope.value = false;
  }
);

const openPreciseScope = () => {
  preparePreciseScope();
  showScopePanel.value = false;
  showPreciseScope.value = true;
};

const applyPreciseScope = () => {
  showPreciseScope.value = false;
};
</script>

<template>
  <section class="chat-shell">
    <aside class="workbench-panel">
      <div class="workbench-card">
        <button class="new-chat-button" type="button">
          <ChatAddIcon />
          新对话
        </button>
        <div class="history-list">
          <div class="history-title">对话历史</div>
          <button v-for="prompt in recentPrompts" :key="prompt" type="button" @click="fillPrompt(prompt)">
            {{ prompt }}
          </button>
        </div>
        <button class="skill-market-button" type="button">
          <span class="skill-spark">✨</span>
          <strong>Skills广场</strong>
          <ChevronRightIcon />
        </button>
      </div>
    </aside>

    <main class="chat-main">
      <div ref="chatBodyRef" class="chat-body">
        <div v-if="!messages.length" class="empty-state">
          <h1>有问题，找养老险GPT <span class="pai-arrow" aria-hidden="true"></span></h1>
          <p>让复杂文档理解与精准检索变得简单</p>

          <div class="composer hero-composer">
            <textarea
              v-model="inputValue"
              rows="3"
              :placeholder="`输入问题，当前使用 ${selectedAgent.title}`"
              @keydown.enter.exact.prevent="sendMessage"
            />
            <div class="composer-footer">
              <div class="composer-tools">
                <div class="agent-chip">
                  <component :is="selectedAgent.icon" />
                  {{ selectedAgent.title }}
                </div>
                <button type="button" class="scope-chip" @click="showScopePanel = !showScopePanel">
                  <DataSearchIcon />
                  {{ scopeLabel }}
                </button>
              </div>
              <button type="button" class="send-button" :disabled="isLoading || !inputValue.trim()" @click="sendMessage">
                <ArrowUpIcon />
              </button>
            </div>
            <div v-if="showScopePanel" class="scope-panel">
              <div v-if="selectedScopeBadges.length" class="scope-panel-selected">
                <span v-for="badge in selectedScopeBadges" :key="badge.key" class="selected-chip">
                  {{ badge.text }}
                  <button type="button" aria-label="移除" @click.stop="removeSelectedScopeBadge(badge)">
                    <CloseIcon />
                  </button>
                </span>
              </div>
              <div class="scope-row internet-row">
                <div class="scope-title">
                  <InternetIcon />
                  <strong>互联网搜索</strong>
                </div>
                <label class="switch-control">
                  <input v-model="internetSearchEnabled" type="checkbox" />
                  <span></span>
                  开启
                </label>
              </div>
              <div v-for="group in scopeGroups" :key="group.id" class="scope-row">
                <div class="scope-title">
                  <BookOpenIcon />
                  <strong>{{ group.title }}</strong>
                </div>
                <div class="scope-check-grid">
                  <label class="check-item all-item">
                    <input
                      type="checkbox"
                      :checked="isScopeGroupAllSelected(group)"
                      @change="toggleScopeGroup(group)"
                    />
                    <span>全部</span>
                  </label>
                  <label v-for="library in group.libraries" :key="library.id" class="check-item">
                    <input
                      type="checkbox"
                      :checked="selectedScopeIds.includes(library.id)"
                      @change="toggleScopeLibrary(library.id)"
                    />
                    <span>{{ library.name }}</span>
                  </label>
                </div>
              </div>
              <button type="button" class="precise-button" @click="openPreciseScope">
                <DataSearchIcon />
                进入精准搜索筛选
                <ChevronRightIcon />
              </button>
            </div>
          </div>

          <div class="ability-layout">
            <section class="ability-panel wide">
              <header>
                <ChatBubbleHelpIcon />
                <strong>通用Agent</strong>
              </header>
              <div class="ability-grid">
                <button
                  v-for="agent in commonAgents"
                  :key="agent.id"
                  type="button"
                  class="ability-card"
                  @click="selectAgent(agent.id)"
                >
                  <component :is="agent.icon" />
                  <strong>{{ agent.title }}</strong>
                  <span>{{ agent.desc }}</span>
                </button>
              </div>
            </section>
            <section class="ability-panel compact annuity-panel">
              <header>
                <FileWordIcon />
                <strong>年金Agent</strong>
              </header>
              <div class="ability-grid single">
                <button
                  v-for="agent in annuityAgents"
                  :key="agent.id"
                  type="button"
                  class="ability-card"
                  @click="selectAgent(agent.id)"
                >
                  <component :is="agent.icon" />
                  <strong>{{ agent.title }}</strong>
                  <span>{{ agent.desc }}</span>
                </button>
              </div>
            </section>
          </div>
        </div>

        <div v-else class="conversation-view">
          <header class="conversation-title">
            <span class="task-icon">
              <component :is="selectedAgent.icon" />
            </span>
            <strong>{{ currentTaskTitle }}</strong>
          </header>

          <div class="message-list">
            <article v-for="message in messages" :key="message.id" :class="['message', message.role]">
              <div v-if="message.role === 'user'" class="user-message-wrap">
                <div class="user-bubble">
                  {{ message.content }}
                </div>
              </div>
              <div v-else class="assistant-stack">
                <section v-if="message.isStreaming || message.todoCard || message.reasoning" class="process-card">
                  <header class="agent-entered">
                    <div>
                      <span class="spark">✦</span>
                      <span>智颐通已进入</span>
                      <strong>[{{ message.agentTitle || selectedAgent.title }}]</strong>
                    </div>
                    <em v-if="message.elapsed">耗时 {{ message.elapsed }}s</em>
                  </header>

                  <div class="thinking-title">
                    <span>{{ message.todoCard ? todoTitle(message) : '智颐通正在分析问题...' }}</span>
                    <em v-if="message.todoCard">{{ todoSummary(message) }}</em>
                    <i aria-hidden="true"></i>
                  </div>

                  <div v-if="displayTodoSteps(message).length || message.reasoning" class="thinking-box">
                    <ul v-if="displayTodoSteps(message).length">
                      <li v-for="step in displayTodoSteps(message)" :key="step.id" :class="step.status">
                        <CheckCircleIcon v-if="step.status === 'completed'" />
                        <LoadingIcon v-else-if="step.status === 'in_progress'" />
                        <CircleIcon v-else />
                        <span>{{ step.text }}</span>
                      </li>
                    </ul>
                    <div
                      v-if="message.reasoning"
                      :class="['reasoning-inline', { active: activeStepId(message) }]"
                      v-html="renderMarkdown(message.reasoning)"
                    ></div>
                  </div>

                  <footer v-if="!message.isStreaming && todoSteps(message).length" class="done-line">
                    已完成 {{ completedCount(message) }}/{{ todoSteps(message).length }} 步，{{ todoSummary(message) }}
                  </footer>
                </section>
                <div v-if="message.content" class="assistant-answer" v-html="renderMarkdown(message.content)"></div>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div v-if="messages.length" class="composer docked-composer">
        <textarea
          v-model="inputValue"
          rows="2"
          :placeholder="`继续和 ${selectedAgent.title} 对话`"
          @keydown.enter.exact.prevent="sendMessage"
        />
        <div class="composer-footer">
          <div class="composer-tools">
            <div class="agent-chip">
              <component :is="selectedAgent.icon" />
              {{ selectedAgent.title }}
            </div>
            <button type="button" class="scope-chip" @click="showScopePanel = !showScopePanel">
              <DataSearchIcon />
              {{ scopeLabel }}
            </button>
          </div>
          <button type="button" class="send-button" :disabled="isLoading || !inputValue.trim()" @click="sendMessage">
            <ArrowUpIcon />
          </button>
        </div>
        <div v-if="showScopePanel" class="scope-panel docked-scope-panel">
          <div v-if="selectedScopeBadges.length" class="scope-panel-selected">
            <span v-for="badge in selectedScopeBadges" :key="badge.key" class="selected-chip">
              {{ badge.text }}
              <button type="button" aria-label="移除" @click.stop="removeSelectedScopeBadge(badge)">
                <CloseIcon />
              </button>
            </span>
          </div>
          <div class="scope-row internet-row">
            <div class="scope-title">
              <InternetIcon />
              <strong>互联网搜索</strong>
            </div>
            <label class="switch-control">
              <input v-model="internetSearchEnabled" type="checkbox" />
              <span></span>
              开启
            </label>
          </div>
          <div v-for="group in scopeGroups" :key="group.id" class="scope-row">
            <div class="scope-title">
              <BookOpenIcon />
              <strong>{{ group.title }}</strong>
            </div>
            <div class="scope-check-grid">
              <label class="check-item all-item">
                <input
                  type="checkbox"
                  :checked="isScopeGroupAllSelected(group)"
                  @change="toggleScopeGroup(group)"
                />
                <span>全部</span>
              </label>
              <label v-for="library in group.libraries" :key="library.id" class="check-item">
                <input
                  type="checkbox"
                  :checked="selectedScopeIds.includes(library.id)"
                  @change="toggleScopeLibrary(library.id)"
                />
                <span>{{ library.name }}</span>
              </label>
            </div>
          </div>
          <button type="button" class="precise-button" @click="openPreciseScope">
            <DataSearchIcon />
            进入精准搜索筛选
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </main>

    <div v-if="showPreciseScope" class="scope-modal-backdrop">
      <section class="scope-modal">
        <header class="scope-modal-header">
          <h2>养老险GPT资料范围</h2>
          <button type="button" aria-label="关闭" @click="showPreciseScope = false">
            <CloseIcon />
          </button>
        </header>
        <div class="scope-modal-body">
          <aside class="scope-library-sidebar">
            <button type="button" class="internet-sidebar" :class="{ active: internetSearchEnabled }" @click="internetSearchEnabled = !internetSearchEnabled">
              <InternetIcon />
              <span>互联网搜索</span>
              <em>{{ internetSearchEnabled ? '开启' : '关闭' }}</em>
            </button>
            <div v-for="group in scopeGroups" :key="group.id" class="library-group">
              <div class="library-group-title">{{ group.title }}</div>
              <div v-for="library in group.libraries" :key="library.id" class="library-tree">
                <button
                  type="button"
                  :class="['library-row', { active: activeScopeLibrary.id === library.id }]"
                  @click="activeScopeLibraryId = library.id; scopeSearchKeyword = ''"
                >
                  <BookOpenIcon />
                  <span>{{ library.name }}</span>
                </button>
                <div v-if="selectedScopeIds.includes(library.id) || activeScopeLibrary.id === library.id" class="library-tag-tree">
                  <label class="tree-check all-tag">
                    <input
                      type="checkbox"
                      :checked="isLibraryAllTagsSelected(library)"
                      @change="toggleLibraryAllTags(library)"
                    />
                    <span>全部</span>
                  </label>
                  <div v-for="tag in library.tags" :key="tag.id" class="tree-node">
                    <label class="tree-check">
                      <input type="checkbox" :checked="selectedTagIds.includes(tag.id)" @change="toggleTag(tag.id)" />
                      <span>{{ tag.name }}</span>
                    </label>
                    <div v-if="tag.children?.length" class="tree-children">
                      <label v-for="child in tag.children" :key="child.id" class="tree-check child">
                        <input type="checkbox" :checked="selectedTagIds.includes(child.id)" @change="toggleTag(child.id)" />
                        <span>{{ child.name }}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
          <main class="scope-detail">
            <div class="scope-searchbar">
              <SearchIcon />
              <input v-model="scopeSearchKeyword" :placeholder="`搜索 ${activeScopeLibrary.name} 的标签和文件`" />
            </div>
            <section class="scope-detail-section">
              <h3>文件</h3>
              <div class="file-list">
                <label v-for="file in filteredActiveScopeFiles" :key="file.id" class="file-item">
                  <input type="checkbox" :checked="selectedFileIds.includes(file.id)" @change="toggleFile(file.id)" />
                  <FileIcon />
                  <span>{{ file.name }}</span>
                </label>
                <div v-if="filteredActiveScopeFiles.length === 0" class="file-empty">当前标签下暂无匹配文件</div>
              </div>
            </section>
          </main>
        </div>
        <footer class="scope-modal-footer">
          <div class="selected-scope-tags">
            <span v-for="badge in selectedScopeBadges" :key="badge.key" class="selected-chip">
              {{ badge.text }}
              <button type="button" aria-label="移除" @click.stop="removeSelectedScopeBadge(badge)">
                <CloseIcon />
              </button>
            </span>
          </div>
          <div class="scope-modal-actions">
            <button type="button" class="ghost-button" @click="clearScope">清空</button>
            <button type="button" class="primary-button" @click="applyPreciseScope">确认</button>
          </div>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.chat-shell {
  height: calc(100vh - 50px);
  display: grid;
  grid-template-columns: clamp(240px, 16vw, 292px) minmax(0, 1fr);
  overflow: hidden;
  background: #f3f5f8;
}

.workbench-panel {
  padding: 10px 8px 10px 10px;
  overflow: hidden;
}

.workbench-card {
  height: 100%;
  padding: 14px;
  border: 1px solid #e1e7f2;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 14px 28px rgba(20, 34, 70, 0.06);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.new-chat-button {
  width: 100%;
  height: 38px;
  padding: 0 13px;
  border: 0;
  border-radius: 7px;
  color: #ffffff;
  background: linear-gradient(105deg, #3f7cff 0%, #7158ff 55%, #a943f4 100%);
  box-shadow: 0 10px 20px rgba(79, 98, 244, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 900;
  transition:
    filter 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.new-chat-button svg {
  width: 18px;
  height: 18px;
  transition: transform 0.18s ease;
}

.new-chat-button:hover {
  filter: brightness(1.04) saturate(1.08);
  box-shadow: 0 12px 24px rgba(79, 98, 244, 0.28);
  transform: translateY(-1px);
}

.new-chat-button:hover svg {
  transform: scale(1.08) rotate(-3deg);
}

.new-chat-button:active {
  box-shadow: 0 7px 14px rgba(79, 98, 244, 0.2);
  transform: translateY(0);
}

.history-list button,
.ability-card {
  border: 0;
  background: transparent;
}

.history-list {
  min-height: 0;
  margin-top: 4px;
  padding-top: 16px;
  border-top: 1px solid #eef1f6;
  display: grid;
  gap: 4px;
  overflow: auto;
}

.history-title {
  color: #7b8497;
  font-size: 13px;
  font-weight: 800;
}

.history-list button {
  min-width: 0;
  padding: 7px 8px;
  border-radius: 6px;
  color: #697386;
  font-size: 13px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.history-list button::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 3px;
  background: linear-gradient(180deg, #3f7cff, #8a54ff);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.history-list button:hover {
  color: #263145;
  background: #f3f7ff;
  transform: translateX(2px);
}

.history-list button:hover::before {
  opacity: 1;
}

.skill-market-button {
  flex-shrink: 0;
  width: 100%;
  height: 42px;
  margin-top: auto;
  padding: 0 10px 0 14px;
  border: 1px solid #e2e7f0;
  border-radius: 7px;
  color: #1f2430;
  background: #fafbfe;
  box-shadow: 0 8px 18px rgba(20, 34, 70, 0.04);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  text-align: left;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.skill-market-button strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 900;
}

.skill-market-button svg {
  width: 18px;
  height: 18px;
  color: #8b93a3;
  transition: transform 0.18s ease, color 0.18s ease;
}

.skill-spark {
  color: transparent;
  background: linear-gradient(135deg, #3f7cff 0%, #8a54ff 52%, #b64af7 100%);
  background-clip: text;
  -webkit-background-clip: text;
  filter: drop-shadow(0 3px 6px rgba(91, 111, 255, 0.22));
  font-size: 19px;
  line-height: 1;
}

.skill-market-button:hover {
  border-color: #cbd8ff;
  background: #f5f8ff;
  box-shadow: 0 10px 22px rgba(65, 104, 255, 0.12);
  transform: translateY(-1px);
}

.skill-market-button:hover svg {
  color: #5c6cff;
  transform: translateX(2px);
}

.chat-main {
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: clamp(10px, 1.8vw, 28px) clamp(18px, 5vw, 86px);
}

.empty-state {
  width: min(1088px, 100%);
  margin: 0 auto;
  padding-top: clamp(0px, 1.5vh, 18px);
  color: #1d2433;
}

.empty-state h1 {
  margin: 16px 0 8px;
  text-align: center;
  color: #1e2432;
  font-size: clamp(21px, 1.55vw, 27px);
  line-height: 1.2;
}

.pai-arrow {
  position: relative;
  top: 3px;
  display: inline-block;
  width: 30px;
  height: 30px;
  margin-left: 4px;
}

.pai-arrow::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 4px;
  width: 15px;
  height: 25px;
  background: linear-gradient(180deg, #ff9b40 0%, #ff5c86 47%, #745cff 100%);
  clip-path: polygon(50% 0, 92% 36%, 68% 36%, 68% 100%, 32% 100%, 32% 36%, 8% 36%);
  transform: rotate(34deg);
  transform-origin: 50% 58%;
  filter: drop-shadow(0 7px 10px rgba(116, 92, 255, 0.22));
}

.pai-arrow::after {
  content: '';
  position: absolute;
  right: 1px;
  top: 2px;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 26px 2px, #ffd65a 0 2.2px, transparent 3px),
    radial-gradient(circle at 28px 19px, #ffdf78 0 1.8px, transparent 2.6px),
    radial-gradient(circle at 5px 26px, rgba(255, 210, 92, 0.7) 0 1.8px, transparent 2.6px);
}

.empty-state p {
  margin: 0 0 16px;
  text-align: center;
  color: #6a7280;
  font-size: 13px;
}

.composer {
  position: relative;
  border: 1.5px solid #426cff;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 16px 34px rgba(46, 88, 220, 0.1);
}

.hero-composer {
  width: min(760px, 100%);
  margin: 0 auto 12px;
}

.composer textarea {
  width: 100%;
  resize: none;
  border: 0;
  outline: 0;
  padding: 13px 16px 4px;
  color: #222938;
  background: transparent;
  font-size: 13px;
  line-height: 1.45;
}

.hero-composer textarea {
  height: 78px;
}

.composer textarea::placeholder {
  color: #a7adba;
}

.composer-footer {
  padding: 0 10px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.composer-tools {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.agent-chip {
  max-width: 70%;
  height: 26px;
  padding: 0 9px;
  border-radius: 16px;
  color: #3864ef;
  background: #eef3ff;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
}

.agent-chip svg {
  width: 14px;
  height: 14px;
}

.scope-chip {
  height: 26px;
  padding: 0 9px;
  border: 0;
  border-radius: 16px;
  color: #6d5aa8;
  background: #f0eef7;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.scope-chip svg {
  width: 14px;
  height: 14px;
}

.scope-chip:hover {
  color: #584791;
  background: #e7e2f3;
  transform: translateY(-1px);
}

.scope-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  z-index: 30;
  padding: 14px 16px;
  border: 1px solid #dfe6f2;
  border-radius: 9px;
  background: #ffffff;
  box-shadow: 0 18px 46px rgba(20, 34, 70, 0.22), 0 2px 8px rgba(20, 34, 70, 0.08);
  display: grid;
  gap: 0;
}

.docked-scope-panel {
  top: auto;
  bottom: calc(100% + 8px);
}

.scope-panel-selected {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f3f6ff;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.scope-panel-selected span {
  max-width: 190px;
  padding: 4px 8px;
  border-radius: 5px;
  color: #3864ef;
  background: #e3edff;
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 8px 0;
}

.scope-row + .scope-row {
  margin-top: 3px;
  padding-top: 13px;
  border-top: 1px solid #eef1f6;
}

.internet-row {
  align-items: center;
}

.scope-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #1f2533;
}

.scope-title svg {
  width: 16px;
  height: 16px;
  color: #4168ff;
}

.scope-title strong {
  font-size: 13px;
  font-weight: 900;
}

.scope-check-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px 24px;
}

.check-item {
  flex: 0 0 150px;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #303746;
  font-size: 13px;
  line-height: 1.4;
}

.all-item {
  flex-basis: 86px;
  font-weight: 900;
  color: #263145;
}

.check-item input,
.file-item input {
  width: 14px;
  height: 14px;
  accent-color: #4168ff;
}

.check-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switch-control {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #303746;
  font-size: 13px;
  font-weight: 800;
}

.switch-control input {
  position: absolute;
  opacity: 0;
}

.switch-control span {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 14px;
  background: #cfd5df;
  transition: background 0.18s ease;
}

.switch-control span::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  transition: transform 0.18s ease;
}

.switch-control input:checked + span {
  background: #4168ff;
}

.switch-control input:checked + span::after {
  transform: translateX(16px);
}

.precise-button {
  justify-self: center;
  height: 36px;
  min-width: 250px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  color: #4a63f0;
  background: linear-gradient(90deg, #eef5ff 0%, #f0ecff 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 900;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.precise-button svg {
  width: 16px;
  height: 16px;
}

.precise-button:hover {
  box-shadow: 0 10px 22px rgba(74, 99, 240, 0.14);
  transform: translateY(-1px);
}

.send-button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  color: #ffffff;
  background: #3f66f4;
  display: grid;
  place-items: center;
  box-shadow: 0 8px 18px rgba(63, 102, 244, 0.24);
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.send-button:disabled {
  cursor: not-allowed;
  color: #ffffff;
  background: #d9d9d9;
  box-shadow: none;
}

.send-button:not(:disabled):hover {
  background: #315beb;
  box-shadow: 0 10px 22px rgba(49, 91, 235, 0.3);
  transform: translateY(-1px);
}

.send-button:not(:disabled):active {
  transform: translateY(0);
  box-shadow: 0 6px 14px rgba(49, 91, 235, 0.22);
}

.send-button svg {
  width: 19px;
  height: 19px;
  stroke-width: 2.4;
}

.ability-layout {
  width: min(760px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(230px, 0.88fr);
  gap: 10px;
}

.ability-panel {
  padding: 10px;
  border: 1px solid #e4e9f2;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
}

.ability-panel header {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1d2433;
  font-size: 13px;
}

.ability-panel header svg {
  width: 16px;
  height: 16px;
  color: #4168ff;
}

.ability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ability-grid.single {
  grid-template-columns: 1fr;
}

.ability-card {
  min-height: 64px;
  padding: 10px;
  border-radius: 7px;
  color: #1f2635;
  background: #ffffff;
  text-align: left;
  box-shadow: inset 0 0 0 1px #edf1f8;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.ability-card {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 4px 7px;
  align-items: start;
}

.ability-card svg {
  width: 18px;
  height: 18px;
  color: #5c6cff;
  transition: color 0.18s ease, transform 0.18s ease;
}

.ability-card strong {
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ability-card span {
  grid-column: 1 / -1;
  color: #9098a7;
  font-size: 11px;
  line-height: 1.4;
  transition: color 0.18s ease;
}

.ability-card:hover {
  color: #245cff;
  background: #f1f6ff;
  box-shadow: inset 0 0 0 1px #d8e4ff, 0 10px 18px rgba(65, 104, 255, 0.08);
  transform: translateY(-1px);
}

.ability-card:hover svg {
  color: #3868ff;
  transform: scale(1.05);
}

.ability-card:hover span {
  color: #627089;
}

.conversation-view {
  min-height: 100%;
  padding-bottom: 18px;
}

.conversation-title {
  min-height: 34px;
  margin: 0 auto 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: #171d2b;
}

.conversation-title strong {
  max-width: min(760px, 72vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
  font-weight: 900;
}

.task-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #ffffff;
  background: linear-gradient(135deg, #2f72ff, #8c5cff);
  display: grid;
  place-items: center;
}

.task-icon svg {
  width: 15px;
  height: 15px;
}

.message-list {
  width: min(100%, 1240px);
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.message {
  display: flex;
}

.message.user {
  justify-content: flex-end;
}

.user-message-wrap {
  max-width: min(760px, 72%);
  display: grid;
  justify-items: end;
  gap: 8px;
}

.user-bubble {
  padding: 12px 16px;
  border-radius: 6px;
  color: #1f2937;
  background: #d8eaff;
  font-size: 15px;
  line-height: 1.55;
  box-shadow: 0 1px 0 rgba(23, 52, 92, 0.04);
}

.assistant-stack {
  width: 100%;
  display: grid;
  gap: 0;
}

.process-card {
  width: 100%;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #edf1f8;
  box-shadow: 0 6px 16px rgba(20, 34, 70, 0.035);
  overflow: hidden;
}

.agent-entered {
  height: 40px;
  padding: 0 14px;
  border-bottom: 1px solid #eef1f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #757d8c;
  font-size: 13px;
}

.agent-entered div {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.agent-entered strong {
  color: #5668f6;
  font-weight: 900;
}

.agent-entered em {
  color: #9299a6;
  font-size: 12px;
  font-style: normal;
}

.spark {
  color: #765cff;
  font-size: 16px;
}

.thinking-title {
  padding: 10px 14px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #242a36;
  font-size: 13px;
  font-weight: 700;
}

.thinking-title span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thinking-title em {
  margin-left: auto;
  color: #3864ef;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
  flex: 0 0 auto;
}

.thinking-title i {
  width: 8px;
  height: 8px;
  border-top: 2px solid #7e8795;
  border-left: 2px solid #7e8795;
  transform: rotate(45deg) translateY(2px);
}

.thinking-box {
  margin: 0 14px;
  padding: 10px 12px;
  border-left: 3px solid #e4e8f0;
  border-radius: 7px;
  background: #fafbfe;
}

.thinking-box ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.thinking-box li {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: #9298a4;
  font-size: 13px;
  line-height: 1.4;
}

.thinking-box li svg {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  margin-top: 2px;
}

.thinking-box li.completed svg {
  color: #40aa68;
}

.thinking-box li.in_progress {
  color: #2460db;
  font-weight: 800;
}

.thinking-box li.in_progress svg {
  color: #2460db;
  animation: spin 1s linear infinite;
}

.reasoning-inline {
  max-height: 128px;
  margin: 9px 0 0 21px;
  padding: 8px 10px;
  overflow-y: auto;
  border-radius: 6px;
  border-left: 2px solid #c8d5f6;
  background: #ffffff;
  color: #8a909b;
  font-size: 12px;
  line-height: 1.55;
}

.reasoning-inline :deep(p) {
  margin: 4px 0;
}

.reasoning-inline :deep(h1),
.reasoning-inline :deep(h2),
.reasoning-inline :deep(h3),
.reasoning-inline :deep(h4) {
  margin: 8px 0 4px;
  color: #7c8491;
  font-size: 13px;
  font-weight: 800;
}

.reasoning-inline :deep(ul),
.reasoning-inline :deep(ol) {
  margin: 4px 0;
  padding-left: 18px;
}

.reasoning-inline :deep(code) {
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(74, 91, 130, 0.08);
}

.done-line {
  min-height: 32px;
  margin-top: 0;
  padding: 7px 14px 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: #386cff;
  background: #ffffff;
  font-size: 13px;
}

.done-line {
  color: #6f7785;
  font-size: 13px;
}

.assistant-answer {
  margin-top: 10px;
  padding: 14px 16px;
  border-radius: 8px;
  color: #252b38;
  background: #ffffff;
  font-size: 14px;
  line-height: 1.75;
  box-shadow: 0 8px 20px rgba(20, 34, 70, 0.04);
}

.assistant-answer :deep(p) {
  margin: 8px 0;
}

.assistant-answer :deep(h1),
.assistant-answer :deep(h2),
.assistant-answer :deep(h3),
.assistant-answer :deep(h4) {
  margin: 14px 0 8px;
  color: #1f2635;
  font-weight: 900;
  line-height: 1.35;
}

.assistant-answer :deep(h1) { font-size: 22px; }
.assistant-answer :deep(h2) { font-size: 18px; }
.assistant-answer :deep(h3) { font-size: 16px; }
.assistant-answer :deep(h4) { font-size: 15px; }

.assistant-answer :deep(ul),
.assistant-answer :deep(ol) {
  margin: 8px 0;
  padding-left: 22px;
}

.assistant-answer :deep(li) {
  margin: 4px 0;
}

.assistant-answer :deep(strong) {
  color: #1f2635;
  font-weight: 900;
}

.assistant-answer :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: #f1f4fa;
  color: #4552b8;
  font-size: 0.92em;
}

.assistant-answer :deep(pre) {
  margin: 10px 0;
  padding: 12px;
  overflow-x: auto;
  border-radius: 7px;
  background: #f6f8fc;
}

.assistant-answer :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.assistant-answer :deep(table) {
  width: 100%;
  margin: 10px 0;
  border-collapse: collapse;
  font-size: 13px;
}

.assistant-answer :deep(th),
.assistant-answer :deep(td) {
  padding: 7px 9px;
  border: 1px solid #e4e9f2;
  text-align: left;
}

.assistant-answer :deep(th) {
  background: #f6f8fc;
  font-weight: 800;
}

.docked-composer {
  flex-shrink: 0;
  width: min(900px, calc(100% - 36px));
  margin: 0 auto 14px;
}

.scope-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  padding: 28px;
  background: rgba(17, 24, 39, 0.28);
  display: grid;
  place-items: center;
}

.scope-modal {
  width: min(1120px, 100%);
  height: min(760px, calc(100vh - 56px));
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 28px 70px rgba(17, 24, 39, 0.22);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}

.scope-modal-header {
  height: 68px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.scope-modal-header h2 {
  margin: 0;
  color: #1b1f2a;
  font-size: 22px;
  font-weight: 900;
}

.scope-modal-header button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  color: #6d7482;
  background: transparent;
  display: grid;
  place-items: center;
}

.scope-modal-header button:hover {
  background: #f3f5f8;
}

.scope-modal-header svg {
  width: 22px;
  height: 22px;
}

.scope-modal-body {
  min-height: 0;
  padding: 0 22px 18px;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 24px;
}

.scope-library-sidebar {
  min-height: 0;
  padding: 10px;
  border-radius: 8px;
  background: #f7f9fc;
  overflow: auto;
}

.internet-sidebar,
.library-row {
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  display: grid;
  align-items: center;
  text-align: left;
}

.internet-sidebar {
  height: 42px;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 8px;
  padding: 0 10px;
  color: #1f2533;
  font-size: 14px;
  font-weight: 900;
}

.internet-sidebar.active,
.library-row.active {
  color: #3864ef;
  background: #e8f1ff;
}

.internet-sidebar svg,
.library-row svg {
  width: 18px;
  height: 18px;
}

.internet-sidebar em {
  color: #6d7482;
  font-size: 12px;
  font-style: normal;
}

.library-group {
  margin-top: 10px;
}

.library-group-title {
  padding: 8px 10px 6px;
  color: #7b8493;
  font-size: 12px;
  font-weight: 900;
}

.library-row {
  height: 38px;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 8px;
  padding: 0 10px;
  color: #303746;
  font-size: 13px;
  font-weight: 800;
}

.library-tree + .library-tree {
  margin-top: 4px;
}

.library-row:hover {
  background: #eef3ff;
}

.library-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-tag-tree {
  margin: 4px 0 8px 28px;
  padding-left: 10px;
  border-left: 1px solid #e6ebf4;
  display: grid;
  gap: 6px;
}

.tree-check {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #303746;
  font-size: 12px;
  line-height: 1.35;
}

.tree-check input {
  width: 14px;
  height: 14px;
  accent-color: #4168ff;
}

.tree-check span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-check.all-tag {
  color: #2f57db;
  font-weight: 900;
}

.tree-children {
  margin: 5px 0 2px 21px;
  display: grid;
  gap: 5px;
}

.tree-check.child {
  color: #6d7482;
}

.scope-detail {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 16px;
}

.scope-searchbar {
  height: 42px;
  padding: 0 12px;
  border-radius: 6px;
  background: #f3f5f8;
  display: flex;
  align-items: center;
  gap: 8px;
}

.scope-searchbar svg {
  width: 18px;
  height: 18px;
  color: #7b8493;
}

.scope-searchbar input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #242b3a;
  background: transparent;
  font-size: 14px;
}

.scope-detail-section {
  min-height: 0;
  border: 1px solid #edf1f8;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.scope-detail-section h3 {
  margin: 0;
  padding: 12px 14px;
  color: #1f2533;
  background: #fafbfe;
  font-size: 14px;
  font-weight: 900;
}

.file-list {
  padding: 12px 14px;
  display: grid;
  gap: 10px;
}

.selected-tag-summary {
  min-height: 70px;
  padding: 14px;
  color: #7b8493;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.check-item.large {
  font-weight: 900;
}

.file-item {
  min-width: 0;
  height: 34px;
  display: grid;
  grid-template-columns: auto 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: #303746;
  font-size: 14px;
}

.file-item svg {
  width: 17px;
  height: 17px;
  color: #5c6cff;
}

.file-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-empty {
  padding: 8px 2px 4px;
  color: #8b94a6;
  font-size: 13px;
}

.scope-modal-footer {
  min-height: 72px;
  padding: 14px 22px;
  border-top: 1px solid #edf1f8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.selected-scope-tags {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.selected-scope-tags span {
  max-width: 180px;
  padding: 6px 9px;
  border-radius: 5px;
  color: #3864ef;
  background: #e8f1ff;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-panel-selected .selected-chip,
.selected-scope-tags .selected-chip {
  max-width: 240px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  overflow: visible;
}

.selected-chip button {
  width: 14px;
  height: 14px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #7b8498;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  cursor: pointer;
  transition: color 0.16s ease, background 0.16s ease;
}

.selected-chip button:hover {
  color: #3864ef;
  background: rgba(56, 100, 239, 0.12);
}

.selected-chip button svg {
  width: 11px;
  height: 11px;
}

.scope-modal-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.ghost-button,
.primary-button {
  min-width: 92px;
  height: 38px;
  border: 0;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 900;
}

.ghost-button {
  color: #586174;
  background: #f3f5f8;
}

.primary-button {
  color: #ffffff;
  background: #4168ff;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .chat-shell {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .ability-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .chat-shell {
    display: flex;
    flex-direction: column;
  }

  .workbench-panel {
    height: auto;
    padding-bottom: 0;
  }

  .workbench-card {
    height: auto;
  }

  .history-list {
    display: none;
  }

  .chat-body {
    padding: 16px;
  }

  .empty-state {
    padding-top: 10px;
  }

  .empty-state h1 {
    margin-top: 20px;
  }

  .execution-card header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
