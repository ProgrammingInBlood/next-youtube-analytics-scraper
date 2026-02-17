'use client';

import React from 'react';
import { Eye, ThumbsUp, ExternalLink, Video } from 'lucide-react';

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
  const formatCompact = (num: number): string => {
    return Intl.NumberFormat('en', { notation: 'compact' }).format(num);
  };

  const formatTitle = (title: string | { runs: { text: string }[] } | undefined): string => {
    if (!title) return 'Untitled Stream';
    if (typeof title === 'string') return title;
    if (title.runs && Array.isArray(title.runs)) return title.runs.map(run => run.text).join('');
    return 'Untitled Stream';
  };

  const getThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

  if (metadata.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Video className="w-10 h-10 text-[var(--text-muted)] opacity-40" />
        <p className="text-sm font-medium text-[var(--text-dim)]">No streams to display</p>
        <p className="text-xs text-[var(--text-muted)]">Add YouTube live URLs and start tracking</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-[var(--text-base)] uppercase tracking-wide">Tracked Streams</h3>
        <span className="text-[11px] font-semibold text-[var(--text-muted)]">{metadata.length} stream{metadata.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {metadata.map(video => (
          <a
            key={video.videoId}
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-3 p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg hover:border-[var(--border-hover)] transition-colors"
          >
            {/* Thumbnail */}
            <div className="relative w-28 h-16 flex-shrink-0 rounded-md overflow-hidden">
              <img src={getThumb(video.videoId)} alt="" className="w-full h-full object-cover" />
              {video.isLive && (
                <span className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--red)] text-white text-[9px] font-extrabold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-live" />
                  Live
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-base)] truncate group-hover:text-[var(--accent)] transition-colors">
                  {formatTitle(video.title)}
                </h4>
                <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{video.channelName || 'Unknown channel'}</p>
              </div>

              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] font-medium tabular-nums">
                  <Eye className="w-3 h-3" />{formatCompact(video.viewCount)}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] font-medium tabular-nums">
                  <ThumbsUp className="w-3 h-3" />{formatCompact(video.likeCount)}
                </span>
                <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default MetadataDisplay; 