"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

type Message = {
  _id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  _creationTime: number;
};

export function ChatView({
  messages,
  isLoading,
  agentName,
  agentAvatar,
}: {
  messages: Message[] | undefined;
  isLoading: boolean;
  agentName: string;
  agentAvatar: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!messages) {
    return (
      <div className="flex items-center justify-center flex-1 py-12">
        <Loader2 size={22} className="animate-spin text-text-muted/60" />
      </div>
    );
  }

  if (messages.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg._id}
              className={`flex gap-3.5 animate-slide-up ${
                isUser ? "justify-end" : "justify-start"
              }`}
            >
              {/* Agent Avatar */}
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-white/70 border border-black/[0.04] shadow-sm flex items-center justify-center text-base shrink-0 mt-0.5 select-none hover:scale-105 transition-transform duration-200">
                  {agentAvatar}
                </div>
              )}
              
              {/* Bubble */}
              <div
                className={`max-w-[78%] px-4.5 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-accent text-white rounded-2xl rounded-tr-sm shadow-[0_2px_8px_rgba(37,99,235,0.08)]"
                    : "bg-white/85 text-text-primary rounded-2xl rounded-tl-sm border border-black/[0.03] shadow-[0_2px_12px_rgba(0,0,0,0.015)] backdrop-blur-md"
                }`}
              >
                {/* Agent Header */}
                {!isUser && (
                  <div className="text-[10px] font-bold text-text-muted/90 mb-1.5 uppercase tracking-widest border-b border-black/[0.015] pb-1 select-none">
                    {msg.agentName ?? agentName}
                  </div>
                )}
                <div className="whitespace-pre-wrap font-sans text-[13.5px] antialiased">{msg.content}</div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3.5 animate-slide-up">
            <div className="w-8 h-8 rounded-xl bg-white/70 border border-black/[0.04] shadow-sm flex items-center justify-center text-base shrink-0 select-none">
              {agentAvatar}
            </div>
            <div className="bg-white/85 border border-black/[0.03] rounded-2xl rounded-tl-sm px-4.5 py-3.5 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-1.5 h-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent/70 thinking-dot" />
                <div className="w-1.5 h-1.5 rounded-full bg-accent/70 thinking-dot" />
                <div className="w-1.5 h-1.5 rounded-full bg-accent/70 thinking-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
