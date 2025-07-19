'use client';

import React from 'react';

interface VideoMetadata {
  videoId: string;
  videoUrl: string;
  title?: string | { runs: { text: string }[] };
  channelName?: string;
  viewCount: number;
  likeCount: number;
  isLive: boolean;
  error?: string;
}

interface MetadataDisplayProps {
  metadata: VideoMetadata[];
}

const MetadataDisplay: React.FC<MetadataDisplayProps> = ({ metadata }) => {
  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Handle YouTube title format which can be either string or object with runs
  const formatTitle = (title: string | { runs: { text: string }[] } | undefined): string => {
    if (!title) return 'No title available';
    
    if (typeof title === 'string') {
      return title;
    }
    
    // Handle YouTube format which has title.runs[].text
    if (title.runs && Array.isArray(title.runs)) {
      return title.runs.map(run => run.text).join('');
    }
    
    return 'No title available';
  };

  // Format like count to display with K for thousands, M for millions
  const formatLikeCount = (count: number): string => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  // Get YouTube thumbnail URL from video ID
  const getYouTubeThumbnail = (videoId: string): string => {
    return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  };

  // Open video URL in new tab
  const openVideoUrl = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="container-box">
      <div className="container-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 className="text-lg text-primary">Live Streams</h3>
          <div className="status-indicator status-live">
            {metadata.length} {metadata.length === 1 ? 'stream' : 'streams'}
          </div>
        </div>
        
        {metadata.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ margin: '0 auto', color: 'var(--text-muted)' }}>
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-lg text-secondary" style={{ marginBottom: '8px' }}>No streams to display</p>
            <p className="text-muted">Add YouTube live URLs to see their metadata</p>
          </div>
        ) : (
          <div className="grid grid-cols-2" style={{ gap: '16px' }}>
            {metadata.map((video) => (
              <div 
                key={video.videoId}
                onClick={() => openVideoUrl(video.videoUrl)}
                className="container-box"
                style={{ 
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Thumbnail with overlay */}
                <div style={{ position: 'relative', aspectRatio: '16/9' }}>
                  <img 
                    src={getYouTubeThumbnail(video.videoId)} 
                    alt={formatTitle(video.title)} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover',
                      border: '1px solid var(--border)'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(17, 24, 39, 0.9), transparent)'
                  }}></div>
                  
                  {/* Live indicator */}
                  {video.isLive && (
                    <div 
                      className="status-indicator status-live"
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        textTransform: 'uppercase',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}
                    >
                      <div style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        background: 'currentColor',
                        animation: 'pulse 1.5s infinite'
                      }}></div>
                      Live
                    </div>
                  )}
                  
                  {/* View count */}
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    fontSize: '11px',
                    padding: '4px 8px',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {formatNumber(video.viewCount)}
                  </div>
                  
                  {/* Title overlay */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '12px'
                  }}>
                    <h3 className="text-sm text-primary" style={{ 
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: '600'
                    }}>
                      {formatTitle(video.title)}
                    </h3>
                    <p className="text-xs text-secondary" style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {video.channelName}
                    </p>
                  </div>
                </div>
                
                {/* Footer with stats */}
                <div className="container-section" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '12px 16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-muted">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-sm text-secondary">{formatLikeCount(video.likeCount)}</span>
                  </div>
                  <div className="text-xs text-muted">
                    Click to open
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetadataDisplay; 