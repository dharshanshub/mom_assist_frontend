import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "../context/ToastContext";

interface Props {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  /** True while this message is still being streamed (shows cursor). */
  isStreaming?: boolean;
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function MessageBubble({ role, content, isError, isStreaming }: Props) {
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast("Copied to clipboard");
    } catch {
      toast("Couldn't copy — clipboard unavailable", "error");
    }
  };

  return (
    <div className={`message-row ${role}`}>
      {role === "user" ? (
        <div className="bubble-user">{content}</div>
      ) : (
        <div className={`bubble-assistant${isError ? " error" : ""}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          {isStreaming && <span className="streaming-cursor" aria-hidden />}
          {!isStreaming && !isError && (
            <button className="bubble-copy-btn" onClick={handleCopy} title="Copy response">
              <CopyIcon />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
