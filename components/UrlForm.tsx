'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { isValidYouTubeUrl, isValidYouTubeChannelUrl, fetchChannelLiveVideos, ChannelLiveVideo } from '../lib/api';
import { X, Clock, Plus, Clipboard, Play, Square, Trash2, RotateCcw, Loader2, AlertCircle, Tv } from 'lucide-react';

interface UrlFormProps {
  onSubmit: (urls: string[]) => void;
  loading: boolean;
}

// Maximum number of URLs to save in history
const MAX_HISTORY_ITEMS = 10;
const STORAGE_KEY_PREFIX = 'youtube-chat-url';
const URL1_STORAGE_KEY = `${STORAGE_KEY_PREFIX}-1`;
const URL2_STORAGE_KEY = `${STORAGE_KEY_PREFIX}-2`;
const URL3_STORAGE_KEY = `${STORAGE_KEY_PREFIX}-3`;
const HISTORY_STORAGE_KEY = `${STORAGE_KEY_PREFIX}-history`;
const PREVIOUS_SESSION_KEY = `${STORAGE_KEY_PREFIX}-previous-session`;

const inputClass = "h-9 w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 pr-24 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors";
const iconBtnClass = "flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-muted)] hover:text-[var(--text-base)] hover:bg-[var(--bg-hover)] transition-colors";
const pillBtnClass = "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors";

