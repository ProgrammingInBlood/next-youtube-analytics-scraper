'use client';

import React, { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react';
import { VariableSizeList as VirtualList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { createPortal } from 'react-dom';
import { Search, X, ArrowDown, Maximize2, Minimize2, Eye, ThumbsUp, MessageSquare, Palette } from 'lucide-react';

interface SourceVideo {
  url: string;
  id: string;
  title?: string;
}

interface EmojiObject {
  url: string;
  label: string;
  emojiId: string;
}

// Add interface for video metadata
interface VideoMetadata {
  videoId: string;
  videoUrl: string;
  title?: string;
  channelName?: string;
  viewCount: number;
  likeCount: number;
  isLive: boolean;
  error?: string;
  thumbnailUrl?: string; // Added for thumbnail display
}

type YouTubeTitle =
  | string
  | {
      runs?: Array<{ text: string }>;
      simpleText?: string;
    }
  | null
  | undefined;

interface ChatMessage {
  id: string;
  message: string;
  authorName: string;
  authorChannelId: string;
  timestamp: string;
  userType?: 'moderator' | 'member' | 'owner' | 'regular';
  profileImage?: string;
  emojis?: EmojiObject[];
  sourceVideo: SourceVideo;
}

interface ChatDisplayProps {
  messages: ChatMessage[];
  videoMetadata?: VideoMetadata[]; // Add optional video metadata
}

// Twitch-style compact inline message row
const ChatLine = memo(({ message, getColor, formatTime, renderMessageWithEmojis, chatColorMode }: {
  message: ChatMessage;
  getColor: (str: string) => string;
  formatTime: (timestamp: string) => string;
  renderMessageWithEmojis: (message: ChatMessage) => React.ReactNode;
  chatColorMode: 'default' | 'source';
}) => {
  const badgeClass =
    message.userType === 'moderator' ? 'chat-badge chat-badge-mod'
    : message.userType === 'member' ? 'chat-badge chat-badge-member'
    : message.userType === 'owner' ? 'chat-badge chat-badge-owner'
    : null;

  const badgeLabel =
    message.userType === 'moderator' ? 'MOD'
    : message.userType === 'member' ? 'VIP'
    : message.userType === 'owner' ? 'OWNER'
    : null;

  const nameColor = chatColorMode === 'source'
    ? getColor(message.sourceVideo.id)
    : getColor(message.authorChannelId);

  const srcColor = getColor(message.sourceVideo.id);

  return (
    <div className="chat-line">
      <span className="chat-time">{formatTime(message.timestamp)}</span>
      <span className="chat-src-dot" style={{ backgroundColor: srcColor }} title={message.sourceVideo.id} />
      {badgeLabel && <span className={badgeClass!}>{badgeLabel}</span>}
      <span className="chat-author" style={{ color: nameColor }} title={message.authorName}>
        {message.authorName}
      </span>
      <span className="text-[var(--text-muted)] mx-1">:</span>
      <span className="chat-msg">{renderMessageWithEmojis(message)}</span>
    </div>
  );
});

ChatLine.displayName = 'ChatLine';

export default function ChatDisplay({ messages, videoMetadata = [] }: ChatDisplayProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VirtualList | null>(null);
  const listWidthRef = useRef(400);
  const sizeCacheRef = useRef<Map<number, number>>(new Map());
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [chatColorMode, setChatColorMode] = useState<'default' | 'source'>('default');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Add an initialization flag to handle initial scrolling
  const initialScrollApplied = useRef(false);
  
  // Add ref for portal container
  const portalRef = useRef<HTMLDivElement | null>(null);
  
  // Create portal container on mount
  useEffect(() => {
    // Create portal container if it doesn't exist
    if (!portalRef.current) {
      const div = document.createElement('div');
      div.id = 'chat-fullscreen-portal';
      div.style.position = 'fixed';
      div.style.top = '0';
      div.style.left = '0';
      div.style.width = '100vw';
      div.style.height = '100vh';
      div.style.zIndex = '9999';
      div.style.overflow = 'hidden';
      div.style.margin = '0';
      div.style.padding = '0';
      div.style.background = 'var(--bg-base)';
      div.style.opacity = '0';
      div.style.visibility = 'hidden';
      div.style.transition = 'opacity 0.2s ease-in-out';
      document.body.appendChild(div);
      portalRef.current = div;
    }
    
    return () => {
      // Cleanup on unmount
      if (portalRef.current) {
        document.body.removeChild(portalRef.current);
        portalRef.current = null;
      }
    };
  }, []);

  // Show/hide portal based on fullscreen state
  useEffect(() => {
    if (portalRef.current) {
      if (isFullscreen) {
        portalRef.current.style.opacity = '1';
        portalRef.current.style.visibility = 'visible';
        document.body.style.overflow = 'hidden';
      } else {
        portalRef.current.style.opacity = '0';
        setTimeout(() => {
          if (portalRef.current) {
            portalRef.current.style.visibility = 'hidden';
          }
        }, 200);
        document.body.style.overflow = '';
      }
    }
  }, [isFullscreen]);

  // Map to track unique messages and assign unique keys
  const uniqueKeysMap = useRef(new Map<string, number>());
  
  // Memoize functions that don't need to be recreated on every render
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getUniqueKey = useCallback((message: ChatMessage): string => {
    const baseKey = message.id;
    
    // If we've never seen this ID before, add it to our map
    if (!uniqueKeysMap.current.has(baseKey)) {
      uniqueKeysMap.current.set(baseKey, 1);
      return baseKey;
    }
    
    // If we've seen this ID before, increment the counter and return a combined key
    const count = uniqueKeysMap.current.get(baseKey)! + 1;
    uniqueKeysMap.current.set(baseKey, count);
    return `${baseKey}-${count}`;
  }, []);

  // Render message text with emojis - memoize the function creation
  const renderMessageWithEmojis = useCallback((message: ChatMessage) => {
    if (!message.emojis || message.emojis.length === 0) {
      return <span>{message.message}</span>;
    }

    // Create a map of emoji IDs to their image elements
    const emojiMap = new Map<string, (index: number) => React.ReactNode>();
    message.emojis.forEach(emoji => {
      emojiMap.set(emoji.emojiId, (uniqueIndex: number) => (
        <img 
          src={emoji.url} 
          alt={emoji.label} 
          title={emoji.label}
          className="inline-block align-middle h-5 w-auto mx-px"
          key={`${emoji.emojiId}-${uniqueIndex}`}
          loading="lazy"
        />
      ));
    });
    
    // Replace emoji placeholders with actual emoji images
    const parts: (string | React.ReactNode)[] = [];
    let currentText = '';
    let i = 0;
    
    // Keep track of how many times each emoji has been used
    const emojiUsageCount = new Map<string, number>();
    
    while (i < message.message.length) {
      let found = false;
      
      // Check if the current position matches any emoji ID
      for (const [emojiId, createEmojiElement] of emojiMap.entries()) {
        if (message.message.substring(i).startsWith(emojiId)) {
          // Add any accumulated text
          if (currentText) {
            parts.push(currentText);
            currentText = '';
          }
          
          // Get a unique index for this emoji usage
          const usageCount = emojiUsageCount.get(emojiId) || 0;
          emojiUsageCount.set(emojiId, usageCount + 1);
          
          // Add the emoji element with a unique index
          parts.push(createEmojiElement(usageCount));
          
          // Skip past this emoji ID
          i += emojiId.length;
          found = true;
          break;
        }
      }
      
      // If no emoji was found at this position, add the character to current text
      if (!found) {
        currentText += message.message[i];
        i++;
      }
    }
    
    // Add any remaining text
    if (currentText) {
      parts.push(currentText);
    }
    
    // Return the message with emojis as React elements
    return <span>{parts}</span>;
  }, []);

  // Filter messages based on search input - memoized for performance
  const filteredMessages = useMemo(() => {
    return messages.filter(message => {
      if (!filter) return true;
      
      const searchTerm = filter.toLowerCase();
      return (
        message.message.toLowerCase().includes(searchTerm) ||
        message.authorName.toLowerCase().includes(searchTerm)
      );
    });
  }, [messages, filter]);

  // Initial load effect - ensures the chat scrolls to bottom on first load
  useEffect(() => {
    if (filteredMessages.length > 0) {
      // Use a small timeout to ensure the list has rendered
      const timer = setTimeout(() => {
        if (listRef.current && autoScroll) {
          listRef.current.scrollToItem(filteredMessages.length - 1, 'end');
          initialScrollApplied.current = true;
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [filteredMessages.length, autoScroll]); // Adding autoScroll to dependency array

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Skip if we haven't had our initial scroll yet or if auto-scroll is disabled
    if (!initialScrollApplied.current || !autoScroll || !listRef.current) {
      return;
    }
    
    // Only scroll if new messages have arrived and we still want auto-scroll
    if (filteredMessages.length > 0) {
      listRef.current.scrollToItem(filteredMessages.length - 1, 'end');
    }
  }, [filteredMessages.length, autoScroll]);

  // Format timestamp for display
  const formatTime = useCallback((timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (formatError) {
      console.error('Error formatting time:', formatError);
      return '';
    }
  }, []);

  // Handle scroll events to toggle auto-scroll
  const handleScroll = useCallback(({ scrollOffset, scrollUpdateWasRequested }: {
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
  }) => {
    // Skip auto-scroll logic if the scroll was requested programmatically
    if (scrollUpdateWasRequested) return;
    
    if (listRef.current) {
      try {
        // Use any type to access internal property
        const outerRef = (listRef.current as unknown as { _outerRef?: HTMLElement })._outerRef;
        if (outerRef) {
          const { clientHeight, scrollHeight } = outerRef;
          // Consider user "at bottom" if within 100px of the bottom
          const atBottom = scrollOffset + clientHeight >= scrollHeight - 100;
          
          // Mark initialization as complete once user has scrolled
          if (!initialScrollApplied.current) {
            initialScrollApplied.current = true;
          }
          
          // Update auto-scroll state based on user's scroll position
          setAutoScroll(atBottom);
        }
      } catch {
        // Fallback if _outerRef is not available
        setAutoScroll(scrollOffset > 0);
      }
    }
  }, []);

  // Generate a deterministic color based on a string (Twitch-style vibrant colors)
  const getColor = useCallback((str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = ((hash % 360) + 360) % 360;
    return `hsl(${hue}, 80%, 65%)`;
  }, []);

  // Estimate row height based on message length and available width
  const getItemSize = useCallback((index: number): number => {
    if (sizeCacheRef.current.has(index)) return sizeCacheRef.current.get(index)!;
    const message = filteredMessages[index];
    if (!message) return 28;
    const availableWidth = Math.max(100, listWidthRef.current - 160); // subtract time+dot+author+padding
    const charsPerLine = Math.floor(availableWidth / 7.5);
    const lines = Math.max(1, Math.ceil(message.message.length / charsPerLine));
    const height = lines * 20 + 10;
    sizeCacheRef.current.set(index, height);
    return height;
  }, [filteredMessages]);

  // Reset size cache when messages change
  useEffect(() => {
    sizeCacheRef.current.clear();
    if (listRef.current) listRef.current.resetAfterIndex(0);
  }, [filteredMessages]);

  // Render a virtualized list item
  const renderRow = useCallback(({ index, style }: { index: number, style: React.CSSProperties }) => {
    const message = filteredMessages[index];
    return (
      <div style={style}>
        <ChatLine
          message={message}
          getColor={getColor}
          formatTime={formatTime}
          renderMessageWithEmojis={renderMessageWithEmojis}
          chatColorMode={chatColorMode}
        />
      </div>
    );
  }, [filteredMessages, getColor, formatTime, renderMessageWithEmojis, chatColorMode]);

  // Handle ESC key to exit fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // When entering fullscreen, scroll to the latest message
  useEffect(() => {
    if (isFullscreen && listRef.current && filteredMessages.length > 0) {
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollToItem(filteredMessages.length - 1, 'end');
        }
      }, 100);
    }
  }, [isFullscreen, filteredMessages.length]);

  // Group messages by source ID for counting
  const messageCountsBySource = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach(message => {
      const sourceId = message.sourceVideo.id;
      counts[sourceId] = (counts[sourceId] || 0) + 1;
    });
    return counts;
  }, [messages]);

  // Format large numbers with abbreviations (e.g., 1500 -> 1.5K)
  const formatCompactNumber = useCallback((num?: number): string => {
    if (num === undefined || num === 0) return '0';
    return Intl.NumberFormat('en', { notation: 'compact' }).format(num);
  }, []);

  // Helper to get thumbnail URL from video ID
  const getYouTubeThumbnail = useCallback((videoId: string): string => {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }, []);

  // Helper to safely format title text from YouTube data
  const formatTitle = useCallback((title: YouTubeTitle): string => {
    if (!title) return 'Live Stream';
    if (typeof title === 'string') return title;
    if (typeof title === 'object') {
      if (title.runs && Array.isArray(title.runs)) {
        return title.runs.map(run => run.text).join('');
      }
      if (title.simpleText) return title.simpleText;
      try { return String(title); } catch { return 'Live Stream'; }
    }
    return 'Live Stream';
  }, []);

  // ── Source Bar with like counts ──
  const renderSourceBar = () => {
    const sourceIds = [...new Set(messages.map(m => m.sourceVideo.id))];
    if (sourceIds.length === 0) return null;

    return (
      <div className="source-bar">
        {sourceIds.map(sourceId => {
          const meta = videoMetadata.find(m => m.videoId === sourceId);
          const msgCount = messageCountsBySource[sourceId] || 0;
          const color = getColor(sourceId);

          return (
            <div key={sourceId} className="source-pill" style={{ borderLeftColor: color, borderLeftWidth: '3px' }}>
              <img
                src={meta?.thumbnailUrl || getYouTubeThumbnail(sourceId)}
                alt=""
                className="source-pill-thumb"
                loading="lazy"
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="source-pill-title">{formatTitle(meta?.title)}</span>
                <div className="flex items-center gap-2.5">
                  <span className="source-pill-stat"><Eye className="w-3 h-3" />{formatCompactNumber(meta?.viewCount)}</span>
                  <span className="source-pill-stat"><ThumbsUp className="w-3 h-3" />{formatCompactNumber(meta?.likeCount)}</span>
                  <span className="source-pill-stat"><MessageSquare className="w-3 h-3" />{msgCount}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Toolbar ──
  const renderToolbar = (variant: 'regular' | 'fullscreen') => (
    <div className={`flex items-center justify-between gap-2 px-3 h-10 flex-shrink-0 ${
      variant === 'fullscreen'
        ? 'bg-[var(--bg-alt)] border-b border-[var(--border)]'
        : 'bg-[var(--bg-alt)] border-b border-[var(--border)]'
    }`}>
      {/* Left */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-bold text-[var(--text-base)] tracking-wide uppercase">Chat</span>
        <span className="text-[10px] font-semibold text-[var(--text-muted)] tabular-nums">
          {filteredMessages.length.toLocaleString()}
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Filter…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="h-7 pl-7 pr-7 w-36 bg-[var(--bg-input)] border border-[var(--border)] rounded-md text-xs text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-base)]">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Color mode toggle */}
        <button
          onClick={() => setChatColorMode(chatColorMode === 'default' ? 'source' : 'default')}
          className={`flex items-center gap-1 h-7 px-2 rounded-md text-[10px] font-semibold transition-colors ${
            chatColorMode === 'source'
              ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)]'
          }`}
          title={chatColorMode === 'default' ? 'Color by user' : 'Color by source'}
        >
          <Palette className="w-3 h-3" />
        </button>

        {/* Auto-scroll toggle */}
        <button
          onClick={() => {
            setAutoScroll(!autoScroll);
            if (!autoScroll && listRef.current) {
              listRef.current.scrollToItem(filteredMessages.length - 1);
            }
          }}
          className={`flex items-center gap-1 h-7 px-2 rounded-md text-[10px] font-semibold transition-colors ${
            autoScroll
              ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)]'
          }`}
        >
          <ArrowDown className="w-3 h-3" />
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="flex items-center h-7 px-2 rounded-md text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );

  // ── Empty state ──
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
      <MessageSquare className="w-12 h-12 text-[var(--text-muted)] opacity-40" />
      <p className="text-sm font-medium text-[var(--text-dim)]">
        {messages.length === 0 ? 'Waiting for chat messages...' : 'No messages match your filter'}
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        {messages.length === 0 ? 'Messages will appear here in real-time' : 'Try different search terms'}
      </p>
    </div>
  );

  // ── Chat body (shared between regular & fullscreen) ──
  const renderChatBody = () => (
    <div className="flex-1 min-h-0 relative" ref={chatContainerRef}>
      {filteredMessages.length === 0 ? (
        renderEmpty()
      ) : (
        <AutoSizer>
          {({ height, width }) => {
            listWidthRef.current = width;
            return (
              <VirtualList
                height={height}
                width={width}
                itemCount={filteredMessages.length}
                itemSize={getItemSize}
                ref={listRef}
                onScroll={handleScroll}
                overscanCount={15}
                style={{ background: 'var(--bg-base)' }}
              >
                {renderRow}
              </VirtualList>
            );
          }}
        </AutoSizer>
      )}

      {!autoScroll && filteredMessages.length > 0 && (
        <button
          className="chat-jump-btn"
          onClick={() => {
            setAutoScroll(true);
            if (listRef.current) {
              listRef.current.scrollToItem(filteredMessages.length - 1);
            }
          }}
        >
          <ArrowDown className="w-3.5 h-3.5" />
          More messages below
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Regular mode — fills parent container */}
      {!isFullscreen && (
        <div className="flex flex-col h-full">
          {renderToolbar('regular')}
          {renderSourceBar()}
          {renderChatBody()}
        </div>
      )}
      
      {/* Fullscreen mode using portal */}
      {isFullscreen && portalRef.current && 
        createPortal(
          <div className="chat-fullscreen-root">
            {renderToolbar('fullscreen')}
            {renderSourceBar()}
            <div className="chat-fullscreen-body">
              {renderChatBody()}
            </div>
          </div>,
          portalRef.current
        )
      }
    </>
  );
}
