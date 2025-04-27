'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { isValidYouTubeUrl, isValidYouTubeChannelUrl, fetchChannelLiveVideos, ChannelLiveVideo } from '../lib/api';

interface UrlFormProps {
  onSubmit: (urls: string[]) => void;
  loading: boolean;
}

// Maximum number of URLs to save in history
const MAX_HISTORY_ITEMS = 10;
// localStorage keys for each input
const STORAGE_KEY_PREFIX = 'youtube-chat-url';
const URL1_STORAGE_KEY = `${STORAGE_KEY_PREFIX}-1`;
const URL2_STORAGE_KEY = `${STORAGE_KEY_PREFIX}-2`;
const URL3_STORAGE_KEY = `${STORAGE_KEY_PREFIX}-3`;
const HISTORY_STORAGE_KEY = `${STORAGE_KEY_PREFIX}-history`;
// Previous session URLs key
const PREVIOUS_SESSION_KEY = `${STORAGE_KEY_PREFIX}-previous-session`;

export default function UrlForm({ onSubmit, loading }: UrlFormProps) {
  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('');
  const [url3, setUrl3] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [tracking, setTracking] = useState(false);
  
  // Add state for recent URLs history
  const [urlHistory, setUrlHistory] = useState<string[]>([]);
  const [showHistory1, setShowHistory1] = useState(false);
  const [showHistory2, setShowHistory2] = useState(false);
  const [showHistory3, setShowHistory3] = useState(false);
  
  // Add state for channel videos
  const [fetchingChannelVideos, setFetchingChannelVideos] = useState(false);
  const [channelVideos, setChannelVideos] = useState<ChannelLiveVideo[]>([]);
  const [showChannelVideos, setShowChannelVideos] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  
  // References to the dropdowns for closing on outside click
  const historyDropdownRef1 = useRef<HTMLDivElement>(null);
  const historyDropdownRef2 = useRef<HTMLDivElement>(null);
  const historyDropdownRef3 = useRef<HTMLDivElement>(null);
  const channelVideosDropdownRef = useRef<HTMLDivElement>(null);

  // Load URLs and history from localStorage on component mount
  useEffect(() => {
    try {
      // Load each URL from its own storage key
      const savedUrl1 = localStorage.getItem(URL1_STORAGE_KEY);
      const savedUrl2 = localStorage.getItem(URL2_STORAGE_KEY);
      const savedUrl3 = localStorage.getItem(URL3_STORAGE_KEY);
      
      if (savedUrl1) setUrl1(savedUrl1);
      if (savedUrl2) {
        setUrl2(savedUrl2);
        setExpanded(true);
      }
      if (savedUrl3) {
        setUrl3(savedUrl3);
        setExpanded(true);
      }
      
      // Load URL history
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        setUrlHistory(parsedHistory);
      }
    } catch (err) {
      console.error('Error loading URLs from localStorage:', err);
    }
  }, []);
  
  // Save URLs to localStorage when they change
  useEffect(() => {
    if (url1) localStorage.setItem(URL1_STORAGE_KEY, url1);
    if (url2) localStorage.setItem(URL2_STORAGE_KEY, url2);
    if (url3) localStorage.setItem(URL3_STORAGE_KEY, url3);
    
    // If URL is cleared, remove from localStorage
    if (!url1) localStorage.removeItem(URL1_STORAGE_KEY);
    if (!url2) localStorage.removeItem(URL2_STORAGE_KEY);
    if (!url3) localStorage.removeItem(URL3_STORAGE_KEY);
  }, [url1, url2, url3]);
  
  // Handle clicks outside the history dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check each dropdown
      if (historyDropdownRef1.current && !historyDropdownRef1.current.contains(event.target as Node)) {
        setShowHistory1(false);
      }
      if (historyDropdownRef2.current && !historyDropdownRef2.current.contains(event.target as Node)) {
        setShowHistory2(false);
      }
      if (historyDropdownRef3.current && !historyDropdownRef3.current.contains(event.target as Node)) {
        setShowHistory3(false);
      }
      if (channelVideosDropdownRef.current && !channelVideosDropdownRef.current.contains(event.target as Node)) {
        setShowChannelVideos(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save URL to history
  const saveToHistory = (urls: string[]) => {
    try {
      // Filter out empty URLs and only save valid ones
      const validUrls = urls.filter(url => url && isValidYouTubeUrl(url));
      
      if (validUrls.length === 0) return;
      
      // Create new history with duplicates removed and limited to max items
      const newHistory = [...new Set([...validUrls, ...urlHistory])]
        .slice(0, MAX_HISTORY_ITEMS);
      
      // Save to state and localStorage
      setUrlHistory(newHistory);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    } catch (err) {
      console.error('Error saving URL history to localStorage:', err);
    }
  };

  // Apply a URL from history
  const applyHistoryUrl = (url: string, inputNumber: 1 | 2 | 3) => {
    // Set URL to the appropriate input
    if (inputNumber === 1) {
      setUrl1(url);
      setShowHistory1(false);
    } else if (inputNumber === 2) {
      setUrl2(url);
      setShowHistory2(false);
    } else if (inputNumber === 3) {
      setUrl3(url);
      setShowHistory3(false);
    }
  };

  // Save current session before submitting
  const saveSessionUrls = () => {
    try {
      const sessionUrls = {
        url1,
        url2,
        url3
      };
      localStorage.setItem(PREVIOUS_SESSION_KEY, JSON.stringify(sessionUrls));
    } catch (err) {
      console.error('Error saving session URLs:', err);
    }
  };

  // Restore previous session
  const restorePreviousSession = () => {
    try {
      const savedSession = localStorage.getItem(PREVIOUS_SESSION_KEY);
      if (savedSession) {
        const { url1: prevUrl1, url2: prevUrl2, url3: prevUrl3 } = JSON.parse(savedSession);
        
        if (prevUrl1) setUrl1(prevUrl1);
        if (prevUrl2) {
          setUrl2(prevUrl2);
          setExpanded(true);
        }
        if (prevUrl3) {
          setUrl3(prevUrl3);
          setExpanded(true);
        }
      }
    } catch (err) {
      console.error('Error restoring previous session:', err);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Validate URLs
    if (!url1 && !url2 && !url3) {
      setError('Please enter at least one YouTube URL');
      return;
    }
    
    // Check if any of the URLs are channel URLs - those need to be processed differently
    const urls = [url1, url2, url3].filter(Boolean);
    const channelUrls = urls.filter(url => isValidYouTubeChannelUrl(url));
    
    if (channelUrls.length > 0) {
      setError('Please select specific live videos from the channel instead of using the channel URL directly');
      return;
    }
    
    // Validate that all provided URLs are valid YouTube URLs
    const invalidUrls = urls.filter(url => !isValidYouTubeUrl(url));
    
    if (invalidUrls.length > 0) {
      setError('Please enter valid YouTube video URLs');
      return;
    }
    
    // Save valid URLs to history
    saveToHistory(urls);
    
    // Save current session for restoration
    saveSessionUrls();
    
    setError(null);
    
    // Toggle tracking state
    setTracking(!tracking);
    
    // Submit the URLs to parent component
    onSubmit(urls);
  };

  const pasteFromClipboard = async (setter: (url: string) => void) => {
    try {
      const text = await navigator.clipboard.readText();
      if (isValidYouTubeUrl(text) || isValidYouTubeChannelUrl(text)) {
        setter(text);
      } else {
        setError('Clipboard content is not a valid YouTube URL');
      }
    } catch (error) {
      setError('Failed to read from clipboard');
    }
  };

  // Clear a specific input and its localStorage
  const clearInput = (inputNumber: 1 | 2 | 3) => {
    if (inputNumber === 1) {
      setUrl1('');
      localStorage.removeItem(URL1_STORAGE_KEY);
    } else if (inputNumber === 2) {
      setUrl2('');
      localStorage.removeItem(URL2_STORAGE_KEY);
    } else if (inputNumber === 3) {
      setUrl3('');
      localStorage.removeItem(URL3_STORAGE_KEY);
    }
  };

  // Clear all input fields and localStorage
  const clearAll = () => {
    setUrl1('');
    setUrl2('');
    setUrl3('');
    localStorage.removeItem(URL1_STORAGE_KEY);
    localStorage.removeItem(URL2_STORAGE_KEY);
    localStorage.removeItem(URL3_STORAGE_KEY);
    setTracking(false); // Also reset tracking state
  };

  // Clear history
  const clearHistory = () => {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    setUrlHistory([]);
    setShowHistory1(false);
    setShowHistory2(false);
    setShowHistory3(false);
  };

  // Render history dropdown for a specific input
  const renderHistoryDropdown = (inputNumber: 1 | 2 | 3) => {
    const dropdownRef = inputNumber === 1 
      ? historyDropdownRef1 
      : inputNumber === 2 
        ? historyDropdownRef2 
        : historyDropdownRef3;
    
    return (
      <div 
        ref={dropdownRef}
        className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Recent URLs</span>
          {urlHistory.length > 0 && (
            <button 
              type="button" 
              onClick={clearHistory}
              className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {urlHistory.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 p-3 text-center">No recent URLs</p>
          ) : (
            <ul>
              {urlHistory.map((url, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => applyHistoryUrl(url, inputNumber)}
                    className="w-full text-left p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded truncate"
                  >
                    {url}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  // Get button text based on state
  const getButtonText = () => {
    if (loading) return "Processing...";
    if (tracking) return "Stop Tracking";
    return "Start Tracking";
  };

  // Get button icon based on state
  const getButtonIcon = () => {
    if (loading) {
      return (
        <svg className="animate-spin size-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      );
    }
    
    if (tracking) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      );
    }
    
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  // Fetch live videos from a YouTube channel
  const fetchChannelVideosHandler = async (channelUrl: string) => {
    if (!isValidYouTubeChannelUrl(channelUrl)) {
      setError('Please enter a valid YouTube channel URL');
      return;
    }
    
    setError(null);
    setFetchingChannelVideos(true);
    setShowChannelVideos(true);
    
    try {
      const result = await fetchChannelLiveVideos(channelUrl);
      
      if (result.error) {
        setError(result.error);
        setChannelVideos([]);
      } else if (result.videos.length === 0) {
        setError('No live videos found on this channel');
        setChannelVideos([]);
      } else {
        setChannelVideos(result.videos);
      }
    } catch (fetchError) {
      console.error('Error fetching channel videos:', fetchError);
      setError('Failed to fetch live videos from channel');
      setChannelVideos([]);
    } finally {
      setFetchingChannelVideos(false);
    }
  };
  
  // Select a video from the channel videos dropdown
  const selectChannelVideo = (videoUrl: string, inputNumber: 1 | 2 | 3) => {
    if (inputNumber === 1) {
      setUrl1(videoUrl);
    } else if (inputNumber === 2) {
      setUrl2(videoUrl);
    } else if (inputNumber === 3) {
      setUrl3(videoUrl);
    }
    
    setShowChannelVideos(false);
    setChannelVideos([]);
  };

  // Render channel videos dropdown
  const renderChannelVideosDropdown = (inputNumber: 1 | 2 | 3) => {
    return (
      <div 
        ref={channelVideosDropdownRef}
        className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Live Videos from Channel</span>
          <button 
            type="button" 
            onClick={() => setShowChannelVideos(false)}
            className="text-xs text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Close
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {fetchingChannelVideos ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin size-5 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Fetching live videos...</span>
            </div>
          ) : channelVideos.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 p-3 text-center">No live videos found</p>
          ) : (
            <ul className="space-y-2">
              {channelVideos.map((video) => (
                <li key={video.videoId}>
                  <button
                    type="button"
                    onClick={() => selectChannelVideo(video.videoUrl, inputNumber)}
                    className="w-full text-left p-2 text-sm bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3"
                  >
                    <img 
                      src={video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`} 
                      alt={video.title} 
                      className="w-16 h-9 object-cover rounded flex-shrink-0"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to default thumbnail if error loading
                        const target = e.target as HTMLImageElement;
                        target.src = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
                        // If that also fails, use a placeholder
                        target.onerror = () => {
                          target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23333'/%3E%3C/svg%3E";
                          target.onerror = null;
                        };
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{video.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{video.channelName}</span>
                        <span>•</span>
                        <span>{video.viewCount.toLocaleString()} viewers</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-4">
        <div className="relative">
          <div className="flex">
            <input
              type="text"
              id="url1"
              value={url1}
              onChange={e => setUrl1(e.target.value)}
              placeholder="Enter YouTube URL (video or channel)"
              className="w-full px-4 py-3 pr-36 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-shadow shadow-sm focus:shadow-md"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <button
                type="button"
                onClick={() => clearInput(1)}
                className="px-2 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors"
                aria-label="Clear URL"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowHistory1(!showHistory1);
                  setShowHistory2(false);
                  setShowHistory3(false);
                  setShowChannelVideos(false);
                }}
                className="px-2 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 font-medium transition-colors"
                aria-label="Show recent URLs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {isValidYouTubeChannelUrl(url1) && (
                <button
                  type="button"
                  onClick={() => fetchChannelVideosHandler(url1)}
                  className="px-3 py-1.5 text-sm rounded-lg text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 font-medium transition-colors flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Get Lives
                </button>
              )}
              <button
                type="button"
                onClick={() => pasteFromClipboard(setUrl1)}
                className="px-3 py-1.5 text-sm rounded-lg text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Paste
              </button>
            </div>
          </div>
          
          {/* Recent URLs dropdown for input 1 */}
          {showHistory1 && renderHistoryDropdown(1)}
          
          {/* Channel videos dropdown */}
          {showChannelVideos && renderChannelVideosDropdown(1)}
        </div>
        
        {expanded ? (
          <>
            <div className="relative">
              <div className="flex">
                <input
                  type="text"
                  id="url2"
                  value={url2}
                  onChange={e => setUrl2(e.target.value)}
                  placeholder="Enter YouTube URL (video or channel)"
                  className="w-full px-4 py-3 pr-36 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-shadow shadow-sm focus:shadow-md"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => clearInput(2)}
                    className="px-2 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors"
                    aria-label="Clear URL"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHistory2(!showHistory2);
                      setShowHistory1(false);
                      setShowHistory3(false);
                      setShowChannelVideos(false);
                    }}
                    className="px-2 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 font-medium transition-colors"
                    aria-label="Show recent URLs"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  {isValidYouTubeChannelUrl(url2) && (
                    <button
                      type="button"
                      onClick={() => fetchChannelVideosHandler(url2)}
                      className="px-3 py-1.5 text-sm rounded-lg text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 font-medium transition-colors flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Get Lives
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => pasteFromClipboard(setUrl2)}
                    className="px-3 py-1.5 text-sm rounded-lg text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Paste
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Recent URLs dropdown for input 2 */}
              {showHistory2 && renderHistoryDropdown(2)}
              
              {/* Channel videos dropdown */}
              {showChannelVideos && renderChannelVideosDropdown(2)}
            </div>
            
            <div className="relative">
              <div className="flex">
                <input
                  type="text"
                  id="url3"
                  value={url3}
                  onChange={e => setUrl3(e.target.value)}
                  placeholder="Enter YouTube URL (video or channel)"
                  className="w-full px-4 py-3 pr-36 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-shadow shadow-sm focus:shadow-md"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => clearInput(3)}
                    className="px-2 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors"
                    aria-label="Clear URL"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHistory3(!showHistory3);
                      setShowHistory1(false);
                      setShowHistory2(false);
                      setShowChannelVideos(false);
                    }}
                    className="px-2 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 font-medium transition-colors"
                    aria-label="Show recent URLs"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  {isValidYouTubeChannelUrl(url3) && (
                    <button
                      type="button"
                      onClick={() => fetchChannelVideosHandler(url3)}
                      className="px-3 py-1.5 text-sm rounded-lg text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 font-medium transition-colors flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Get Lives
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => pasteFromClipboard(setUrl3)}
                    className="px-3 py-1.5 text-sm rounded-lg text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Paste
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Recent URLs dropdown for input 3 */}
              {showHistory3 && renderHistoryDropdown(3)}
              
              {/* Channel videos dropdown */}
              {showChannelVideos && renderChannelVideosDropdown(3)}
            </div>
          </>
        ) : (
          <button 
            type="button" 
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add more URLs
          </button>
        )}
        
        {error && (
          <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2.5 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearAll}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm py-2 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear All
            </button>
            
            <button
              type="button"
              onClick={restorePreviousSession}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm py-2 px-4 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Previous URLs
            </button>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={`${
              tracking 
                ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/20 hover:shadow-red-500/30' 
                : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/20 hover:shadow-blue-500/30'
            } text-white px-6 py-3 rounded-xl disabled:opacity-70 transition-all font-medium text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl`}
          >
            {getButtonIcon()}
            {getButtonText()}
          </button>
        </div>
      </div>
    </form>
  );
} 