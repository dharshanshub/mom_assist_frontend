import { useEffect, useRef, useState } from "react";
import type { MeetingMatch, ConversationMessage, ExtractedMeeting } from "../api/client";
import { uploadMinutes, indexMeeting } from "../api/client";
import { MeetingCard } from "./MeetingCard";
import { MessageBubble } from "./MessageBubble";
import { DocumentDrawer } from "./DocumentDrawer";
import { ReviewCard } from "./ReviewCard";
import { TypingIndicator } from "./TypingIndicator";
import { useSearch } from "../hooks/useSearch";
import type { ChatMessage } from "../hooks/useChatHistory";

interface Props {
  sessionId: string | null;
  initialMessages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}

type UploadPhase = "idle" | "uploading" | "pending_review" | "indexing" | "indexed";

interface ReviewState {
  meetingId: string;
  blobFilename: string;
  extracted: ExtractedMeeting;
  rawText: string;
  filename: string;
}

const EXAMPLES = [
  { tag: "Decisions",    text: "What decisions were made in last week's planning meeting?" },
  { tag: "Action Items", text: "List all open action items from the Q2 retrospective" },
  { tag: "Projects",     text: "Show me all DEFERRED or ON HOLD projects" },
  { tag: "Budget",       text: "Which initiatives had a budget over 200,000 approved?" },
];

function EmptyHeroIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fdba74"/>
          <stop offset="55%" stopColor="#f97316"/>
          <stop offset="100%" stopColor="#dc2626"/>
        </linearGradient>
      </defs>
      <rect x="2.5"  y="13" width="3.6" height="8"  rx="1.8" fill="url(#heroGrad)" fillOpacity=".75"/>
      <rect x="7.8"  y="8.5" width="3.6" height="12.5" rx="1.8" fill="url(#heroGrad)" fillOpacity=".9"/>
      <rect x="13.1" y="4"  width="3.6" height="17" rx="1.8" fill="url(#heroGrad)"/>
      <circle cx="19.8" cy="6" r="2.3" fill="url(#heroGrad)"/>
      <circle cx="19.8" cy="6" r="4" stroke="url(#heroGrad)" strokeOpacity=".4" strokeWidth="1.1"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}

