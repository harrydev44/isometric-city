'use client';

/**
 * Human Chat - Real-time chat for viewers using Supabase
 * Random usernames assigned to all users
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, SESSION_ID } from '@/lib/civilization/civilizationDatabase';

// Fun random username generators
const ADJECTIVES = [
  'Swift', 'Brave', 'Clever', 'Wild', 'Mystic', 'Silent', 'Bold', 'Fierce',
  'Noble', 'Lucky', 'Cosmic', 'Epic', 'Hyper', 'Mega', 'Ultra', 'Super',
  'Ancient', 'Crystal', 'Shadow', 'Golden', 'Silver', 'Iron', 'Steel', 'Storm',
];

const NOUNS = [
  'Mayor', 'Builder', 'Planner', 'Architect', 'Governor', 'Pioneer', 'Settler',
  'Founder', 'Developer', 'Engineer', 'Citizen', 'Watcher', 'Observer', 'Sage',
  'Dragon', 'Phoenix', 'Titan', 'Knight', 'Wizard', 'Viking', 'Ninja', 'Samurai',
];

function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${noun}${num}`;
}

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  color: string;
}

// Generate random color for user
function generateUserColor(): string {
  const colors = [
    '#00CED1', '#00D4FF', '#22c55e', '#f97316', '#eab308',
    '#a855f7', '#ec4899', '#3b82f6', '#ef4444', '#14b8a6',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

interface HumanChatProps {
  className?: string;
}

export function HumanChat({ className = '' }: HumanChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [username] = useState(() => generateUsername());
  const [userColor] = useState(() => generateUserColor());
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect to Supabase realtime channel for chat
  useEffect(() => {
    if (!supabase) {
      console.log('[HumanChat] Supabase not configured');
      return;
    }

    const channel = supabase.channel(`civilization-chat-${SESSION_ID}`, {
      config: {
        broadcast: { self: true }, // Receive our own messages
      },
    });

    channel
      .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
        const msg = payload as ChatMessage;
        if (msg && msg.message) {
          setMessages(prev => [...prev.slice(-49), msg]); // Keep last 50 messages
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log('[HumanChat] Connected to chat channel');
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      supabase?.removeChannel(channel);
    };
  }, []);

  const sendMessage = useCallback(() => {
    if (!inputValue.trim() || !channelRef.current || !isConnected) return;

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username,
      message: inputValue.trim().slice(0, 200), // Limit message length
      timestamp: Date.now(),
      color: userColor,
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: message,
    });

    setInputValue('');
  }, [inputValue, username, userColor, isConnected]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`bg-[#2d1810]/95 backdrop-blur-sm border-2 border-amber-500/70 rounded-lg shadow-2xl flex flex-col ${className}`}>
      {/* Header */}
      <div className="bg-amber-900/60 border-b border-amber-500/50 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-400 rounded-sm" />
          <span className="text-amber-300 font-bold text-sm tracking-wide">HUMAN CHAT</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-amber-500/70 text-xs">{username}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[150px] max-h-[250px]">
        {messages.length === 0 ? (
          <div className="text-amber-600 text-xs text-center py-4">
            No messages yet. Say hi!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-xs">
              <span style={{ color: msg.color }} className="font-bold">
                {msg.username}:
              </span>
              <span className="text-white/90 ml-1">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-amber-900/50 p-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            maxLength={200}
            className="flex-1 bg-[#1a0f0a] border border-amber-700/50 rounded px-2 py-1 text-xs text-white placeholder-amber-700 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || !isConnected}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900 disabled:text-amber-700 text-white text-xs font-bold rounded transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default HumanChat;
