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
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="container mx-auto p-4 md:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex items-center">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-2 rounded-lg mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                <rect x="2" y="9" width="4" height="12"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">ChatFusion</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a 
              href="https://github.com/yourusername/chat-fusion" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm px-3 py-1 rounded-md hover:bg-gray-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
              GitHub
            </a>
          </div>
        </div>

        <UrlForm onSubmit={handleSubmit} loading={loading} />

        <div className="mt-6">
          <div className="border-b border-gray-800">
            <nav className="flex -mb-px overflow-x-auto">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`mr-4 py-3 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === "dashboard"
                    ? "border-purple-500 text-purple-500"
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={`mr-4 py-3 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === "chat"
                    ? "border-purple-500 text-purple-500"
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                Live Chat
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`py-3 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === "analytics"
                    ? "border-purple-500 text-purple-500"
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                Analytics
              </button>
            </nav>
          </div>

          <div className="mt-6">
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  <MetadataDisplay metadata={metadata} />
                </div>
                <div>
                  <EngagementStats messages={chatMessages} />
                </div>
              </div>
            )}

            {activeTab === "chat" && (
              <div>
                <ChatDisplay messages={chatMessages} videoMetadata={metadata} />
              </div>
            )}

            {activeTab === "analytics" && (
              <div>
                <ChatAnalytics messages={chatMessages} metadata={metadata} />
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="fixed inset-0 bg-gray-950/80 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-gray-700 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg font-medium text-white">Loading streams...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-6 py-4 rounded-lg shadow-md flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
} 