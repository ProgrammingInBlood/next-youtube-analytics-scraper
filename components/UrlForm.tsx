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
        className="container-box"
        style={{
          position: 'absolute',
          zIndex: 20,
          marginTop: '4px',
          width: '100%',
          maxHeight: '300px',
          overflow: 'hidden'
        }}
      >
        <div className="container-section" style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-sm text-secondary">Recent URLs</span>
            {urlHistory.length > 0 && (
              <button 
                type="button" 
                onClick={clearHistory}
                className="btn btn-secondary text-xs"
                style={{ padding: '4px 8px' }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>
        <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
          {urlHistory.length === 0 ? (
            <p className="text-sm text-muted" style={{ padding: '12px', textAlign: 'center' }}>No recent URLs</p>
          ) : (
            <div>
              {urlHistory.map((url, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => applyHistoryUrl(url, inputNumber)}
                  className="btn btn-secondary text-sm"
                  style={{ 
                    width: '100%', 
                    textAlign: 'left', 
                    margin: '2px', 
                    padding: '8px 12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {url}
                </button>
              ))}
            </div>
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
        <div className="loading-spinner"></div>
      );
    }
    
    if (tracking) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h12v12H6V6z"/>
        </svg>
      );
    }
    
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
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
        className="container-box"
        style={{
          position: 'absolute',
          zIndex: 30,
          marginTop: '4px',
          width: '100%',
          maxHeight: '400px',
          overflow: 'hidden'
        }}
      >
        <div className="container-section" style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-sm text-secondary">Live Videos from Channel</span>
            <button 
              type="button" 
              onClick={() => setShowChannelVideos(false)}
              className="btn btn-secondary text-xs"
              style={{ padding: '4px 8px' }}
            >
              Close
            </button>
          </div>
        </div>
        <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px' }}>
          {fetchingChannelVideos ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <div className="loading-spinner" style={{ marginRight: '8px' }}></div>
              <span className="text-sm text-secondary">Fetching live videos...</span>
            </div>
          ) : channelVideos.length === 0 ? (
            <p className="text-sm text-muted" style={{ padding: '12px', textAlign: 'center' }}>No live videos found</p>
          ) : (
            <div className="space-y-4">
              {channelVideos.map((video) => (
                <button
                  key={video.videoId}
                  type="button"
                  onClick={() => selectChannelVideo(video.videoUrl, inputNumber)}
                  className="container-box"
                  style={{ 
                    width: '100%', 
                    textAlign: 'left', 
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <img 
                    src={video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`} 
                    alt={video.title} 
                    style={{ 
                      width: '64px', 
                      height: '36px', 
                      objectFit: 'cover',
                      border: '1px solid var(--border)',
                      flexShrink: 0
                    }}
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
                      target.onerror = () => {
                        target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23333'/%3E%3C/svg%3E";
                        target.onerror = null;
                      };
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="text-sm text-primary" style={{ marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="text-xs text-muted">
                      <span>{video.channelName}</span>
                      <span>•</span>
                      <span>{video.viewCount.toLocaleString()} viewers</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex' }}>
            <input
              type="text"
              id="url1"
              value={url1}
              onChange={e => setUrl1(e.target.value)}
              placeholder="Enter YouTube URL (video or channel)"
              className="input"
              style={{ paddingRight: '160px' }}
            />
            <div style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => clearInput(1)}
                className="btn btn-secondary"
                style={{ padding: '6px 8px' }}
                aria-label="Clear URL"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
                className="btn btn-secondary"
                style={{ padding: '6px 8px' }}
                aria-label="Show recent URLs"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              {isValidYouTubeChannelUrl(url1) && (
                <button
                  type="button"
                  onClick={() => fetchChannelVideosHandler(url1)}
                  className="btn btn-primary text-xs"
                  style={{ padding: '6px 8px' }}
                >
                  Live
                </button>
              )}
              <button
                type="button"
                onClick={() => pasteFromClipboard(setUrl1)}
                className="btn btn-primary text-xs"
                style={{ padding: '6px 8px' }}
              >
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
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex' }}>
                <input
                  type="text"
                  id="url2"
                  value={url2}
                  onChange={e => setUrl2(e.target.value)}
                  placeholder="Enter YouTube URL (video or channel)"
                  className="input"
                  style={{ paddingRight: '160px' }}
                />
                <div style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  gap: '4px'
                }}>
                  <button
                    type="button"
                    onClick={() => clearInput(2)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 8px' }}
                    aria-label="Clear URL"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
                    className="btn btn-secondary"
                    style={{ padding: '6px 8px' }}
                    aria-label="Show recent URLs"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {isValidYouTubeChannelUrl(url2) && (
                    <button
                      type="button"
                      onClick={() => fetchChannelVideosHandler(url2)}
                      className="btn btn-primary text-xs"
                      style={{ padding: '6px 8px' }}
                    >
                      Live
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => pasteFromClipboard(setUrl2)}
                    className="btn btn-primary text-xs"
                    style={{ padding: '6px 8px' }}
                  >
                    Paste
                  </button>
                </div>
              </div>
              
              {/* Recent URLs dropdown for input 2 */}
              {showHistory2 && renderHistoryDropdown(2)}
              
              {/* Channel videos dropdown */}
              {showChannelVideos && renderChannelVideosDropdown(2)}
            </div>
            
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex' }}>
                <input
                  type="text"
                  id="url3"
                  value={url3}
                  onChange={e => setUrl3(e.target.value)}
                  placeholder="Enter YouTube URL (video or channel)"
                  className="input"
                  style={{ paddingRight: '160px' }}
                />
                <div style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  gap: '4px'
                }}>
                  <button
                    type="button"
                    onClick={() => clearInput(3)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 8px' }}
                    aria-label="Clear URL"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
                    className="btn btn-secondary"
                    style={{ padding: '6px 8px' }}
                    aria-label="Show recent URLs"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {isValidYouTubeChannelUrl(url3) && (
                    <button
                      type="button"
                      onClick={() => fetchChannelVideosHandler(url3)}
                      className="btn btn-primary text-xs"
                      style={{ padding: '6px 8px' }}
                    >
                      Live
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => pasteFromClipboard(setUrl3)}
                    className="btn btn-primary text-xs"
                    style={{ padding: '6px 8px' }}
                  >
                    Paste
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
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add more URLs
          </button>
        )}
        
        {error && (
          <div className="error-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={clearAll}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Clear All
            </button>
            
            <button
              type="button"
              onClick={restorePreviousSession}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Previous URLs
            </button>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={`btn ${tracking ? 'btn-secondary' : 'btn-primary'}`}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '10px 20px',
              opacity: loading ? 0.7 : 1
            }}
          >
            {getButtonIcon()}
            {getButtonText()}
          </button>
        </div>
      </div>
    </form>
  );
} 