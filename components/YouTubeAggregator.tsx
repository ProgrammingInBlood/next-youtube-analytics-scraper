'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, MessageSquare, BarChart3, AlertCircle, Zap, Loader2 } from 'lucide-react';
import UrlForm from './UrlForm';
import ChatDisplay from './ChatDisplay';
import MetadataDisplay from './MetadataDisplay';
import EngagementStats from './EngagementStats';
import ChatAnalytics from './ChatAnalytics';

// Constants for optimization
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAX_MESSAGES = 5000; // Maximum number of messages to keep in memory
const PRUNE_THRESHOLD = 4000; // When to trigger pruning
const PRUNE_TARGET = 3000; // Number of messages to keep after pruning
const MESSAGE_BATCH_SIZE = 200; // Number of messages to request per batch

interface VideoMetadata {
  videoId: string;
  videoUrl: string;
  title?: string;
  channelName?: string;
  viewCount: number;
  likeCount: number;
  isLive: boolean;
  error?: string;
}

interface ChatMessage {
  id: string;
  message: string;
  authorName: string;
  authorChannelId: string;
  timestamp: string;
  userType?: 'moderator' | 'member' | 'owner' | 'regular';
  profileImage?: string;
  emojis?: {
    url: string;
    label: string;
    emojiId: string;
  }[];
  sourceVideo: {
    url: string;
    id: string;
    title?: string;
  };
}

