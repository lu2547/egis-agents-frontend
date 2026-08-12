<template>
  <div class="workspace">
    <header class="topbar">
      <div>
        <div class="eyebrow">EGIS Training Agents</div>
        <h1>智能会议管理</h1>
      </div>
      <div class="top-actions">
        <t-button theme="default" variant="outline" @click="refreshAll">
          <template #icon><RefreshIcon /></template>
          刷新
        </t-button>
        <t-button theme="primary" @click="openBooking()">
          <template #icon><AddIcon /></template>
          预定会议
        </t-button>
      </div>
    </header>

    <main class="layout">
      <aside class="filters">
        <div class="panel-title">筛选</div>
        <label class="field">
          <span>日期</span>
          <input v-model="filters.date" type="date" />
        </label>
        <div class="time-row">
          <label class="field">
            <span>开始</span>
            <input v-model="filters.start_time" type="time" />
          </label>
          <label class="field">
            <span>结束</span>
            <input v-model="filters.end_time" type="time" />
          </label>
        </div>
        <label class="field">
          <span>人数</span>
          <input v-model.number="filters.capacity" min="1" type="number" />
        </label>
        <div class="equipment">
          <span>设备</span>
          <t-checkbox-group v-model="filters.equipment">
            <t-checkbox value="投影">投影</t-checkbox>
            <t-checkbox value="白板">白板</t-checkbox>
            <t-checkbox value="视频会议">视频会议</t-checkbox>
            <t-checkbox value="电话会议">电话会议</t-checkbox>
          </t-checkbox-group>
        </div>
        <t-button block theme="primary" @click="loadRooms">查看会议室</t-button>
      </aside>

      <section class="content">
        <div class="section-head">
          <div>
            <h2>会议室</h2>
            <p>{{ filters.date }} {{ filters.start_time }}-{{ filters.end_time }}</p>
          </div>
          <t-tag theme="primary" variant="light">{{ availableCount }} 间可用</t-tag>
        </div>

        <div class="room-grid">
          <article v-for="room in rooms" :key="room.id" class="room-card">
            <div class="room-top">
              <div>
                <h3>{{ room.name }}</h3>
                <p>{{ room.location }} · {{ room.floor }}</p>
              </div>
              <t-tag :theme="room.available === false ? 'danger' : 'success'" variant="light">
                {{ room.available === false ? '已占用' : '可预定' }}
              </t-tag>
            </div>
            <div class="room-meta">
              <span>{{ room.capacity }} 人</span>
              <span v-for="item in room.equipment" :key="item">{{ item }}</span>
            </div>
            <div v-if="room.conflicts?.length" class="conflict">
              占用：{{ room.conflicts[0].title }} {{ room.conflicts[0].start_time }}-{{ room.conflicts[0].end_time }}
            </div>

            <t-button
              block
              theme="primary"
              :disabled="room.available === false"
              @click="openBooking(room.id)"
            >
              预定
            </t-button>
          </article>
        </div>

        <div class="section-head reservations-head">
          <div>
            <h2>会议预定</h2>
            <p>所有会议安排</p>
          </div>
        </div>

        <div class="reservation-list">
          <article v-for="item in reservations" :key="item.id" class="reservation-row">
            <div class="reservation-time">
              <CalendarIcon />
              <small>{{ item.date }}</small>
              <strong>{{ item.start_time }}-{{ item.end_time }}</strong>
            </div>
            <div class="reservation-main">
              <h3>{{ item.title }}</h3>
              <div class="reservation-id">编号：{{ item.id }}</div>
              <p>{{ item.room_name }} · {{ item.organizer }} · {{ item.attendees?.join('、') || '未填写参会人' }}</p>
            </div>
            <t-tag theme="success" variant="light">已预定</t-tag>
            <t-button
              class="reservation-delete"
              theme="danger"
              variant="text"
              @click="cancelMeeting(item.id)"
            >
              <template #icon><DeleteIcon /></template>
            </t-button>
          </article>
          <div v-if="reservations.length === 0" class="empty-list">暂无会议安排</div>
        </div>
      </section>
    </main>

    <t-dialog
      v-model:visible="bookingVisible"
      header="预定会议"
      width="560px"
      :confirm-loading="submitting"
      @confirm="submitBooking"
    >
      <div class="booking-form">
        <label class="field">
          <span>会议主题</span>
          <input v-model="booking.title" placeholder="例如：产品培训复盘" />
        </label>
        <label class="field">
          <span>会议室</span>
          <select v-model="booking.room_id">
            <option v-for="room in rooms" :key="room.id" :value="room.id">
              {{ room.name }} / {{ room.capacity }} 人
            </option>
          </select>
        </label>
        <div class="time-row">
          <label class="field">
            <span>日期</span>
            <input v-model="booking.date" type="date" />
          </label>
          <label class="field">
            <span>开始</span>
            <input v-model="booking.start_time" type="time" />
          </label>
          <label class="field">
            <span>结束</span>
            <input v-model="booking.end_time" type="time" />
          </label>
        </div>
        <label class="field">
          <span>组织人</span>
          <input v-model="booking.organizer" placeholder="姓名" />
        </label>
        <label class="field">
          <span>参会人</span>
          <input v-model="attendeesText" placeholder="用逗号分隔" />
        </label>
        <label class="field">
          <span>提醒</span>
          <select v-model.number="booking.reminder_minutes">
            <option :value="5">提前 5 分钟</option>
            <option :value="15">提前 15 分钟</option>
            <option :value="30">提前 30 分钟</option>
          </select>
        </label>
      </div>
    </t-dialog>

    <button v-if="!chatOpen" class="chat-fab" @click="chatOpen = true">
      <ChatIcon />
    </button>
    <aside v-else class="chat-panel">
      <header>
        <div>
          <strong>会议智能助手</strong>
          <span></span>
        </div>
        <button @click="chatOpen = false"><CloseIcon /></button>
      </header>
      <div class="quick-actions">
        <button @click="quickAsk('帮我查一下明天上午 9 点到 10 点能容纳 16 人、有投影的会议室')">查会议室</button>
        <button @click="quickAsk('24号有哪些会议')">查预定</button>
        <button @click="quickAsk('帮我取消产品复盘会')">取消会议</button>
      </div>
      <div ref="messageBox" class="messages">
        <div
          v-for="message in chatMessages"
          :key="message.id"
          class="message"
          :class="[message.role, message.kind]"
        >
          <div v-if="message.title" class="message-title">{{ message.title }}</div>
          <div v-if="message.content" class="message-content" v-html="renderMarkdown(message.content)"></div>
          <pre v-if="message.detail" class="message-detail">{{ message.detail }}</pre>
        </div>
      </div>
      <form class="chat-input" @submit.prevent="sendMessage">
        <input v-model="chatDraft" placeholder="查会议室、定会议室、取消会议..." />
        <button :disabled="chatLoading || !chatDraft.trim()">
          <SendIcon />
        </button>
      </form>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  AddIcon,
  CalendarIcon,
  ChatIcon,
  CloseIcon,
  DeleteIcon,
  RefreshIcon,
  SendIcon
} from 'tdesign-icons-vue-next';
import dayjs from 'dayjs';
import {
  cancelReservation,
  createReservation,
  listNotifications,
  listReservations,
  listRooms,
  markNotificationsRead,
  openNotificationStream,
  streamAgentMessage,
  type AgentStreamEvent,
  type MeetingRoom,
  type NotificationPayload,
  type Reservation,
  type ReservationCreate
} from './api';

