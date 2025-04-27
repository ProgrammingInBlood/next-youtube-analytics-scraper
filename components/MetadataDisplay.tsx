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
    <div className="space-y-4">
      <div className="flex items-center mb-1">
        <h3 className="text-lg font-semibold text-white">
          <span className="inline-block mr-2 bg-purple-500 w-2 h-2 rounded-full"></span>
          Live Streams ({metadata.length})
        </h3>
      </div>
      
      {metadata.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-lg mb-1">No streams to display</p>
          <p>Add YouTube live URLs to see their metadata</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metadata.map((video) => (
            <div 
              key={video.videoId}
              onClick={() => openVideoUrl(video.videoUrl)}
              className="relative overflow-hidden rounded-lg bg-gray-900 border border-purple-500/20 hover:border-purple-500/40 shadow-md transition-all duration-300 cursor-pointer group"
            >
              {/* Thumbnail with overlay */}
              <div className="relative aspect-video">
                <img 
                  src={getYouTubeThumbnail(video.videoId)} 
                  alt={formatTitle(video.title)} 
                  className="w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 to-transparent"></div>
                
                {/* Live indicator */}
                {video.isLive && (
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-xs uppercase tracking-wide font-bold px-2 py-1 rounded flex items-center">
                    <span className="animate-pulse mr-1.5 bg-white h-2 w-2 rounded-full inline-block"></span>
                    Live
                  </div>
                )}
                
                {/* View count */}
                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {formatNumber(video.viewCount)}
                </div>
                
                {/* Title overlay */}
                <div className="absolute bottom-0 left-0 p-3">
                  <h3 className="text-white font-semibold truncate mb-1 max-w-xs">
                    {formatTitle(video.title)}
                  </h3>
                  <p className="text-gray-300 text-sm truncate">{video.channelName}</p>
                </div>
              </div>
              
              {/* Footer with stats */}
              <div className="flex items-center justify-between px-3 py-2 bg-gray-800/80">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="text-purple-300">{formatLikeCount(video.likeCount)}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded">
                    Click to open stream
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MetadataDisplay; 