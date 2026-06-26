import { useEffect, useState } from "react";
import { ChatWindow } from "./components/ChatWindow";
import { ProjectDashboardPage } from "./components/ProjectDashboardPage";
import { LoginPage } from "./components/LoginPage";
import { ProjectTrackerPage } from "./components/ProjectTrackerPage";
import { Sidebar } from "./components/Sidebar";
import { useAuth } from "./context/AuthContext";
import { useChatHistory } from "./hooks/useChatHistory";

type View = "chat" | "dashboard" | "tracker";

export default function App() {
  const { isAuthenticated } = useAuth();

  const {
    sessions,
    activeId,
    activeSession,
    newSession,
    updateSession,
    deleteSession,
    selectSession,
  } = useChatHistory();

  const [view, setView] = useState<View>("chat");

  useEffect(() => {
    if (sessions.length === 0) {
      newSession();
    } else if (!activeId) {
      selectSession(sessions[0].id);
    }
  }, []);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleNew = () => {
    newSession();
    setView("chat");
  };

  const handleMessagesChange = (messages: import("./hooks/useChatHistory").ChatMessage[]) => {
    if (activeId) updateSession(activeId, messages);
  };

  return (
    <div className="layout">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        activeView={view}
        onNew={handleNew}
        onSelect={selectSession}
        onDelete={deleteSession}
        onViewChange={setView}
      />
      {view === "dashboard" ? (
        <ProjectDashboardPage />
      ) : view === "tracker" ? (
        <ProjectTrackerPage />
      ) : (
        <ChatWindow
          key={activeId ?? "empty"}
          sessionId={activeId}
          initialMessages={activeSession?.messages ?? []}
          onMessagesChange={handleMessagesChange}
        />
      )}
    </div>
  );
}
