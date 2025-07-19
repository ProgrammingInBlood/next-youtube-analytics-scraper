'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'analytics'>('dashboard');
  
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
  }, [startPolling, urls]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (pollingIntervals.chat) clearInterval(pollingIntervals.chat);
      if (pollingIntervals.metadata) clearInterval(pollingIntervals.metadata);
    };
  }, [pollingIntervals]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="main-container">
        {/* Page Header */}
        <div className="container-box mb-6">
          <div className="container-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h1 className="text-lg text-primary" style={{ marginBottom: '4px' }}>Live Stream Analytics Dashboard</h1>
                <p className="text-muted">Monitor and analyze chat from multiple YouTube live streams in real-time</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="status-indicator status-live">
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></div>
                  System Online
                </div>
                <div className="text-muted text-sm">
                  {chatMessages.length} messages • {metadata.filter(m => m.isLive).length} live streams
                </div>
              </div>
            </div>
            
            <UrlForm onSubmit={handleSubmit} loading={loading} />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="tab-nav mb-6">
          <div className="tab-list">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`tab-button ${activeTab === "chat" ? "active" : ""}`}
            >
              Live Chat
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`tab-button ${activeTab === "analytics" ? "active" : ""}`}
            >
              Analytics
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ minHeight: '400px' }}>
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-3" style={{ gap: '24px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <MetadataDisplay metadata={metadata} />
              </div>
              <div>
                <EngagementStats messages={chatMessages} />
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div className="container-box">
              <ChatDisplay messages={chatMessages} videoMetadata={metadata} />
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="container-box">
              <ChatAnalytics messages={chatMessages} metadata={metadata} />
            </div>
          )}
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(10, 10, 11, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
          }}>
            <div style={{ textAlign: 'center' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px' }}></div>
              <p className="text-lg text-primary">Loading streams...</p>
              <p className="text-muted text-sm">Connecting to YouTube Live API</p>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="error-box" style={{ marginTop: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
} 