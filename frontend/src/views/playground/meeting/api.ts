import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 30000
});

export type MeetingRoom = {
    id: string;
    name: string;
    floor: string;
    location: string;
    capacity: number;
    equipment: string[];
    status: string;
    available?: boolean | null;
    conflicts?: Reservation[];
};

export type Reservation = {
    id: string;
    title: string;
    room_id: string;
    room_name: string;
    date: string;
    start_time: string;
    end_time: string;
    organizer: string;
    attendees: string[];
    reminder_minutes: number;
    status: 'booked';
    minutes_left?: number;
    room?: MeetingRoom;
};

export type ReservationCreate = {
    title: string;
    room_id: string;
    date: string;
    start_time: string;
    end_time: string;
    organizer: string;
    attendees: string[];
    reminder_minutes: number;
};

export async function listRooms(params: Record<string, unknown> = {}) {
    const { data } = await api.get<{ rooms: MeetingRoom[] }>('/meeting/rooms', { params });
    return data.rooms;
}

export async function listReservations(params: Record<string, unknown> = {}) {
    const { data } = await api.get<{ reservations: Reservation[] }>('/meeting/reservations', { params });
    return data.reservations;
}

export async function createReservation(payload: ReservationCreate) {
    const { data } = await api.post<{ reservation: Reservation }>('/meeting/reservations', payload);
    return data.reservation;
}

export async function cancelReservation(id: string, reason = '') {
    const { data } = await api.delete<{ reservation: Reservation }>(`/meeting/reservations/${id}`, {
        data: { reason }
    });
    return data.reservation;
}

export async function listReminders(params: Record<string, unknown> = {}) {
    const { data } = await api.get<{ reminders: Reservation[] }>('/meeting/reminders', { params });
    return data.reminders;
}

export type AgentStreamEvent = {
    type: string;
    seq?: number;
    run_id?: string;
    session_id?: string;
    run_content?: string;
    step_name?: string;
    message_id?: string;
    delta?: string;
    turn?: number;
    content_kind?: 'text' | 'a2ui';
    tool_call_id?: string;
    tool_name?: string;
    tool_args?: Record<string, unknown>;
    tool_result?: unknown;
    custom_data?: Record<string, unknown>;
    message?: string;
    tool_calls?: Array<{ name: string; arguments?: Record<string, unknown> }>;
    turns?: number;
    error_message?: string;
};

export type NotificationPayload = {
    notification_id: string;
    user_id: string;
    agent_id: string;
    job_id: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    created_at: number;
    read: boolean;
    priority: 'low' | 'normal' | 'high';
};

export async function listNotifications(userId = 'training-demo-user', unread = true) {
    const { data } = await api.get<{
        notifications: NotificationPayload[];
        total: number;
        unread_count: number;
    }>(`/notifications/meeting_agent/${userId}`, {
        params: { unread, limit: 10 }
    });
    return data;
}

export async function markNotificationsRead(ids: string[], userId = 'training-demo-user') {
    if (!ids.length) return;
    await api.post(`/notifications/meeting_agent/${userId}/read`, { ids });
}

export function openNotificationStream(
    handlers: {
        onNotification: (notification: NotificationPayload) => void;
        onConnected?: (unreadCount: number) => void;
        onError?: () => void;
    },
    userId = 'training-demo-user'
) {
    const source = new EventSource(`/api/notifications/meeting_agent/${userId}/stream`);

    source.onmessage = (event) => {
        const payload = JSON.parse(event.data) as {
            type: string;
            unread_count?: number;
            data?: NotificationPayload;
        };
        if (payload.type === 'connected') {
            handlers.onConnected?.(payload.unread_count || 0);
            return;
        }
        if (payload.type === 'new_notification' && payload.data) {
            handlers.onNotification(payload.data);
        }
    };

    source.onerror = () => {
        handlers.onError?.();
    };

    return source;
}

export async function streamAgentMessage(
    payload: { message: string; session_id?: string },
    handlers: {
        onEvent: (event: AgentStreamEvent) => void | Promise<void>;
        onError?: (message: string) => void | Promise<void>;
    }
) {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream'
        },
        body: JSON.stringify({
            agent_id: 'meeting_agent',
            user_id: 'training-demo-user',
            message: payload.message,
            session_id: payload.session_id || undefined,
            stream: true,
            protocol: 'agui',
            context: {
                'user:run_mode': 'flash',
                run_mode: 'flash',
                'react:run_mode': 'flash',
                'user:display_mode': 'minimal',
                frontend: 'egis-agent-frontend'
            }
        })
    });

    if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `Agent stream failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sessionId = payload.session_id || '';
    let currentEventType = '';

    while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (trimmed.startsWith('event:')) {
                currentEventType = trimmed.slice(6).trim();
                continue;
            }
            if (!trimmed.startsWith('data:')) continue;

            const raw = trimmed.slice(5).trim();
            if (!raw) continue;
            const parsed = JSON.parse(raw) as AgentStreamEvent;
            const data = { ...parsed, type: parsed.type || currentEventType };
            currentEventType = '';
            if (data.session_id) sessionId = data.session_id;
            if (data.type === 'run_error' && handlers.onError) {
                await handlers.onError(data.error_message || 'Agent 运行失败');
            }
            await handlers.onEvent(data);
        }

        if (done) break;
    }

    const tail = buffer.trim();
    if (tail.startsWith('data:')) {
        const parsed = JSON.parse(tail.slice(5).trim()) as AgentStreamEvent;
        const data = { ...parsed, type: parsed.type || currentEventType };
        if (data.session_id) sessionId = data.session_id;
        await handlers.onEvent(data);
    }

    return { session_id: sessionId };
}