const TAB_ITEMS = [
  { key: 'chat', label: 'Live Chat', icon: MessageSquare },
  { key: 'dashboard', label: 'Streams', icon: Radio },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const;

export default function YouTubeAggregator() {
  // State management
  const [urls, setUrls] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [metadata, setMetadata] = useState<VideoMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingIntervals, setPollingIntervals] = useState<{chat: NodeJS.Timeout | null, metadata: NodeJS.Timeout | null}>({
    chat: null,
    metadata: null
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'analytics'>('chat');
  const [showUrlPanel, setShowUrlPanel] = useState(true);
  
  // Track non-live URLs to avoid polling them
  const [nonLiveUrls, setNonLiveUrls] = useState<string[]>([]);
  
  // References to track the latest state without triggering re-renders
  const messagesRef = useRef<ChatMessage[]>([]);
  const urlsRef = useRef<string[]>([]);
  const nonLiveUrlsRef = useRef<string[]>([]);
  
  // Update refs when state changes
  useEffect(() => {
    messagesRef.current = chatMessages;
    urlsRef.current = urls;
    nonLiveUrlsRef.current = nonLiveUrls;
  }, [chatMessages, urls, nonLiveUrls]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getExistingMessageIds = useCallback(() => {
    return messagesRef.current.map(msg => msg.id);
  }, []);

  // Function to safely update messages with debouncing and memory management
  const updateMessages = useCallback((newMessages: ChatMessage[]) => {
    if (newMessages.length === 0) return;
    
    setChatMessages(prevMessages => {
      // Create a map for efficient lookup
      const messagesMap = new Map<string, ChatMessage>();
      
      // Add existing messages to map
      prevMessages.forEach(msg => {
        messagesMap.set(msg.id, msg);
      });
      
      // Process and add new messages, ensuring no duplicates
      newMessages.forEach(msg => {
        // Only add if not already in our collection
        if (!messagesMap.has(msg.id)) {
          // Process message to ensure expected fields
          const processedMsg: ChatMessage = {
            ...msg,
            userType: msg.userType || 'regular',
            profileImage: msg.profileImage || undefined
          };
          messagesMap.set(msg.id, processedMsg);
        }
      });
      
      // Convert map to array
      let combinedMessages = Array.from(messagesMap.values());
      
      // Sort by timestamp
      combinedMessages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Handle memory management - if too many messages, prune older ones
      if (combinedMessages.length > PRUNE_THRESHOLD) {
        combinedMessages = combinedMessages.slice(-PRUNE_TARGET);
      }
      
      return combinedMessages;
    });
  }, []);

  // Function to fetch chat messages from the backend - optimized
  const fetchChatMessages = useCallback(async (videoUrls: string[]) => {
    try {
      // Don't make API call if there are no URLs to fetch
      if (videoUrls.length === 0) {
        return;
      }
      
      // Get timestamp of most recent message if exists
      const latestMessage = messagesRef.current.length > 0 
        ? messagesRef.current[messagesRef.current.length - 1]
        : null;
      
      const lastMessageTimestamp = latestMessage?.timestamp;
      
      // Get a sample of existing IDs to avoid duplicates (sending all IDs could be too much)
      const recentMessageIds = messagesRef.current
        .slice(-300) // Only use the last 300 messages for deduplication
        .map(msg => msg.id);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/live-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          urls: videoUrls,
          pageSize: MESSAGE_BATCH_SIZE,
          after: lastMessageTimestamp,
          messageIds: recentMessageIds
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chat messages');
      }

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }

      // Check for errors and identify non-live URLs
      if (data.errors && Array.isArray(data.errors)) {
        const newNonLiveUrls: string[] = [];
        
        data.errors.forEach((errorMsg: string) => {
          // Extract URL from error message
          const urlMatch = errorMsg.match(/https?:\/\/[^\s:"]+/);
          if (urlMatch) {
            const failedUrl = urlMatch[0];
            
            // Check if error indicates video is not live
            if (errorMsg.includes('Failed to fetch live chat') || 
                errorMsg.includes('400 Bad Request') || 
                errorMsg.includes('not a live video')) {
              
              // Add to non-live URLs if not already there
              if (!nonLiveUrlsRef.current.includes(failedUrl)) {
                newNonLiveUrls.push(failedUrl);
              }
            }
          }
        });
        
        // Update non-live URLs state if new ones were found
        if (newNonLiveUrls.length > 0) {
          setNonLiveUrls(prev => [...prev, ...newNonLiveUrls]);
          
          // Show error about non-live videos
          if (newNonLiveUrls.length === videoUrls.length) {
            setError('None of the provided URLs are live streams. Please provide URLs to active live streams.');
          } else {
            setError(`Some URLs are not live streams and will be ignored: ${newNonLiveUrls.join(', ')}`);
            // Clear error after 5 seconds
            setTimeout(() => setError(null), 5000);
          }
        }
      }

      // Update with new messages
      if (data.messages && data.messages.length > 0) {
        updateMessages(data.messages);
      }
      
    } catch (error) {
      console.error('Error fetching chat:', error);
      setError('Failed to fetch chat messages. Please try again.');
    }
  }, [updateMessages]);

  // Function to fetch video metadata from the backend - optimized
  const fetchMetadata = useCallback(async (videoUrls: string[]) => {
    try {
      // Don't make API call if there are no URLs to fetch
      if (videoUrls.length === 0) {
        return;
      }
      //use process.env.NEXT_PUBLIC_API_URL
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/video-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls: videoUrls }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch video metadata');
      }

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }

      // Check if any videos are not live and mark them
      const newNonLiveUrls: string[] = [];
      
      if (data.metadata && Array.isArray(data.metadata)) {
        data.metadata.forEach((meta: VideoMetadata) => {
          if (!meta.isLive && meta.videoUrl && !nonLiveUrlsRef.current.includes(meta.videoUrl)) {
            newNonLiveUrls.push(meta.videoUrl);
          }
        });
        
        // Update non-live URLs
        if (newNonLiveUrls.length > 0) {
          setNonLiveUrls(prev => [...prev, ...newNonLiveUrls]);
        }
      }

      // Merge new metadata with existing metadata
      setMetadata(prevMetadata => {
        // Create a map of existing metadata for quick lookup
        const metadataMap = new Map(
          prevMetadata.map(item => [item.videoId, item])
        );
        
        // Update the map with new metadata
        data.metadata.forEach((item: VideoMetadata) => {
          metadataMap.set(item.videoId, item);
        });
        
        // Convert map back to array
        return Array.from(metadataMap.values());
      });
      
    } catch (error) {
      console.error('Error fetching metadata:', error);
      setError('Failed to fetch video metadata. Please try again.');
    }
  }, []);

  // Start polling with optimized interval management
  const startPolling = useCallback((videoUrls: string[]) => {
    // Clear any existing polling
    if (pollingIntervals.chat) clearInterval(pollingIntervals.chat);
    if (pollingIntervals.metadata) clearInterval(pollingIntervals.metadata);

    // Reset non-live URLs when starting new polling
    setNonLiveUrls([]);

    // Initial fetch
    fetchChatMessages(videoUrls);
    fetchMetadata(videoUrls);

    // Set up polling intervals with staggered timing
    const chatInterval = setInterval(() => {
      // Get latest URLs that aren't marked as non-live
      const liveUrls = urlsRef.current.filter(url => !nonLiveUrlsRef.current.includes(url));
      
      // Only continue polling if there are live URLs
      if (liveUrls.length > 0) {
        fetchChatMessages(liveUrls);
      } else {
        // Clear interval if no live URLs remain
        if (pollingIntervals.chat) clearInterval(pollingIntervals.chat);
        if (pollingIntervals.metadata) clearInterval(pollingIntervals.metadata);
        setPollingIntervals({ chat: null, metadata: null });
        setError('No active live streams found. Please provide URLs to active live streams.');
      }
    }, 5000); // Poll chat every 5 seconds

    const metadataInterval = setInterval(() => {
      // Get latest URLs that aren't marked as non-live
      const liveUrls = urlsRef.current.filter(url => !nonLiveUrlsRef.current.includes(url));
      
      // Only continue polling if there are live URLs
      if (liveUrls.length > 0) {
        fetchMetadata(liveUrls);
      }
    }, 10000); // Poll metadata every 10 seconds

    // Store the interval IDs
    setPollingIntervals({
      chat: chatInterval as unknown as NodeJS.Timeout,
      metadata: metadataInterval as unknown as NodeJS.Timeout
    });
  }, [fetchChatMessages, fetchMetadata, pollingIntervals]);

  // Handle form submission with optimized state management
  const handleSubmit = useCallback((submittedUrls: string[]) => {
    setLoading(true);
    
    // Clear chat messages as they're timestamp dependent
    setChatMessages([]);
    
    // Reset error state
    setError(null);
    
    // Reset non-live URLs when new URLs are submitted
    setNonLiveUrls([]);
    
    // Update URLs
    setUrls(submittedUrls);
    urlsRef.current = submittedUrls;
    
    // Only clear metadata for URLs that are no longer in the list
    setMetadata(prevMetadata => {
      // If there were no previous URLs, just clear all metadata
      if (urls.length === 0) return [];
      
      // Keep only metadata for videos that are still in the URL list
      const videoIdsFromUrls = submittedUrls.map(url => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
        return match?.[1] || '';
      }).filter(id => id);
      
      return prevMetadata.filter(meta => videoIdsFromUrls.includes(meta.videoId));
    });
    
    // Start fetching data
    startPolling(submittedUrls);
    setLoading(false);
    setShowUrlPanel(false);
    setActiveTab('chat');
  }, [startPolling, urls]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (pollingIntervals.chat) clearInterval(pollingIntervals.chat);
      if (pollingIntervals.metadata) clearInterval(pollingIntervals.metadata);
    };
  }, [pollingIntervals]);

  const liveCount = metadata.filter(m => m.isLive).length;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-base)] text-[var(--foreground)]">
      {/* ── Top Navigation Bar ── */}
      <header className="flex items-center justify-between h-12 px-4 bg-[var(--bg-alt)] border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[var(--accent)]" />
            <span className="text-base font-extrabold tracking-tight text-[var(--text-base)]">ChatFusion</span>
          </div>
          <span className="hidden sm:inline-block w-px h-5 bg-[var(--border)]" />
          <span className="hidden sm:inline text-xs text-[var(--text-muted)] font-medium">Multi-Stream Chat</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Tab navigation */}
          {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as 'dashboard' | 'chat' | 'analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === key
                  ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}

          <span className="w-px h-5 bg-[var(--border)] mx-1" />

          {/* Toggle URL panel */}
          <button
            onClick={() => setShowUrlPanel(!showUrlPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              showUrlPanel 
                ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Setup</span>
          </button>

          {/* Live status */}
          {liveCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--red-muted)] text-[var(--red)] text-[11px] font-bold ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)] animate-live" />
              {liveCount} LIVE
            </div>
          )}

          {/* Message count */}
          {chatMessages.length > 0 && (
            <span className="text-[11px] text-[var(--text-muted)] font-medium tabular-nums ml-1">
              {chatMessages.length.toLocaleString()} msgs
            </span>
          )}
        </div>
      </header>

      {/* ── URL Setup Panel (collapsible) ── */}
      {showUrlPanel && (
        <div className="border-b border-[var(--border)] bg-[var(--bg-alt)] px-4 py-3 animate-fade-in">
          <div className="max-w-3xl mx-auto">
            <UrlForm onSubmit={handleSubmit} loading={loading} />
          </div>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--red-muted)] border-b border-[var(--red)]/20 text-[var(--red)] text-xs font-medium animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-[var(--red)] hover:text-white text-xs font-bold px-1">✕</button>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'chat' && (
          <ChatDisplay messages={chatMessages} videoMetadata={metadata} />
        )}

        {activeTab === 'dashboard' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <MetadataDisplay metadata={metadata} />
              </div>
              <div>
                <EngagementStats messages={chatMessages} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="max-w-6xl mx-auto">
              <ChatAnalytics messages={chatMessages} metadata={metadata} />
            </div>
          </div>
        )}
      </main>

      {/* ── Loading Overlay ── */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/80 backdrop-blur-sm">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--text-base)]">Connecting to streams...</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Fetching live chat data</p>
          </div>
        </div>
      )}
    </div>
  );
} 