export function ChatWindow({ sessionId, initialMessages, onMessagesChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [drawerMeeting, setDrawerMeeting] = useState<MeetingMatch | null>(null);

  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const streamStartRef = useRef<HTMLDivElement>(null);
  const wasStreaming = useRef(false);

  const [streamingText, setStreamingText] = useState<string | null>(null);

  const { loading, error, search } = useSearch();

  useEffect(() => {
    setMessages(initialMessages);
    setInput("");
    setStreamingText(null);
    wasStreaming.current = false;
    setUploadPhase("idle");
    setReviewState(null);
    setUploadError(null);
    // Show the latest message when switching into a session.
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ block: "end" }), 0);
  }, [sessionId]);

  useEffect(() => {
    const streamingNow = streamingText !== null;

    if (uploadPhase === "pending_review" && reviewRef.current) {
      // Upload review card → bring its top into view.
      reviewRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (streamingNow && !wasStreaming.current) {
      // Streaming just STARTED → pin the top of the answer to the top of the view.
      // Do not chase the bottom as text grows, and don't jump when meeting cards
      // appear after completion — the user reads from the top and scrolls down.
      streamStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    wasStreaming.current = streamingNow;
  }, [messages, streamingText, uploadPhase]);

  const push = (msgs: ChatMessage[]) => {
    setMessages(msgs);
    onMessagesChange(msgs);
  };

  const chatLocked = uploadPhase !== "idle";

  const run = async (query: string) => {
    const q = query.trim();
    if (!q || loading || chatLocked) return;

    setInput("");
    setStreamingText("");

    const withUser: ChatMessage[] = [...messages, { role: "user", content: q }];
    push(withUser);

    const history: ConversationMessage[] = withUser.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Meeting cards are intentionally withheld until streaming finishes — they
    // are attached to the final pushed message below, not shown live.
    const result = await search(
      q, history,
      (partial) => setStreamingText(partial),
      () => { /* live meetings ignored — shown only after the answer completes */ },
    );

    setStreamingText(null);

    if (result) {
      push([...withUser, {
        role: "assistant",
        content: result.answer,
        meetings: result.meetings.length > 0 ? result.meetings : undefined,
      }]);
    } else {
      push([...withUser, { role: "assistant", content: error ?? "Something went wrong.", isError: true }]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploadError(null);
    setUploadPhase("uploading");

    try {
      const result = await uploadMinutes(file);
      setReviewState({
        meetingId:    result.meeting_id,
        blobFilename: result.blob_filename,
        extracted:    result.extracted,
        rawText:      result.raw_text,
        filename:     file.name,
      });
      setUploadPhase("pending_review");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadPhase("idle");
    }
  };

  const handleApprove = async (meeting: ExtractedMeeting) => {
    if (!reviewState) return;
    setUploadPhase("indexing");

    try {
      await indexMeeting(reviewState.meetingId, reviewState.blobFilename, meeting, reviewState.rawText);
      // Brief success celebration in the widget before handing back to chat.
      setUploadPhase("indexed");
      await new Promise((r) => setTimeout(r, 2100));
      const successMsg: ChatMessage = {
        role: "assistant",
        content: `✅ **Saved to your knowledge base.** ${meeting.projects.length} project${meeting.projects.length !== 1 ? "s" : ""} from the meeting on **${meeting.date}** ${meeting.projects.length !== 1 ? "are" : "is"} now ready to track and search. Ask me anything about this meeting.`,
      };
      push([...messages, successMsg]);
      setReviewState(null);
      setUploadPhase("idle");
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: `Something went wrong while saving to the knowledge base: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        isError: true,
      };
      push([...messages, errMsg]);
      setReviewState(null);
      setUploadPhase("idle");
    }
  };

  const handleDiscard = () => {
    setReviewState(null);
    setUploadPhase("idle");
    setUploadError(null);
  };

  const isEmpty = messages.length === 0 && !loading && streamingText === null && uploadPhase === "idle";
  const isStreaming = streamingText !== null;

  return (
    <div className="chat-pane">

      {/* ── Header band ────────────────────────── */}
      <header className="chat-topbar">
        <div className="chat-topbar-bg" />
        <div className="chat-topbar-line" />
        <div className="chat-topbar-mark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3"  y="13" width="3.2" height="8"  rx="1.6" fill="#fff" fillOpacity=".7"/>
            <rect x="8"  y="9"  width="3.2" height="12" rx="1.6" fill="#fff" fillOpacity=".88"/>
            <rect x="13" y="5"  width="3.2" height="16" rx="1.6" fill="#fff"/>
            <circle cx="19.2" cy="6.4" r="2" fill="#fff"/>
          </svg>
        </div>
        <div className="chat-topbar-title">
          {isEmpty ? (
            <span className="chat-topbar-eyebrow">
              <span className="chat-topbar-pulse" /> New conversation — ask your meetings anything
            </span>
          ) : (() => {
            const t = messages.find((m) => m.role === "user")?.content ?? "";
            return t.length > 72 ? t.slice(0, 72) + "…" : t;
          })()}
        </div>
        <div className="chat-topbar-badges">
          <span className="chat-topbar-badge chat-topbar-badge--ai"><span className="chat-topbar-pulse" /> AI Powered</span>
          <span className="chat-topbar-badge">Smart Search</span>
        </div>
      </header>

      {/* ── Messages ───────────────────────────── */}
      <div className="messages">
        {isEmpty ? (
          <div className="empty-state">
            <div className="empty-hero"><EmptyHeroIcon /></div>
            <div className="empty-eyebrow">AI-Powered Meeting Q&A</div>
            <div className="empty-title">Ask about your meetings</div>
            <div className="empty-subtitle">
              Ask about decisions, action items, or topics from your meeting minutes
              in plain English. Use the <strong>paperclip</strong> button to upload new minutes.
            </div>
            <div className="example-grid">
              {EXAMPLES.map((ex) => (
                <button key={ex.text} className="example-card" onClick={() => run(ex.text)}>
                  <div className="example-tag">{ex.tag}</div>
                  <div className="example-text">{ex.text}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i}>
                <MessageBubble role={msg.role} content={msg.content} isError={msg.isError} />
                {msg.meetings && msg.meetings.length > 0 && (
                  <div className="candidates-section">
                    <div className="candidates-header">
                      <span className="candidates-count">
                        {msg.meetings.length} meeting{msg.meetings.length !== 1 ? "s" : ""} found
                      </span>
                      <div className="candidates-divider" />
                    </div>
                    {msg.meetings.map((m, idx) => (
                      <MeetingCard key={m.id} meeting={m} rank={idx + 1} onViewDocument={setDrawerMeeting} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div ref={streamStartRef}>
                {streamingText === "" ? <TypingIndicator /> : (
                  <MessageBubble role="assistant" content={streamingText} isStreaming />
                )}
              </div>
            )}
          </>
        )}

        {/* Upload states */}
        {uploadPhase === "uploading" && (
          <div className="rv-uploading">
            <span className="rv-spinner" />
            Extracting meeting data from PDF…
          </div>
        )}

        {uploadError && (
          <div className="rv-upload-error">{uploadError}</div>
        )}

        {(uploadPhase === "pending_review" || uploadPhase === "indexing" || uploadPhase === "indexed") && reviewState && (
          <div ref={reviewRef}>
            <ReviewCard
              filename={reviewState.filename}
              extracted={reviewState.extracted}
              onApprove={handleApprove}
              onDiscard={handleDiscard}
              indexing={uploadPhase === "indexing"}
              done={uploadPhase === "indexed"}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ──────────────────────────────── */}
      <div className="input-area">
        {chatLocked && (
          <div className="input-locked-hint">
            Review and approve the uploaded minutes above to continue chatting.
          </div>
        )}
        <form
          className="input-form"
          onSubmit={(e) => { e.preventDefault(); run(input); }}
        >
          {/* hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          {/* attach button */}
          <button
            type="button"
            className="attach-btn"
            title="Upload meeting minutes PDF"
            disabled={chatLocked}
            onClick={() => fileInputRef.current?.click()}
          >
            <AttachIcon />
          </button>

          <input
            className="input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={chatLocked ? "Review the uploaded minutes above first…" : "Ask about meetings, decisions, or action items…"}
            disabled={loading || chatLocked}
            autoFocus={!chatLocked}
          />
          <button
            className="send-btn"
            type="submit"
            disabled={loading || chatLocked || !input.trim()}
            title="Search"
          >
            <SendIcon />
          </button>
        </form>
        {!chatLocked && (
          <div className="input-hint">
            Try: <strong>"What decisions came out of the planning meeting?"</strong> or use{" "}
            <strong>the paperclip</strong> to upload new minutes.
          </div>
        )}
      </div>

      {drawerMeeting && (
        <DocumentDrawer meeting={drawerMeeting} onClose={() => setDrawerMeeting(null)} />
      )}
    </div>
  );
}
