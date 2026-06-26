import { useCallback, useState } from "react";
import type { MeetingMatch } from "../api/client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  meetings?: MeetingMatch[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}

const STORAGE_KEY = "mom_rag_sessions";

function loadFromStorage(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(sessions: ChatSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  return first.content.length > 42 ? first.content.slice(0, 42) + "…" : first.content;
}

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>(loadFromStorage);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  const newSession = useCallback((): string => {
    const id = makeId();
    const session: ChatSession = {
      id,
      title: "New search",
      createdAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => {
      const updated = [session, ...prev];
      saveToStorage(updated);
      return updated;
    });
    setActiveId(id);
    return id;
  }, []);

  const updateSession = useCallback((id: string, messages: ChatMessage[]) => {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, messages, title: makeTitle(messages) } : s
      );
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        saveToStorage(updated);
        return updated;
      });
      if (activeId === id) setActiveId(null);
    },
    [activeId]
  );

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  return {
    sessions,
    activeId,
    activeSession,
    newSession,
    updateSession,
    deleteSession,
    selectSession,
  };
}
