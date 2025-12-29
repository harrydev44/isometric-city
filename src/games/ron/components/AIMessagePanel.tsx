/**
 * Rise of Nations - AI Message Panel
 * 
 * Displays messages from the agentic AI opponent.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AgenticAIMessage } from '../hooks/useAgenticAI';

interface AIMessagePanelProps {
  messages: AgenticAIMessage[];
  isThinking: boolean;
  onMarkRead: (messageId: string) => void;
  onClear: () => void;
}

export function AIMessagePanel({
  messages,
  isThinking,
  onMarkRead,
  onClear,
}: AIMessagePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLatest, setShowLatest] = useState<AgenticAIMessage | null>(null);
  
  const unreadCount = messages.filter(m => !m.isRead).length;

  // Show latest unread message briefly
  useEffect(() => {
    const latestUnread = messages.find(m => !m.isRead);
    if (latestUnread) {
      setShowLatest(latestUnread);
      const timer = setTimeout(() => {
        setShowLatest(null);
        onMarkRead(latestUnread.id);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [messages, onMarkRead]);

  return (
    <>
      {/* Floating notification for latest message */}
      {showLatest && !isExpanded && (
        <div className="fixed top-4 right-4 max-w-sm bg-red-900/90 border border-red-600 rounded-lg p-4 shadow-lg z-50 animate-pulse">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">AI Opponent says:</p>
              <p className="text-red-200 text-sm mt-1">{showLatest.message}</p>
            </div>
            <button
              onClick={() => setShowLatest(null)}
              className="text-red-400 hover:text-red-200 text-lg"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-2 bg-gray-800/90 hover:bg-gray-700/90 border border-gray-600 rounded-lg shadow-lg transition-colors"
      >
        {isThinking && (
          <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
        )}
        <span className="text-white text-sm">AI Messages</span>
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="fixed bottom-16 right-4 w-80 max-h-96 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl z-40 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="text-white font-semibold">AI Communications</h3>
            <div className="flex gap-2">
              {isThinking && (
                <span className="text-yellow-400 text-xs flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  Thinking...
                </span>
              )}
              <button
                onClick={onClear}
                className="text-gray-400 hover:text-white text-xs"
              >
                Clear
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No messages from AI yet
              </p>
            ) : (
              messages.slice().reverse().map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded-lg ${
                    msg.isRead ? 'bg-gray-800' : 'bg-red-900/50 border border-red-600/50'
                  }`}
                  onClick={() => !msg.isRead && onMarkRead(msg.id)}
                >
                  <p className="text-gray-200 text-sm">{msg.message}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AIMessagePanel;