export default function UrlForm({ onSubmit, loading }: UrlFormProps) {
  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('');
  const [url3, setUrl3] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [tracking, setTracking] = useState(false);
  
  const [urlHistory, setUrlHistory] = useState<string[]>([]);
  const [showHistory1, setShowHistory1] = useState(false);
  const [showHistory2, setShowHistory2] = useState(false);
  const [showHistory3, setShowHistory3] = useState(false);
  
  const [fetchingChannelVideos, setFetchingChannelVideos] = useState(false);
  const [channelVideos, setChannelVideos] = useState<ChannelLiveVideo[]>([]);
  const [showChannelVideos, setShowChannelVideos] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  
  const historyDropdownRef1 = useRef<HTMLDivElement>(null);
  const historyDropdownRef2 = useRef<HTMLDivElement>(null);
  const historyDropdownRef3 = useRef<HTMLDivElement>(null);
  const channelVideosDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const savedUrl1 = localStorage.getItem(URL1_STORAGE_KEY);
      const savedUrl2 = localStorage.getItem(URL2_STORAGE_KEY);
      const savedUrl3 = localStorage.getItem(URL3_STORAGE_KEY);
      if (savedUrl1) setUrl1(savedUrl1);
      if (savedUrl2) { setUrl2(savedUrl2); setExpanded(true); }
      if (savedUrl3) { setUrl3(savedUrl3); setExpanded(true); }
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) setUrlHistory(JSON.parse(savedHistory));
    } catch (err) { console.error('Error loading URLs:', err); }
  }, []);
  
  useEffect(() => {
    if (url1) localStorage.setItem(URL1_STORAGE_KEY, url1); else localStorage.removeItem(URL1_STORAGE_KEY);
    if (url2) localStorage.setItem(URL2_STORAGE_KEY, url2); else localStorage.removeItem(URL2_STORAGE_KEY);
    if (url3) localStorage.setItem(URL3_STORAGE_KEY, url3); else localStorage.removeItem(URL3_STORAGE_KEY);
  }, [url1, url2, url3]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyDropdownRef1.current && !historyDropdownRef1.current.contains(event.target as Node)) setShowHistory1(false);
      if (historyDropdownRef2.current && !historyDropdownRef2.current.contains(event.target as Node)) setShowHistory2(false);
      if (historyDropdownRef3.current && !historyDropdownRef3.current.contains(event.target as Node)) setShowHistory3(false);
      if (channelVideosDropdownRef.current && !channelVideosDropdownRef.current.contains(event.target as Node)) setShowChannelVideos(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveToHistory = (urls: string[]) => {
    try {
      const validUrls = urls.filter(url => url && isValidYouTubeUrl(url));
      if (validUrls.length === 0) return;
      const newHistory = [...new Set([...validUrls, ...urlHistory])].slice(0, MAX_HISTORY_ITEMS);
      setUrlHistory(newHistory);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    } catch (err) { console.error('Error saving URL history:', err); }
  };

  const applyHistoryUrl = (url: string, inputNumber: 1 | 2 | 3) => {
    if (inputNumber === 1) { setUrl1(url); setShowHistory1(false); }
    else if (inputNumber === 2) { setUrl2(url); setShowHistory2(false); }
    else { setUrl3(url); setShowHistory3(false); }
  };

  const saveSessionUrls = () => {
    try { localStorage.setItem(PREVIOUS_SESSION_KEY, JSON.stringify({ url1, url2, url3 })); }
    catch (err) { console.error('Error saving session:', err); }
  };

  const restorePreviousSession = () => {
    try {
      const saved = localStorage.getItem(PREVIOUS_SESSION_KEY);
      if (saved) {
        const { url1: p1, url2: p2, url3: p3 } = JSON.parse(saved);
        if (p1) setUrl1(p1);
        if (p2) { setUrl2(p2); setExpanded(true); }
        if (p3) { setUrl3(p3); setExpanded(true); }
      }
    } catch (err) { console.error('Error restoring session:', err); }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!url1 && !url2 && !url3) { setError('Please enter at least one YouTube URL'); return; }
    const urls = [url1, url2, url3].filter(Boolean);
    if (urls.some(url => isValidYouTubeChannelUrl(url))) { setError('Use specific live video URLs, not channel URLs'); return; }
    if (urls.some(url => !isValidYouTubeUrl(url))) { setError('Please enter valid YouTube video URLs'); return; }
    saveToHistory(urls);
    saveSessionUrls();
    setError(null);
    setTracking(!tracking);
    onSubmit(urls);
  };

  const pasteFromClipboard = async (setter: (url: string) => void) => {
    try {
      const text = await navigator.clipboard.readText();
      if (isValidYouTubeUrl(text) || isValidYouTubeChannelUrl(text)) setter(text);
      else setError('Clipboard content is not a valid YouTube URL');
    } catch { setError('Failed to read from clipboard'); }
  };

  const clearInput = (n: 1 | 2 | 3) => {
    if (n === 1) { setUrl1(''); localStorage.removeItem(URL1_STORAGE_KEY); }
    else if (n === 2) { setUrl2(''); localStorage.removeItem(URL2_STORAGE_KEY); }
    else { setUrl3(''); localStorage.removeItem(URL3_STORAGE_KEY); }
  };

  const clearAll = () => {
    setUrl1(''); setUrl2(''); setUrl3('');
    localStorage.removeItem(URL1_STORAGE_KEY);
    localStorage.removeItem(URL2_STORAGE_KEY);
    localStorage.removeItem(URL3_STORAGE_KEY);
    setTracking(false);
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    setUrlHistory([]);
    setShowHistory1(false); setShowHistory2(false); setShowHistory3(false);
  };

  const fetchChannelVideosHandler = async (channelUrl: string) => {
    if (!isValidYouTubeChannelUrl(channelUrl)) { setError('Enter a valid YouTube channel URL'); return; }
    setError(null); setFetchingChannelVideos(true); setShowChannelVideos(true);
    try {
      const result = await fetchChannelLiveVideos(channelUrl);
      if (result.error) { setError(result.error); setChannelVideos([]); }
      else if (result.videos.length === 0) { setError('No live videos found'); setChannelVideos([]); }
      else setChannelVideos(result.videos);
    } catch { setError('Failed to fetch live videos'); setChannelVideos([]); }
    finally { setFetchingChannelVideos(false); }
  };
  
  const selectChannelVideo = (videoUrl: string, inputNumber: 1 | 2 | 3) => {
    if (inputNumber === 1) setUrl1(videoUrl);
    else if (inputNumber === 2) setUrl2(videoUrl);
    else setUrl3(videoUrl);
    setShowChannelVideos(false); setChannelVideos([]);
  };

  // ── Dropdown: History ──
  const renderHistoryDropdown = (inputNumber: 1 | 2 | 3) => {
    const ref = inputNumber === 1 ? historyDropdownRef1 : inputNumber === 2 ? historyDropdownRef2 : historyDropdownRef3;
    return (
      <div ref={ref} className="absolute z-20 mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Recent</span>
          {urlHistory.length > 0 && (
            <button type="button" onClick={clearHistory} className="text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--red)]">Clear</button>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto p-1">
          {urlHistory.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-3">No recent URLs</p>
          ) : urlHistory.map((url, i) => (
            <button key={i} type="button" onClick={() => applyHistoryUrl(url, inputNumber)}
              className="w-full text-left px-3 py-1.5 rounded-md text-xs text-[var(--text-dim)] hover:bg-[var(--bg-hover)] truncate transition-colors">
              {url}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ── Dropdown: Channel Videos ──
  const renderChannelVideosDropdown = (inputNumber: 1 | 2 | 3) => (
    <div ref={channelVideosDropdownRef} className="absolute z-30 mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Live Videos</span>
        <button type="button" onClick={() => setShowChannelVideos(false)} className="text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-base)]">Close</button>
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {fetchingChannelVideos ? (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
            <span className="text-xs text-[var(--text-dim)]">Fetching...</span>
          </div>
        ) : channelVideos.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-3">No live videos found</p>
        ) : channelVideos.map(video => (
          <button key={video.videoId} type="button" onClick={() => selectChannelVideo(video.videoUrl, inputNumber)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--bg-hover)] transition-colors">
            <img src={video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`} alt=""
              className="w-14 h-8 object-cover rounded flex-shrink-0 border border-[var(--border)]" loading="lazy" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--text-base)] truncate">{video.title}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{video.channelName} · {video.viewCount.toLocaleString()} viewers</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Single URL Input Row ──
  const renderInput = (
    value: string,
    setter: (v: string) => void,
    num: 1 | 2 | 3,
    showHistory: boolean,
    setShowHistory: (v: boolean) => void
  ) => (
    <div className="relative">
      <input type="text" value={value} onChange={e => setter(e.target.value)}
        placeholder={`YouTube live URL #${num}`} className={inputClass} />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {value && (
          <button type="button" onClick={() => clearInput(num)} className={iconBtnClass} aria-label="Clear">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button type="button" onClick={() => { setShowHistory(!showHistory); }} className={iconBtnClass} aria-label="History">
          <Clock className="w-3.5 h-3.5" />
        </button>
        {isValidYouTubeChannelUrl(value) && (
          <button type="button" onClick={() => fetchChannelVideosHandler(value)}
            className={`${iconBtnClass} text-[var(--accent)]`} aria-label="Fetch live">
            <Tv className="w-3.5 h-3.5" />
          </button>
        )}
        <button type="button" onClick={() => pasteFromClipboard(setter)}
          className={`${iconBtnClass} text-[var(--accent)]`} aria-label="Paste">
          <Clipboard className="w-3.5 h-3.5" />
        </button>
      </div>
      {showHistory && renderHistoryDropdown(num)}
      {showChannelVideos && renderChannelVideosDropdown(num)}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      {renderInput(url1, setUrl1, 1, showHistory1, (v) => { setShowHistory1(v); setShowHistory2(false); setShowHistory3(false); setShowChannelVideos(false); })}
      
      {expanded ? (
        <>
          {renderInput(url2, setUrl2, 2, showHistory2, (v) => { setShowHistory2(v); setShowHistory1(false); setShowHistory3(false); setShowChannelVideos(false); })}
          {renderInput(url3, setUrl3, 3, showHistory3, (v) => { setShowHistory3(v); setShowHistory1(false); setShowHistory2(false); setShowChannelVideos(false); })}
        </>
      ) : (
        <button type="button" onClick={() => setExpanded(true)}
          className={`${pillBtnClass} text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-hover)] w-fit`}>
          <Plus className="w-3 h-3" /> Add more URLs
        </button>
      )}
      
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--red-muted)] text-[var(--red)] text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}
      
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={clearAll} className={`${pillBtnClass} text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[var(--red-muted)]`}>
            <Trash2 className="w-3 h-3" /> Clear
          </button>
          <button type="button" onClick={restorePreviousSession} className={`${pillBtnClass} text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-hover)]`}>
            <RotateCcw className="w-3 h-3" /> Restore
          </button>
        </div>
        
        <button type="submit" disabled={loading}
          className={`flex items-center gap-2 h-9 px-5 rounded-lg text-xs font-bold transition-all ${
            tracking
              ? 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--red)] hover:text-[var(--red)]'
              : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-lg shadow-[var(--accent)]/20'
          } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : tracking ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {loading ? 'Connecting...' : tracking ? 'Stop' : 'Start Tracking'}
        </button>
      </div>
    </form>
  );
} 