const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
const filters = reactive({
  date: tomorrow,
  start_time: '09:00',
  end_time: '20:00',
  capacity: 8,
  equipment: [] as string[]
});

const rooms = ref<MeetingRoom[]>([]);
const reservations = ref<Reservation[]>([]);
const bookingVisible = ref(false);
const submitting = ref(false);
const attendeesText = ref('');

const booking = reactive<ReservationCreate>({
  title: '',
  room_id: '',
  date: tomorrow,
  start_time: '09:00',
  end_time: '10:00',
  organizer: '培训管理员',
  attendees: [],
  reminder_minutes: 15
});

const availableCount = computed(() => rooms.value.filter((room) => room.available !== false).length);

async function loadRooms() {
  rooms.value = await listRooms({
    date: filters.date,
    start_time: filters.start_time,
    end_time: filters.end_time,
    capacity: filters.capacity,
    equipment: filters.equipment
  });
  if (!booking.room_id && rooms.value.length) booking.room_id = rooms.value[0].id;
}

async function loadReservations() {
  reservations.value = await listReservations({ status: 'booked' });
}

async function refreshAll() {
  await Promise.all([loadRooms(), loadReservations()]);
}

function openBooking(roomId?: string) {
  booking.title = '';
  booking.room_id = roomId || booking.room_id || rooms.value[0]?.id || '';
  booking.date = filters.date;
  booking.start_time = filters.start_time;
  booking.end_time = filters.end_time;
  booking.organizer = '培训管理员';
  booking.attendees = [];
  booking.reminder_minutes = 15;
  attendeesText.value = '';
  bookingVisible.value = true;
}

