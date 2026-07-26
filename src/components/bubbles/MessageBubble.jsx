import React, { useState } from "react";
import ReactMarkdown from "react-markdown";

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status;
  const failed = status === "failed" || status === "error";
  let parsedResults = toolCall.results;
  if (typeof parsedResults === "string") {
    try { parsedResults = JSON.parse(parsedResults); } catch { /* keep raw */ }
  }
  const isFailed = failed || (parsedResults && parsedResults.success === false);
  const proj = toolCall.display_projection || {};
  const hideDetails = proj.hide_details && proj.details_redacted;

  let statusLabel = "Working…";
  if (status === "completed" || status === "success") statusLabel = proj.label || "Done";
  else if (isFailed) statusLabel = proj.error_label || "Couldn't do that";
  else if (proj.active_label) statusLabel = proj.active_label;

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <span aria-hidden="true">{isFailed ? "⚠️" : (status === "completed" || status === "success") ? "✅" : "⏳"}</span>
        <span>{statusLabel}</span>
      </button>
      {!hideDetails && expanded && (
        <div className="mt-1.5 pl-3 border-l border-border space-y-1.5">
          {toolCall.arguments_string && (
            <div>
              <p className="font-medium text-foreground/70">Parameters:</p>
              <pre className="whitespace-pre-wrap break-words text-foreground/60">{toolCall.arguments_string}</pre>
            </div>
          )}
          {parsedResults != null && (
            <div>
              <p className="font-medium text-foreground/70">Result:</p>
              <pre className="whitespace-pre-wrap break-words text-foreground/60">{JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
        {message.content && (isUser
          ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          : <ReactMarkdown className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{message.content}</ReactMarkdown>)}
        {message.tool_calls?.map((tc, i) => <ToolCallDisplay key={i} toolCall={tc} />)}
      </div>
    </div>
  );
}