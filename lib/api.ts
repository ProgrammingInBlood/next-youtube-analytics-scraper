'use client';

/**
 * API utility to communicate with the backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.0.243:3001';

export interface VideoMetadata {
  videoId: string;
  videoUrl: string;
  title?: string;
  viewCount: number;
  likeCount: number;
  isLive: boolean;
  channelName?: string;
  error?: string;
  thumbnailUrl?: string;
}

export interface SourceVideo {
  url: string;
  id: string;
  title?: string;
}

export interface ChatMessage {
  id: string;
  message: string;
  authorName: string;
  authorChannelId: string;
  timestamp: string;
  sourceVideo: SourceVideo;
}

export interface ChannelLiveVideo {
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnailUrl: string;
  viewCount: number;
  channelName: string;
}

/**
 * Fetches live chat messages from multiple YouTube videos
 */
export async function fetchLiveChat(urls: string[]): Promise<{ 
  messages: ChatMessage[],
  errors: string[] 
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/live-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching live chat:', error);
    return { messages: [], errors: ['Failed to fetch live chat data'] };
  }
}

/**
 * Fetches metadata from multiple YouTube videos
 */
export async function fetchVideoMetadata(urls: string[]): Promise<{
  metadata: VideoMetadata[],
  errors: string[]
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/video-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    return { metadata: [], errors: ['Failed to fetch video metadata'] };
  }
}

/**
 * Fetches all active live videos from a YouTube channel
 */
export async function fetchChannelLiveVideos(channelUrl: string): Promise<{
  videos: ChannelLiveVideo[],
  error?: string
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/channel-live-videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channelUrl }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching channel live videos:', error);
    return { videos: [], error: 'Failed to fetch live videos from channel' };
  }
}

/**
 * Validates if a URL is a YouTube video URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (!url) return false;
  
  const patterns = [
    /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
    /^https?:\/\/(?:www\.)?youtu\.be\/[\w-]{11}/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Validates if a URL is a YouTube channel URL
 */
export function isValidYouTubeChannelUrl(url: string): boolean {
  if (!url) return false;
  
  const patterns = [
    /^https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|user|@)\/[\w-]+/,
    /^https?:\/\/(?:www\.)?youtube\.com\/@[\w.-]+/
  ];
  
  return patterns.some(pattern => pattern.test(url));
} 