async function submitBooking() {
  submitting.value = true;
  try {
    booking.attendees = attendeesText.value
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    await createReservation({ ...booking });
    MessagePlugin.success('预定成功');
    bookingVisible.value = false;
    await refreshAll();
  } catch (error: any) {
    MessagePlugin.error(error?.response?.data?.detail || '预定失败');
  } finally {
    submitting.value = false;
  }
}

async function cancelMeeting(id: string) {
  if (!window.confirm('确认取消这场会议？')) return;
  try {
    await cancelReservation(id, '前端手动取消');
    MessagePlugin.success('已删除');
    await refreshAll();
  } catch (error: any) {
    MessagePlugin.error(error?.response?.data?.detail || '取消失败');
  }
}

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  kind?: 'answer' | 'thinking' | 'tool' | 'error';
  title?: string;
  content: string;
  detail?: string;
};

const chatOpen = ref(false);
const chatDraft = ref('');
const chatLoading = ref(false);
const chatSessionId = ref('');
const chatMessages = ref<ChatMessage[]>([
  { id: 1, role: 'assistant', kind: 'answer', content: '我可以帮你查会议室、定会议室、取消会议和查看会议提醒。' }
]);
const messageBox = ref<HTMLElement>();
let chatMessageSeed = 10;

function quickAsk(text: string) {
  chatDraft.value = text;
  void sendMessage();
}

async function sendMessage() {
  const text = chatDraft.value.trim();
  if (!text || chatLoading.value) return;
  chatDraft.value = '';
  chatMessages.value.push({ id: chatMessageSeed++, role: 'user', content: text });
  const assistantMessage: ChatMessage = {
    id: chatMessageSeed++,
    role: 'assistant',
    kind: 'answer',
    content: ''
  };
  chatMessages.value.push(assistantMessage);
  chatLoading.value = true;
  await scrollMessages();
  try {
    const data = await streamAgentMessage(
      { message: text, session_id: chatSessionId.value },
      {
        onEvent: async (event) => {
          handleAgentStreamEvent(event, assistantMessage);
          await scrollMessages();
        }
      }
    );
    chatSessionId.value = data.session_id;
    if (!assistantMessage.content.trim()) assistantMessage.content = '已处理。';
  } catch (error: any) {
    assistantMessage.kind = 'error';
    assistantMessage.content =
      error?.message || error?.response?.data?.detail || 'Agent 暂时不可用，请确认后端和模型配置已启动。';
  } finally {
    chatLoading.value = false;
    await scrollMessages();
    await refreshAll();
  }
}

