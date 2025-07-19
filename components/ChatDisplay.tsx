'use client';

import React, { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react';
import { FixedSizeList as VirtualList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { createPortal } from 'react-dom';

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

// Memoized message item component for virtualized rendering
const MessageItem = memo(({ message, getColor, formatTime, renderMessageWithEmojis, chatColorMode }: {
  message: ChatMessage;
  getColor: (str: string) => string;
  formatTime: (timestamp: string) => string;
  renderMessageWithEmojis: (message: ChatMessage) => React.ReactNode;
  chatColorMode: 'default' | 'source';
}) => {
  return (
    <div className="container-box" style={{ marginBottom: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px' }}>
        {message.profileImage ? (
          <img 
            src={message.profileImage} 
            alt={message.authorName}
            style={{ 
              width: '28px', 
              height: '28px', 
              border: '1px solid var(--border-light)',
              marginRight: '8px',
              flexShrink: 0
            }}
            loading="lazy"
          />
        ) : (
          <div
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: getColor(message.authorChannelId),
              border: '1px solid var(--border-light)',
              marginRight: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              flexShrink: 0
            }}
          >
            {message.authorName.charAt(0).toUpperCase()}
          </div>
        )}
        
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
            <span 
              className="text-sm text-primary"
              style={{ 
                color: chatColorMode === 'source' 
                  ? getColor(message.sourceVideo.id)
                  : getColor(message.authorChannelId),
                fontWeight: '600',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '200px'
              }}
            >
              {message.authorName}
            </span>
            
            {message.userType && (
              <span className={`text-xs status-indicator ${
                message.userType === 'moderator' 
                  ? 'status-live'
                  : message.userType === 'member'
                  ? ''
                  : message.userType === 'owner'
                  ? ''
                  : ''
              }`} style={{ 
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: '700',
                textTransform: 'uppercase'
              }}>
                {message.userType === 'moderator' ? 'MOD' : 
                message.userType === 'member' ? 'MEMBER' : 
                message.userType === 'owner' ? 'OWNER' : ''}
              </span>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="text-xs text-muted">
              <span>{formatTime(message.timestamp)}</span>
              <span>•</span>
              <span 
                className="text-xs"
                style={{
                  backgroundColor: `${getColor(message.sourceVideo.id)}20`,
                  color: getColor(message.sourceVideo.id),
                  padding: '2px 6px',
                  border: '1px solid var(--border-light)',
                  fontSize: '10px',
                  fontWeight: '600'
                }}
              >
                {message.sourceVideo.id.substring(0, 6)}
              </span>
            </div>
          </div>
          
          <p className="text-sm text-secondary" style={{ 
            wordBreak: 'break-word', 
            lineHeight: '1.4',
            margin: 0
          }}>
            {renderMessageWithEmojis(message)}
          </p>
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export default function ChatDisplay({ messages, videoMetadata = [] }: ChatDisplayProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VirtualList | null>(null);
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
      div.style.background = 'var(--background)';
      div.style.opacity = '0';
      div.style.visibility = 'hidden';
      div.style.transition = 'opacity 0.3s ease-in-out';
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
        }, 300);
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
          style={{ 
            height: '1.2em', 
            width: 'auto', 
            margin: '0 1px',
            display: 'inline-block',
            verticalAlign: 'middle'
          }}
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

  // Format number with comma separators
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

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
        const outerRef = (listRef.current as any)._outerRef;
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
      } catch (error) {
        // Fallback if _outerRef is not available
        setAutoScroll(scrollOffset > 0);
      }
    }
  }, []);

  // Generate a deterministic color based on a string
  const getColor = useCallback((str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 45%)`;
  }, []);

  // Render a virtualized list item
  const renderRow = useCallback(({ index, style }: { index: number, style: React.CSSProperties }) => {
    const message = filteredMessages[index];
    const adjustedStyle = {
      ...style,
      paddingLeft: '12px',
      paddingRight: '12px',
      paddingTop: index === 0 ? '12px' : '0',
      paddingBottom: index === filteredMessages.length - 1 ? '12px' : '0',
      width: '100%',
    };
    
    return (
      <div style={adjustedStyle}>
        <MessageItem 
          message={message}
          getColor={getColor}
          formatTime={formatTime}
          renderMessageWithEmojis={renderMessageWithEmojis}
          chatColorMode={chatColorMode}
        />
      </div>
    );
  }, [filteredMessages, getColor, formatTime, renderMessageWithEmojis, chatColorMode]);

  // Render empty message when there are no messages to display
  const renderEmptyMessage = useCallback(() => (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style={{ margin: '0 auto', color: 'var(--text-muted)' }}>
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <p className="text-lg text-secondary" style={{ marginBottom: '8px' }}>
          {messages.length === 0 
            ? 'No chat messages yet' 
            : 'No messages match your filter criteria'
          }
        </p>
        <p className="text-muted">
          {messages.length === 0 
            ? 'Waiting for messages to appear...' 
            : 'Try changing your search terms'
          }
        </p>
      </div>
    </div>
  ), [messages.length]);

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
    if (num === undefined) return '-';
    return Intl.NumberFormat('en', { notation: 'compact' }).format(num);
  }, []);

  // Helper to get thumbnail URL from video ID
  const getYouTubeThumbnail = useCallback((videoId: string): string => {
    // Return high quality thumbnail
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }, []);

  // Helper to safely format title text from YouTube data
  const formatTitle = useCallback((title: any): string => {
    if (!title) return 'Live Stream';
    
    // Handle case where title is a string
    if (typeof title === 'string') return title;
    
    // Handle case where title is an object with 'runs' property (YouTube format)
    if (typeof title === 'object') {
      // Check if it has 'runs' array (YouTube format)
      if (title.runs && Array.isArray(title.runs)) {
        return title.runs.map((run: any) => run.text).join('');
      }
      
      // If it has a 'simpleText' property
      if (title.simpleText) {
        return title.simpleText;
      }
      
      // Try to convert the object to a string if possible
      try {
        return String(title);
      } catch (e) {
        return 'Live Stream';
      }
    }
    
    return 'Live Stream';
  }, []);

  // Render the chat content (used by both normal and fullscreen mode)
  const renderChatContent = () => (
    <>
      <div style={{ 
        display: 'flex', 
        flexDirection: window.innerWidth < 640 ? 'column' : 'row',
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: '16px', 
        marginBottom: '16px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="text-lg text-primary">Live Chat</h2>
          <div className="status-indicator status-live">
            {filteredMessages.length} messages
          </div>
        </div>
        
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          gap: '8px',
          width: window.innerWidth < 640 ? '100%' : 'auto'
        }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-muted">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Filter messages..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input"
              style={{ paddingLeft: '40px' }}
            />
          </div>
          
          <select 
            value={chatColorMode} 
            onChange={(e) => setChatColorMode(e.target.value as 'default' | 'source')}
            className="input"
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="default">Color by User</option>
            <option value="source">Color by Source</option>
          </select>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setAutoScroll(!autoScroll);
                if (!autoScroll && listRef.current) {
                  listRef.current.scrollToItem(filteredMessages.length - 1);
                }
              }}
              className={`btn ${autoScroll ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {autoScroll ? 'Auto' : 'Manual'}
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              aria-label={isFullscreen ? "Exit Full Screen" : "Full Screen"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {isFullscreen ? 'Exit' : 'Full'}
            </button>
          </div>
        </div>
      </div>
      
      {filteredMessages.length === 0 ? (
        <div className="container-box">
          <div className="container-section">
            {renderEmptyMessage()}
          </div>
        </div>
      ) : (
        <div 
          className="container-box"
          style={{ 
            height: isFullscreen ? "calc(100vh - 200px)" : "600px", 
            width: '100%',
            overflow: 'hidden'
          }}
          ref={chatContainerRef}
        >
          <AutoSizer>
            {({ height, width }) => (
              <VirtualList
                height={height}
                width={width}
                itemCount={filteredMessages.length}
                itemSize={90}
                ref={listRef}
                onScroll={handleScroll}
                overscanCount={8}
                style={{ background: 'var(--card-bg)' }}
              >
                {renderRow}
              </VirtualList>
            )}
          </AutoSizer>
          
          {!autoScroll && (
            <div style={{
              position: 'sticky',
              bottom: '16px',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => {
                  setAutoScroll(true);
                  if (listRef.current) {
                    listRef.current.scrollToItem(filteredMessages.length - 1);
                  }
                }}
                className="btn btn-primary"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 14l-7 7m0 0l-7-7m7 7V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Scroll to Latest
              </button>
            </div>
          )}

          {isFullscreen && (
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px'
            }}>
              <button
                onClick={() => setIsFullscreen(false)}
                className="btn btn-secondary"
                style={{ padding: '8px' }}
                aria-label="Exit Full Screen"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Regular mode */}
      <div className="container-section">
        {!isFullscreen && renderChatContent()}
      </div>
      
      {/* Fullscreen mode using portal */}
      {isFullscreen && portalRef.current && 
        createPortal(
          <div style={{ 
            width: '100%', 
            height: '100%', 
            padding: '0', 
            margin: '0', 
            overflow: 'hidden',
            background: 'var(--background)',
            color: 'var(--foreground)'
          }}>
            <div className="main-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '16px', 
                marginBottom: '16px'
              }}>
                {/* Compact header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 className="text-lg text-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
                        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Live Chat
                    </h2>
                    
                    <div className="status-indicator status-live">
                      {filteredMessages.length} messages
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', minWidth: '200px', maxWidth: '300px' }}>
                      <div style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-muted">
                          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Filter messages..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="input"
                        style={{ paddingLeft: '40px' }}
                      />
                    </div>
                    
                    <select 
                      value={chatColorMode} 
                      onChange={(e) => setChatColorMode(e.target.value as 'default' | 'source')}
                      className="input"
                      style={{ width: 'auto', minWidth: '140px' }}
                    >
                      <option value="default">Color by User</option>
                      <option value="source">Color by Source</option>
                    </select>
                    
                    <button
                      onClick={() => {
                        setAutoScroll(!autoScroll);
                        if (!autoScroll && listRef.current) {
                          listRef.current.scrollToItem(filteredMessages.length - 1);
                        }
                      }}
                      className={`btn ${autoScroll ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 14l-7 7m0 0l-7-7m7 7V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {autoScroll ? 'Auto Scroll' : 'Manual'}
                    </button>
                    
                    <button
                      onClick={() => setIsFullscreen(false)}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      aria-label="Exit Full Screen"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Exit
                    </button>
                  </div>
                </div>
                
                {/* Horizontal scrollable source stats */}
                <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                  <div style={{ display: 'flex', gap: '12px', minWidth: 'max-content' }}>
                    {(() => {
                      // Get unique source IDs from messages
                      const sourceIds = [...new Set(messages.map(m => m.sourceVideo.id))];
                      
                      return sourceIds.map(sourceId => {
                        const metadata = videoMetadata.find(m => m.videoId === sourceId);
                        const messageCount = messageCountsBySource[sourceId] || 0;
                        const color = getColor(sourceId);
                        
                        return (
                          <div 
                            key={sourceId}
                            className="container-box"
                            style={{ 
                              padding: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              flexShrink: 0,
                              borderLeft: `3px solid ${color}`
                            }}
                          >
                            <img 
                              src={metadata?.thumbnailUrl || getYouTubeThumbnail(sourceId)} 
                              alt={formatTitle(metadata?.title) || 'Video thumbnail'}
                              style={{ 
                                width: '32px', 
                                height: '24px', 
                                objectFit: 'cover',
                                border: '1px solid var(--border)',
                                marginRight: '8px',
                                flexShrink: 0
                              }}
                              loading="lazy"
                            />
                            
                            <div style={{ minWidth: 0, maxWidth: '150px' }}>
                              <div className="text-xs text-primary" style={{ 
                                fontWeight: '600',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginBottom: '2px'
                              }} title={formatTitle(metadata?.title)}>
                                {formatTitle(metadata?.title)}
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="text-xs text-muted">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  {formatCompactNumber(metadata?.viewCount)}
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  {messageCount}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
              
              <div style={{ 
                flexGrow: 1, 
                position: 'relative', 
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: 'var(--card-bg)'
              }}>
                {filteredMessages.length === 0 ? (
                  <div className="container-section">
                    {renderEmptyMessage()}
                  </div>
                ) : (
                  <AutoSizer>
                    {({ height, width }) => (
                      <VirtualList
                        height={height}
                        width={width}
                        itemCount={filteredMessages.length}
                        itemSize={90}
                        ref={listRef}
                        onScroll={handleScroll}
                        overscanCount={8}
                        style={{ background: 'var(--card-bg)' }}
                      >
                        {renderRow}
                      </VirtualList>
                    )}
                  </AutoSizer>
                )}

                {!autoScroll && (
                  <div style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)'
                  }}>
                    <button
                      onClick={() => {
                        setAutoScroll(true);
                        if (listRef.current) {
                          listRef.current.scrollToItem(filteredMessages.length - 1);
                        }
                      }}
                      className="btn btn-primary"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 14l-7 7m0 0l-7-7m7 7V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Scroll to Latest
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>, 
          portalRef.current
        )
      }
    </>
  );
}

// Define props for CustomTooltip
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    dataKey: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
}

// CustomTooltip component for charts
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  // ... rest of the component
}; 