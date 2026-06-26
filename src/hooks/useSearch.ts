import { useCallback, useState } from "react";
import {
  searchMeetingsStream,
  type MeetingMatch,
  type ConversationMessage,
} from "../api/client";

export interface StreamSearchResult {
  meetings: MeetingMatch[];
  answer: string;
}

interface UseSearchReturn {
  loading: boolean;
  error: string | null;
  search: (
    query: string,
    history: ConversationMessage[],
    onDelta: (partial: string) => void,
    onLiveMeetings?: (meetings: MeetingMatch[]) => void,
    topK?: number,
  ) => Promise<StreamSearchResult | null>;
}

export function useSearch(): UseSearchReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (
      query: string,
      history: ConversationMessage[],
      onDelta: (partial: string) => void,
      onLiveMeetings?: (meetings: MeetingMatch[]) => void,
      topK?: number,
    ): Promise<StreamSearchResult | null> => {
      setLoading(true);
      setError(null);

      let meetings: MeetingMatch[] = [];
      let answer = "";
      let errorMsg: string | null = null;

      await searchMeetingsStream(
        query,
        history,
        {
          onMeetings: (m) => {
            meetings = m;
            onLiveMeetings?.(m);
          },
          onDelta: (text) => {
            answer += text;
            onDelta(answer);
          },
          onDone: () => {},
          onError: (msg) => { errorMsg = msg; },
        },
        topK,
      );

      setLoading(false);

      if (errorMsg) {
        setError(errorMsg);
        return null;
      }

      return { meetings, answer };
    },
    [],
  );

  return { loading, error, search };
}