function formatStreamDetail(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(value: string) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

function splitMarkdownTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line: string) {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isMarkdownTableRow(line: string) {
  return /^\s*\|.+\|\s*$/.test(line);
}

function renderMarkdownTable(rows: string[]) {
  const header = splitMarkdownTableRow(rows[0]);
  const body = rows.slice(2).map(splitMarkdownTableRow);
  const headHtml = header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join('');
  const bodyHtml = body
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="md-table-wrap"><table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function renderTextMarkdown(value: string) {
  const lines = value.split('\n');
  const chunks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    chunks.push(`<ul>${listItems.join('')}</ul>`);
    listItems = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (
      isMarkdownTableRow(line) &&
      lines[index + 1] &&
      isMarkdownTableSeparator(lines[index + 1])
    ) {
      flushList();
      const tableRows = [line, lines[index + 1]];
      index += 2;
      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        tableRows.push(lines[index]);
        index += 1;
      }
      index -= 1;
      chunks.push(renderMarkdownTable(tableRows));
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      chunks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const list = /^\s*[-*]\s+(.+)$/.exec(line);
    if (list) {
      listItems.push(`<li>${renderInlineMarkdown(list[1])}</li>`);
      continue;
    }

    flushList();
    if (!line.trim()) {
      chunks.push('');
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(line);
    if (quote) {
      chunks.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    chunks.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  flushList();
  return chunks.filter((chunk) => chunk !== '').join('');
}

function renderMarkdown(value: string) {
  const parts: string[] = [];
  const fencePattern = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(value)) !== null) {
    parts.push(renderTextMarkdown(value.slice(lastIndex, match.index)));
    const lang = match[1] ? ` data-lang="${escapeHtml(match[1])}"` : '';
    parts.push(`<pre class="md-code"${lang}><code>${escapeHtml(match[2].trim())}</code></pre>`);
    lastIndex = match.index + match[0].length;
  }

  parts.push(renderTextMarkdown(value.slice(lastIndex)));
  return parts.join('');
}

function handleAgentStreamEvent(event: AgentStreamEvent, assistantMessage: ChatMessage) {
  if (event.session_id) chatSessionId.value = event.session_id;

  switch (event.type) {
    case 'run_finished':
      assistantMessage.content = event.message || assistantMessage.content;
      return;
    case 'run_error':
      assistantMessage.kind = 'error';
      assistantMessage.content = event.error_message || 'Agent 运行失败';
      return;
    case 'text_message_content':
      if (event.content_kind === 'a2ui') return;
      assistantMessage.content += event.delta || '';
      return;
    default:
      return;
  }
}

async function scrollMessages() {
  await nextTick();
  if (messageBox.value) messageBox.value.scrollTop = messageBox.value.scrollHeight;
}

let notificationStream: EventSource | undefined;
const shownNotificationIds = new Set<string>();

function getNotificationReservationId(notification: NotificationPayload) {
  const reservation = notification.data?.reservation;
  if (!reservation || typeof reservation !== 'object') return '';
  return typeof (reservation as Reservation).id === 'string' ? (reservation as Reservation).id : '';
}

async function handleNotification(notification: NotificationPayload) {
  if (shownNotificationIds.has(notification.notification_id)) return;
  shownNotificationIds.add(notification.notification_id);
  const reservationId = getNotificationReservationId(notification);
  if (reservationId) {
    const currentReservations = await listReservations({ status: 'booked' });
    const stillExists = currentReservations.some((item: Reservation) => item.id === reservationId);
    if (!stillExists) {
      await markNotificationsRead([notification.notification_id]);
      return;
    }
  }
  chatOpen.value = true;
  chatMessages.value.push({
    id: chatMessageSeed++,
    role: 'assistant',
    kind: 'answer',
    title: notification.title,
    content: notification.body
  });
  await markNotificationsRead([notification.notification_id]);
  await refreshAll();
  await scrollMessages();
}

async function loadUnreadNotifications() {
  const data = await listNotifications('training-demo-user', true);
  for (const notification of data.notifications.reverse()) {
    await handleNotification(notification);
  }
}

onMounted(async () => {
  await refreshAll();
  notificationStream = openNotificationStream({
    onNotification: handleNotification,
    onConnected: () => {
      void loadUnreadNotifications();
    }
  });
});

onUnmounted(() => {
  notificationStream?.close();
});
</script>

<style scoped>
.workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f3f5f8;
  overflow: hidden;
}

.topbar {
  height: 76px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.eyebrow {
  color: #64748b;
  font-size: 13px;
}

.workspace h1,
.workspace h2,
.workspace h3,
.workspace p {
  margin: 0;
}

.workspace h1 {
  font-size: 22px;
}

.top-actions {
  display: flex;
  gap: 10px;
}

.layout {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr);
  gap: 16px;
  padding: 16px 20px 20px;
  overflow-y: auto;
}

.filters,
.content {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.filters {
  align-self: start;
  position: sticky;
  top: 0;
  padding: 16px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 14px;
}

.field {
  display: grid;
  gap: 7px;
  margin-bottom: 14px;
  color: #475569;
  font-size: 13px;
}

.field input,
.field select,
.chat-input input {
  width: 100%;
  min-height: 36px;
  border: 1px solid #d8dee9;
  border-radius: 6px;
  padding: 0 10px;
  color: #1f2937;
  background: #fff;
}

.time-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.booking-form .time-row {
  grid-template-columns: 1.1fr 1fr 1fr;
}

.equipment {
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
  color: #475569;
  font-size: 13px;
}

.empty-list {
  color: #94a3b8;
  font-size: 13px;
  padding: 14px 0;
}

.content {
  padding: 18px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-head h2 {
  font-size: 19px;
}

.section-head p {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
}

.room-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  display: grid;
  gap: 14px;
  background: #fbfcfe;
}

.room-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.room-top h3,
.reservation-main h3 {
  font-size: 16px;
}

.room-top p,
.reservation-main p {
  margin-top: 5px;
  color: #64748b;
  font-size: 13px;
}

.room-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.room-meta span {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  padding: 0 8px;
  background: #eef7f5;
  color: #0f766e;
  font-size: 12px;
}

.conflict {
  color: #b42318;
  background: #fff1f2;
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
}

.reservations-head {
  margin-top: 28px;
}

.reservation-list {
  display: grid;
  gap: 10px;
}

.reservation-row {
  min-height: 72px;
  display: grid;
  grid-template-columns: 164px 1fr auto 56px;
  align-items: center;
  gap: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.reservation-delete {
  width: 44px;
  height: 44px;
  justify-self: center;
}

.reservation-delete :deep(.t-icon),
.reservation-delete :deep(svg) {
  width: 24px;
  height: 24px;
}

.reservation-time {
  display: grid;
  grid-template-columns: 18px 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  row-gap: 4px;
  align-items: start;
  color: #334155;
}

.reservation-time :deep(.t-icon),
.reservation-time :deep(svg) {
  grid-row: 1 / 3;
  margin-top: 2px;
}

.reservation-time small {
  grid-column: 2;
  color: #64748b;
  font-size: 12px;
}

.reservation-time strong {
  grid-column: 2;
  line-height: 1;
  white-space: nowrap;
}

.reservation-id {
  margin-top: 4px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
}

.booking-form {
  display: grid;
  gap: 2px;
}

.chat-fab {
  position: absolute;
  right: 22px;
  bottom: 22px;
  width: 54px;
  height: 54px;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: #155e75;
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.22);
  cursor: pointer;
  z-index: 10;
}

.chat-fab svg {
  width: 26px;
  height: 26px;
}

.chat-panel {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: min(640px, calc(100% - 32px));
  height: min(680px, calc(100% - 32px));
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  background: #ffffff;
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
  overflow: hidden;
  z-index: 10;
}

.chat-panel header {
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: #0f172a;
  color: #fff;
}

.chat-panel header div {
  display: grid;
  gap: 2px;
}

.chat-panel header span {
  color: #cbd5e1;
  font-size: 12px;
}

.chat-panel header button,
.chat-input button,
.quick-actions button {
  border: none;
  cursor: pointer;
}

.chat-panel header button {
  width: 32px;
  height: 32px;
  color: #fff;
  background: transparent;
}

.quick-actions {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 10px;
  border-bottom: 1px solid #edf0f5;
}

.quick-actions button {
  flex: 0 0 auto;
  border-radius: 6px;
  padding: 6px 10px;
  color: #6b3f00;
  background: #fff7ed;
  font-size: 12px;
}

.messages {
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message {
  max-width: min(86%, 820px);
  border-radius: 8px;
  padding: 10px 12px;
  line-height: 1.5;
  white-space: normal;
  font-size: 14px;
}

.message.user {
  align-self: flex-end;
  color: #fff;
  background: #2563eb;
}

.message.assistant {
  align-self: flex-start;
  color: #1f2937;
  background: #f1f5f9;
}

.message.thinking {
  max-width: 92%;
  color: #374151;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  font-size: 13px;
}

.message.tool {
  max-width: 94%;
  color: #164e63;
  background: #ecfeff;
  border: 1px solid #a5f3fc;
  font-size: 13px;
}

.message.error {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.message-title {
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 700;
}

.message-detail {
  max-height: 220px;
  overflow: auto;
  margin: 6px 0 0;
  padding: 8px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.06);
  color: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.45;
}

.message-content :deep(p) {
  margin: 0 0 8px;
}

.message-content :deep(p:last-child),
.message-content :deep(ul:last-child),
.message-content :deep(blockquote:last-child),
.message-content :deep(.md-code:last-child) {
  margin-bottom: 0;
}

.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3),
.message-content :deep(h4) {
  margin: 0 0 8px;
  font-weight: 700;
  line-height: 1.3;
}

.message-content :deep(h1) {
  font-size: 20px;
}

.message-content :deep(h2) {
  font-size: 18px;
}

.message-content :deep(h3),
.message-content :deep(h4) {
  font-size: 15px;
}

.message-content :deep(ul) {
  margin: 0 0 8px;
  padding-left: 18px;
}

.message-content :deep(li) {
  margin: 3px 0;
}

.message-content :deep(blockquote) {
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 3px solid #94a3b8;
  color: #475569;
}

.message-content :deep(.md-table-wrap) {
  max-width: 100%;
  overflow-x: auto;
  margin: 0 0 10px;
  border: 1px solid #dbe3ee;
  border-radius: 6px;
  background: #ffffff;
}

.message-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  min-width: 520px;
  font-size: 13px;
}

.message-content :deep(th),
.message-content :deep(td) {
  border-bottom: 1px solid #e5e7eb;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}

.message-content :deep(th) {
  color: #334155;
  background: #f8fafc;
  font-weight: 700;
}

.message-content :deep(tr:last-child td) {
  border-bottom: none;
}

.message-content :deep(code) {
  border-radius: 4px;
  padding: 1px 4px;
  background: rgba(15, 23, 42, 0.08);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.message-content :deep(.md-code) {
  max-width: 100%;
  overflow: auto;
  margin: 0 0 8px;
  padding: 10px;
  border-radius: 6px;
  background: #0f172a;
  color: #e5e7eb;
  white-space: pre;
}

.message-content :deep(.md-code code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.message-content :deep(a) {
  color: #0f766e;
  text-decoration: none;
}

.message-content :deep(a:hover) {
  text-decoration: underline;
}

.chat-input {
  display: grid;
  grid-template-columns: 1fr 42px;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #edf0f5;
}

.chat-input button {
  border-radius: 6px;
  color: #fff;
  background: #155e75;
}

.chat-input button:disabled {
  cursor: not-allowed;
  background: #94a3b8;
}

@media (max-width: 920px) {
  .topbar {
    height: auto;
    gap: 14px;
    align-items: flex-start;
    flex-direction: column;
    padding: 18px;
  }

  .layout {
    grid-template-columns: 1fr;
    padding: 14px;
  }

  .filters {
    position: static;
    height: auto;
  }

  .reservation-row {
    grid-template-columns: 1fr auto;
  }

  .reservation-time,
  .reservation-main {
    grid-column: 1 / -1;
  }
}
</style>
