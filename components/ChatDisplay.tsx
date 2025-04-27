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
    <div className="rounded-lg p-3 bg-gray-800/90 backdrop-blur-sm shadow-sm border border-gray-700/50 mb-2 hover:shadow-md transition-shadow w-full">
      <div className="flex items-start mb-1.5">
        {message.profileImage ? (
          <img 
            src={message.profileImage} 
            alt={message.authorName}
            className="size-7 rounded-full mr-2 ring-2 ring-gray-800/60 shadow-sm flex-shrink-0"
            loading="lazy"
          />
        ) : (
          <div
            className="size-7 rounded-full mr-2 ring-2 ring-gray-800/60 flex items-center justify-center text-white text-xs font-medium shadow-sm flex-shrink-0"
            style={{ backgroundColor: getColor(message.authorChannelId) }}
          >
            {message.authorName.charAt(0).toUpperCase()}
          </div>
        )}
        
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center flex-wrap">
            <span 
              className="font-semibold truncate mr-2"
              style={{ 
                color: chatColorMode === 'source' 
                  ? getColor(message.sourceVideo.id)
                  : getColor(message.authorChannelId)
              }}
            >
              {message.authorName}
            </span>
            
            {message.userType && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium mr-2 ${
                message.userType === 'moderator' 
                  ? 'bg-blue-900/40 text-blue-400'
                  : message.userType === 'member'
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : message.userType === 'owner'
                  ? 'bg-purple-900/40 text-purple-400'
                  : ''
              }`}>
                {message.userType === 'moderator' ? 'MOD' : 
                message.userType === 'member' ? 'MEMBER' : 
                message.userType === 'owner' ? 'OWNER' : ''}
              </span>
            )}
            
            <div className="flex items-center text-xs text-gray-400 flex-shrink-0">
              <span>{formatTime(message.timestamp)}</span>
              <span className="mx-1.5">•</span>
              <span 
                className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${getColor(message.sourceVideo.id)}20`,
                  color: getColor(message.sourceVideo.id)
                }}
              >
                {message.sourceVideo.id.substring(0, 6)}
              </span>
            </div>
          </div>
          
          <p className="text-gray-200 break-words leading-tight text-sm mt-1">
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
      // Set initial classes but will update in the effect below
      div.className = 'bg-gray-950 opacity-0 invisible';
      div.style.transition = 'opacity 0.3s ease-in-out';
      // Detect system preference for reduced motion
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        div.style.backdropFilter = 'blur(4px)';
      }
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
        // Always use dark theme for fullscreen to match the app's dark theme
        portalRef.current.className = 'bg-gray-950 text-white';
        
        // Show the portal with animation
        portalRef.current.style.opacity = '1';
        portalRef.current.style.visibility = 'visible';
        // Prevent body scrolling
        document.body.style.overflow = 'hidden';
      } else {
        // Hide with animation
        portalRef.current.style.opacity = '0';
        // Wait for animation to complete before hiding
        setTimeout(() => {
          if (portalRef.current) {
            portalRef.current.style.visibility = 'hidden';
          }
        }, 300);
        // Restore body scrolling
        document.body.style.overflow = '';
      }
    }
  }, [isFullscreen]);

  // Listen for theme changes to update portal background
  useEffect(() => {
    const updateTheme = () => {
      if (portalRef.current && isFullscreen) {
        const isDarkMode = 
          document.documentElement.classList.contains('dark') || 
          document.body.classList.contains('dark') || 
          window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        portalRef.current.className = isDarkMode 
          ? 'bg-gradient-to-b from-gray-900 to-gray-950 text-white' 
          : 'bg-gradient-to-b from-gray-50 to-white text-gray-900';
      }
    };
    
    // Listen for dark mode changes from system
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.addEventListener('change', updateTheme);
    
    // Also listen for class changes on document element (for theme toggles)
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.attributeName === 'class') {
          updateTheme();
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => {
      darkModeMediaQuery.removeEventListener('change', updateTheme);
      observer.disconnect();
    };
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
          className="inline-block align-middle" 
          style={{ height: '1.2em', width: 'auto', margin: '0 1px' }}
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
      const { clientHeight, scrollHeight } = listRef.current._outerRef;
      // Consider user "at bottom" if within 100px of the bottom
      const atBottom = scrollOffset + clientHeight >= scrollHeight - 100;
      
      // Mark initialization as complete once user has scrolled
      if (!initialScrollApplied.current) {
        initialScrollApplied.current = true;
      }
      
      // Update auto-scroll state based on user's scroll position
      setAutoScroll(atBottom);
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
    <div className="text-gray-400 text-center py-16 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 shadow-lg">
      <div className="flex flex-col items-center gap-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="size-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <div>
          <p className="text-lg font-medium mb-1">
            {messages.length === 0 
              ? 'No chat messages yet' 
              : 'No messages match your filter criteria'
            }
          </p>
          <p>
            {messages.length === 0 
              ? 'Waiting for messages to appear...' 
              : 'Try changing your search terms'
            }
          </p>
        </div>
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
        listRef.current.scrollToItem(filteredMessages.length - 1, 'end');
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderSourceStats = useCallback(() => {
    // Get unique source IDs from messages
    const sourceIds = [...new Set(messages.map(m => m.sourceVideo.id))];
    
    return (
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sourceIds.map(sourceId => {
          const metadata = videoMetadata.find(m => m.videoId === sourceId);
          const messageCount = messageCountsBySource[sourceId] || 0;
          const color = getColor(sourceId);

          return (
            <div 
              key={sourceId}
              className="rounded-lg p-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center"
              style={{ borderLeft: `4px solid ${color}` }}
            >
              {/* Always show thumbnail using YouTube ID */}
              <img 
                src={metadata?.thumbnailUrl || getYouTubeThumbnail(sourceId)} 
                alt={formatTitle(metadata?.title) || 'Video thumbnail'}
                className="w-12 h-9 object-cover rounded mr-3 flex-shrink-0"
                loading="lazy"
              />
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm mb-1 truncate" title={formatTitle(metadata?.title)}>
                  {formatTitle(metadata?.title)}
                </div>
                
                <div className="flex items-center text-xs text-gray-600 dark:text-gray-300 space-x-2">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {formatCompactNumber(metadata?.viewCount)}
                  </div>
                  
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    {formatCompactNumber(metadata?.likeCount)}
                  </div>
                  
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    {messageCount}
                  </div>
                  
                  <div 
                    className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${color}20`,
                      color: color
                    }}
                  >
                    {sourceId.substring(0, 6)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [messages, videoMetadata, messageCountsBySource, getColor, formatCompactNumber, getYouTubeThumbnail, formatTitle]);

  // Render the chat content (used by both normal and fullscreen mode)
  const renderChatContent = () => (
    <>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Live Chat</h2>
          <div className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-300">
            {filteredMessages.length} messages
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 w-full sm:w-auto min-w-[200px]">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Filter messages..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="py-2 pl-10 pr-3 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-shadow"
            />
          </div>
          
            <select 
              value={chatColorMode} 
              onChange={(e) => setChatColorMode(e.target.value as 'default' | 'source')}
            className="py-2 pl-3 pr-8 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none bg-no-repeat focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-shadow"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: `right 0.5rem center`,
              backgroundSize: `1.5em 1.5em`
            }}
            >
              <option value="default">Color by User</option>
              <option value="source">Color by Source</option>
            </select>
          
          <div className="flex gap-2">
          <button
              onClick={() => {
                setAutoScroll(!autoScroll);
                if (!autoScroll && listRef.current) {
                  listRef.current.scrollToItem(filteredMessages.length - 1);
                }
              }}
              className={`py-2 px-3 text-sm rounded-lg flex items-center gap-1.5 transition-colors ${
              autoScroll 
                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              {autoScroll ? 'Auto' : 'Manual'}
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="py-2 px-3 text-sm rounded-lg flex items-center gap-1.5 transition-colors bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              aria-label={isFullscreen ? "Exit Full Screen" : "Full Screen"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
              {isFullscreen ? 'Exit' : 'Full'}
          </button>
          </div>
        </div>
      </div>
      
      {filteredMessages.length === 0 ? (
        renderEmptyMessage()
      ) : (
        <div 
          className={`bg-gray-50/80 dark:bg-gray-900/20 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-gray-700/30 shadow-lg ${isFullscreen ? 'flex-1' : ''}`}
          style={{ height: isFullscreen ? "calc(100vh - 100px)" : "600px", width: '100%' }}
            ref={chatContainerRef}
        >
          <AutoSizer>
            {({ height, width }) => (
              <VirtualList
                height={height}
                width={width}
                itemCount={filteredMessages.length}
                itemSize={85}
                ref={listRef}
            onScroll={handleScroll}
                overscanCount={8}
                className="scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent w-full"
              >
                {renderRow}
              </VirtualList>
            )}
          </AutoSizer>
          
          {!autoScroll && (
            <div className="sticky bottom-4 flex justify-center">
              <button
                onClick={() => {
                  setAutoScroll(true);
                  if (listRef.current) {
                    listRef.current.scrollToItem(filteredMessages.length - 1);
                  }
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-4 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                Scroll to Latest
              </button>
            </div>
          )}

          {isFullscreen && (
            <div className="absolute top-2 right-2">
              <button
                onClick={() => setIsFullscreen(false)}
                className="bg-gray-800/70 hover:bg-gray-700 text-white text-sm p-2 rounded-full shadow-lg hover:shadow-xl transition-all"
                aria-label="Exit Full Screen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
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
      <div className="space-y-4">
        {!isFullscreen && renderChatContent()}
      </div>
      
      {/* Fullscreen mode using portal */}
      {isFullscreen && portalRef.current && 
        createPortal(
          <div className="w-full h-full p-0 m-0 overflow-hidden">
            <div className="max-w-7xl mx-auto p-3 sm:p-4 h-full flex flex-col">
              <div className="flex flex-col gap-3 mb-3">
                {/* Compact header with tabs for source stats */}
                <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Live Chat
                    </h2>
                    
                    <div className="flex items-center rounded-full bg-gray-900 px-2.5 py-1 text-sm font-medium">
                      <span className="text-purple-400">{filteredMessages.length}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-2">
                    <div className="relative min-w-[200px] max-w-xs">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Filter messages..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full py-2 pl-10 pr-3 text-sm border border-gray-700 rounded-full bg-gray-800 text-gray-100 focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-shadow"
                      />
                    </div>
                    
                    <select 
                      value={chatColorMode} 
                      onChange={(e) => setChatColorMode(e.target.value as 'default' | 'source')}
                      className="py-2 pl-3 pr-8 text-sm border border-gray-700 rounded-lg bg-gray-800 text-gray-100 appearance-none bg-no-repeat focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-shadow"
                    style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: `right 0.5rem center`,
                        backgroundSize: `1.5em 1.5em`
                      }}
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
                      className={`py-2 px-3 text-sm rounded-lg flex items-center gap-1.5 transition-colors ${
                        autoScroll 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm' 
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      {autoScroll ? 'Auto Scroll' : 'Manual'}
                    </button>
                    
                    <button
                      onClick={() => setIsFullscreen(false)}
                      className="bg-gray-800 hover:bg-gray-700 text-white text-sm py-2 px-3 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-1.5"
                      aria-label="Exit Full Screen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Exit
                    </button>
                  </div>
                </div>
                
                {/* Horizontal scrollable source stats */}
                <div className="overflow-x-auto pb-1 -mx-2 px-2">
                  <div className="flex space-x-3" style={{ minWidth: 'max-content' }}>
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
                            className="rounded-lg p-2 bg-gray-900 shadow-sm border border-gray-700/50 flex items-center flex-shrink-0"
                            style={{ borderLeft: `3px solid ${color}` }}
                          >
                            <img 
                              src={metadata?.thumbnailUrl || getYouTubeThumbnail(sourceId)} 
                              alt={formatTitle(metadata?.title) || 'Video thumbnail'}
                              className="w-8 h-6 object-cover rounded mr-2 flex-shrink-0"
                              loading="lazy"
                            />
                            
                            <div className="min-w-0 max-w-[150px]">
                              <div className="font-medium text-xs truncate" title={formatTitle(metadata?.title)}>
                                {formatTitle(metadata?.title)}
                              </div>
                              
                              <div className="flex items-center text-xs text-gray-300 space-x-2">
                                <div className="flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="size-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  {formatCompactNumber(metadata?.viewCount)}
                                </div>
                                
                                <div className="flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="size-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                  </svg>
                                  {formatCompactNumber(metadata?.likeCount)}
                                </div>
                                
                                <div className="flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="size-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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
              
              <div className="flex-grow relative overflow-hidden rounded-2xl shadow-lg bg-gray-900 backdrop-blur-sm border border-gray-700/50 w-full">
                {filteredMessages.length === 0 ? (
                  renderEmptyMessage()
                ) : (
                  <AutoSizer>
                    {({ height, width }) => (
                      <VirtualList
                        height={height}
                        width={width}
                        itemCount={filteredMessages.length}
                        itemSize={85}
                        ref={listRef}
                        onScroll={handleScroll}
                        overscanCount={8}
                        className="scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent w-full"
                      >
                        {renderRow}
                      </VirtualList>
                    )}
                  </AutoSizer>
                )}

            {!autoScroll && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <button
                  onClick={() => {
                    setAutoScroll(true);
                        if (listRef.current) {
                          listRef.current.scrollToItem(filteredMessages.length - 1);
                    }
                  }}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-4 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
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