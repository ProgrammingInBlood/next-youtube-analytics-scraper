'use client';

import { useMemo, useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, 
  ComposedChart, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';

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
  sourceVideo: {
    url: string;
    id: string;
    title?: string;
  };
}

interface ChatAnalyticsProps {
  messages: ChatMessage[];
  metadata: VideoMetadata[];
}

// COMPONENT COLORS
const COLORS = {
  messages: '#3B82F6', // blue-500
  users: '#10B981',    // emerald-500
  likes: '#F59E0B',    // amber-500
  views: '#EC4899',    // pink-500
  comments: '#8B5CF6'  // violet-500
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    dataKey: string;
    payload?: any;
  }>;
  label?: string;
}

const parseDate = (dateStr: string): Date => {
  try {
    return new Date(dateStr);
  } catch (parseError) {
    console.error('Error parsing date:', parseError);
    return new Date();
  }
};

interface FormatTitleParams {
  title: string | { runs: { text: string }[] } | undefined;
}

// Helper function to handle YouTube title format which can be string or object
const formatTitle = ({ title }: FormatTitleParams): string => {
  if (!title) return 'Untitled';
  
  if (typeof title === 'string') {
    return title;
  }
  
  // Handle YouTube format which has title.runs[].text
  if (title.runs && Array.isArray(title.runs)) {
    return title.runs.map(run => run.text).join('');
  }
  
  return 'Untitled';
};

export default function ChatAnalytics({ messages, metadata }: ChatAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'5min' | '15min' | '30min' | 'all'>('all');
  
  // Get filtered messages based on time range
  const filteredMessages = useMemo(() => {
    if (timeRange === 'all') return messages;
    
    const now = new Date().getTime();
    const ranges = {
      '5min': 5 * 60 * 1000,
      '15min': 15 * 60 * 1000,
      '30min': 30 * 60 * 1000
    };
    
    const timeLimit = now - ranges[timeRange];
    return messages.filter(msg => new Date(msg.timestamp).getTime() > timeLimit);
  }, [messages, timeRange]);
  
  // Message activity timeline for Recharts
  const activityChartData = useMemo(() => {
    if (filteredMessages.length === 0) return [];
    
    console.log(`Processing ${filteredMessages.length} messages for timeline chart`);
    
    // Process timestamps to get valid dates
    const messagesWithParsedDates = filteredMessages.map(msg => {
      try {
        // Try different timestamp formats
        let date: Date;
        
        if (typeof msg.timestamp === 'string' && msg.timestamp.match(/^\d{4}-\d{2}-\d{2}T/)) {
          date = new Date(msg.timestamp);
        } 
        else if (typeof msg.timestamp === 'string' && /^\d+$/.test(msg.timestamp)) {
          const timestamp = parseInt(msg.timestamp);
          date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
        }
        else {
          date = new Date(msg.timestamp);
        }
        
        if (isNaN(date.getTime())) return null;
        
        return {
          message: msg,
          timestamp: date,
          sourceId: msg.sourceVideo.id
        };
      } catch (error) {
        return null;
      }
    }).filter(item => item !== null) as { message: ChatMessage, timestamp: Date, sourceId: string }[];
    
    // If no valid timestamps, create artificial data
    if (messagesWithParsedDates.length === 0) {
      console.log("No valid timestamps found, using demo data");
      return generateDemoTimelineData();
    }
    
    // Find time range
    let oldestTime = messagesWithParsedDates[0].timestamp.getTime();
    let newestTime = messagesWithParsedDates[0].timestamp.getTime();
    
    messagesWithParsedDates.forEach(item => {
      const time = item.timestamp.getTime();
      if (time < oldestTime) oldestTime = time;
      if (time > newestTime) newestTime = time;
    });
    
    // Determine appropriate time interval
    const rangeInMinutes = (newestTime - oldestTime) / (60 * 1000);
    let intervalMinutes = 1;
    
    if (rangeInMinutes > 120) intervalMinutes = 10;
    else if (rangeInMinutes > 60) intervalMinutes = 5;
    else if (rangeInMinutes > 30) intervalMinutes = 2;
    
    // Ensure we have enough data points
    const numBuckets = Math.max(10, Math.ceil(rangeInMinutes / intervalMinutes));
    intervalMinutes = Math.max(1, Math.ceil(rangeInMinutes / numBuckets));
    
    // Create time buckets
    const messageBuckets: Record<string, { 
      time: string,
      date: Date,
      rawTime: number,
      messages: number,
      uniqueUsers: Set<string>
    }> = {};
    
    const startTime = new Date(oldestTime);
    const endTime = new Date(newestTime);
    
    // Initialize buckets
    let currentTime = new Date(startTime);
    while (currentTime <= endTime) {
      const bucketKey = formatTimeKey(currentTime);
      messageBuckets[bucketKey] = {
        time: formatTimeDisplay(currentTime),
        date: new Date(currentTime),
        rawTime: currentTime.getTime(),
        messages: 0,
        uniqueUsers: new Set()
      };
      
      currentTime = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000);
    }
    
    // Count messages per bucket
    messagesWithParsedDates.forEach(item => {
      const date = item.timestamp;
      
      // Find closest bucket
      let closestKey = '';
      let minDiff = Infinity;
      
      for (const key in messageBuckets) {
        const diff = Math.abs(messageBuckets[key].rawTime - date.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestKey = key;
        }
      }
      
      if (closestKey && messageBuckets[closestKey]) {
        messageBuckets[closestKey].messages++;
        messageBuckets[closestKey].uniqueUsers.add(item.message.authorChannelId);
      }
    });
    
    // Convert to array format for Recharts
    return Object.values(messageBuckets)
      .sort((a, b) => a.rawTime - b.rawTime)
      .map(bucket => ({
        time: bucket.time,
        messages: bucket.messages,
        users: bucket.uniqueUsers.size
      }));
    
    // Helper functions
    function formatTimeKey(date: Date): string {
      return `${date.getHours()}:${date.getMinutes()}`;
    }
    
    function formatTimeDisplay(date: Date): string {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    function generateDemoTimelineData() {
      const now = new Date();
      const demoData = [];
      
      for (let i = 0; i < 12; i++) {
        const time = new Date(now.getTime() - (11 - i) * 5 * 60 * 1000);
        demoData.push({
          time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
          messages: 0,
          users: 0,
          isDemo: true
        });
      }
      
      return demoData;
    }
  }, [filteredMessages]);
  
  // Multi-metric engagement data across videos
  const engagementChartData = useMemo(() => {
    if (metadata.length === 0) return [];
    
    // Count messages per video
    const messageCountByVideoId: Record<string, number> = {};
    
    filteredMessages.forEach(msg => {
      const videoId = msg.sourceVideo.id;
      messageCountByVideoId[videoId] = (messageCountByVideoId[videoId] || 0) + 1;
    });
    
    // Create data for the chart
    return metadata.map(video => {
      // Get a short name for display
      const shortName = video.title 
        ? (video.title.length > 20 ? video.title.substring(0, 20) + '...' : video.title)
        : video.videoId.substring(0, 6);
        
      return {
        name: shortName,
        fullTitle: video.title || 'Unknown',
        videoId: video.videoId,
        views: video.viewCount || 0,
        likes: video.likeCount || 0,
        comments: messageCountByVideoId[video.videoId] || 0
      };
    });
  }, [metadata, filteredMessages]);
  
  // Top chatters analysis
  const topChatters = useMemo(() => {
    const authorCounts: Record<string, { count: number, name: string }> = {};
    
    filteredMessages.forEach(msg => {
      if (!authorCounts[msg.authorChannelId]) {
        authorCounts[msg.authorChannelId] = { 
          count: 0, 
          name: msg.authorName 
        };
      }
      authorCounts[msg.authorChannelId].count++;
    });
    
    return Object.values(authorCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredMessages]);
  
  // Pie chart data for author distribution
  const authorDistributionData = useMemo(() => {
    if (topChatters.length === 0) return [];
    
    const topChatterCount = topChatters.reduce((sum, chatter) => sum + chatter.count, 0);
    const totalMessages = filteredMessages.length;
    const otherCount = totalMessages - topChatterCount;
    
    // Generate data for pie chart with top 5 chatters and "Others"
    const pieData = topChatters.slice(0, 5).map(chatter => ({
      name: chatter.name,
      value: chatter.count
    }));
    
    if (otherCount > 0) {
      pieData.push({ name: 'Others', value: otherCount });
    }
    
    return pieData;
  }, [topChatters, filteredMessages]);
  
  // Common words/phrases analysis
  const commonWords = useMemo(() => {
    const wordCounts: Record<string, number> = {};
    const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'in', 'that', 'have', 'it', 'for', 'on', 'with', 'as', 'this', 'by', 'from']);
    
    filteredMessages.forEach(msg => {
      const words = msg.message
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
      
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });
    
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));
  }, [filteredMessages]);
  
  // Calculate engagement score
  const engagementScore = useMemo(() => {
    if (filteredMessages.length === 0) return 0;
    
    const totalMessages = filteredMessages.length;
    const uniqueUsers = new Set(filteredMessages.map(msg => msg.authorChannelId)).size;
    const avgMessageLength = filteredMessages.reduce((sum, msg) => sum + msg.message.length, 0) / totalMessages;
    
    return Math.round((totalMessages * 0.5) + (uniqueUsers * 0.3) + (avgMessageLength * 0.2));
  }, [filteredMessages]);

  // RECHARTS CUSTOM TOOLTIP
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      // Function to safely format title objects
      const formatTitle = (title: any): string => {
        if (!title) return '';
        if (typeof title === 'string') return title;
        if (title.runs && Array.isArray(title.runs)) {
          return title.runs.map((run: any) => run.text).join('');
        }
        return String(title);
      };

      return (
        <div className="container-box" style={{ padding: '12px', maxWidth: '300px' }}>
          <p className="text-sm text-primary" style={{ fontWeight: '600', marginBottom: '8px' }}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color, marginBottom: '4px' }} className="text-sm">
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
          {payload[0]?.payload?.fullTitle && (
            <p className="text-xs text-muted" style={{ 
              marginTop: '8px', 
              paddingTop: '8px',
              borderTop: '1px solid var(--border)'
            }}>
              {formatTitle(payload[0].payload.fullTitle)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="text-lg text-primary">Chat Analytics</h2>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setTimeRange('5min')}
            className={`btn ${timeRange === '5min' ? 'btn-primary' : 'btn-secondary'}`}
          >
            5m
          </button>
          <button 
            onClick={() => setTimeRange('15min')}
            className={`btn ${timeRange === '15min' ? 'btn-primary' : 'btn-secondary'}`}
          >
            15m
          </button>
          <button 
            onClick={() => setTimeRange('30min')}
            className={`btn ${timeRange === '30min' ? 'btn-primary' : 'btn-secondary'}`}
          >
            30m
          </button>
          <button 
            onClick={() => setTimeRange('all')}
            className={`btn ${timeRange === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All
          </button>
        </div>
      </div>
      
      {/* Message Activity Chart */}
      <div className="grid grid-cols-3" style={{ gap: '24px', marginBottom: '24px' }}>
        <div style={{ gridColumn: 'span 2' }} className="container-box">
          <div className="container-section">
            <h3 className="text-base text-secondary" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <span>Message Activity</span>
              {filteredMessages.length > 0 && (
                <span className="text-xs text-muted">
                  {filteredMessages.length} messages
                </span>
              )}
            </h3>
            
            <div style={{ height: '256px' }}>
              {activityChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={activityChartData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
                      angle={-45}
                      textAnchor="end"
                      tickMargin={10}
                    />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="messages" 
                      name="Messages" 
                      stroke={COLORS.messages} 
                      fill={COLORS.messages} 
                      fillOpacity={0.3} 
                      activeDot={{ r: 6 }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="users" 
                      name="Unique Users" 
                      stroke={COLORS.users} 
                      fill={COLORS.users} 
                      fillOpacity={0.2} 
                      activeDot={{ r: 4 }} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '12px'
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="text-muted">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div style={{ textAlign: 'center' }}>
                    <p className="text-sm text-secondary" style={{ fontWeight: '500' }}>No data available</p>
                    <p className="text-xs text-muted" style={{ marginTop: '4px' }}>Waiting for chat messages</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Engagement Score Card */}
        <div className="container-box">
          <div className="container-section">
            <h3 className="text-base text-secondary" style={{ marginBottom: '16px' }}>Engagement Score</h3>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '256px'
            }}>
              <div className="text-primary" style={{ 
                fontSize: '48px', 
                fontWeight: '700', 
                marginBottom: '8px',
                color: 'var(--primary)'
              }}>
                {engagementScore}
              </div>
              <div className="text-xs text-muted" style={{ textAlign: 'center' }}>
                Based on {filteredMessages.length} messages from {new Set(filteredMessages.map(msg => msg.authorChannelId)).size} unique users
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Multi-metric Engagement Chart */}
      <div className="container-box" style={{ marginBottom: '24px' }}>
        <div className="container-section">
          <h3 className="text-base text-secondary" style={{ marginBottom: '16px' }}>Video Engagement Metrics</h3>
          
          <div style={{ height: '320px' }}>
            {engagementChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={engagementChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis 
                    yAxisId="left" 
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                    tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                    tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar 
                    yAxisId="left" 
                    dataKey="comments" 
                    name="Comments" 
                    fill={COLORS.comments}
                    barSize={20}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    yAxisId="left" 
                    dataKey="likes" 
                    name="Likes" 
                    fill={COLORS.likes}
                    barSize={20}
                    radius={[0, 0, 0, 0]}
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="views" 
                    name="Views" 
                    stroke={COLORS.views} 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <div style={{ textAlign: 'center' }}>
                  <p className="text-sm text-muted">No data available for video metrics</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Metrics Over Time Chart */}
      <div className="container-box" style={{ marginBottom: '24px' }}>
        <div className="container-section">
          <h3 className="text-base text-secondary" style={{ marginBottom: '16px' }}>Metrics Comparison</h3>
          
          <div style={{ height: '320px' }}>
            {engagementChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={engagementChartData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Radar name="Comments" dataKey="comments" stroke={COLORS.comments} fill={COLORS.comments} fillOpacity={0.6} />
                  <Radar name="Likes" dataKey="likes" stroke={COLORS.likes} fill={COLORS.likes} fillOpacity={0.6} />
                  <Legend />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <p className="text-sm text-muted">No data available for metrics comparison</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Top Chatters and Common Words */}
      <div className="grid grid-cols-2" style={{ gap: '24px' }}>
        {/* Top Chatters Section */}
        <div className="container-box">
          <div className="container-section">
            <h3 className="text-base text-secondary" style={{ marginBottom: '16px' }}>Top Chatters</h3>
            
            <div className="grid grid-cols-2" style={{ gap: '16px' }}>
              {/* Top chatters list */}
              <div>
                {topChatters.length > 0 ? (
                  <div className="space-y-4">
                    {topChatters.slice(0, 5).map((chatter, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid var(--primary)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '600',
                          marginRight: '12px'
                        }}>
                          {index + 1}
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <div className="text-sm text-primary" style={{ 
                            fontWeight: '600',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {chatter.name}
                          </div>
                          <div style={{
                            width: '100%',
                            height: '8px',
                            background: 'var(--card-bg)',
                            border: '1px solid var(--border)',
                            marginTop: '4px'
                          }}>
                            <div 
                              style={{ 
                                background: 'var(--primary)', 
                                height: '100%',
                                width: `${(chatter.count / topChatters[0].count) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-sm text-muted" style={{ 
                          marginLeft: '12px',
                          fontWeight: '600'
                        }}>
                          {chatter.count}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ 
                    height: '192px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center'
                  }}>
                    <p className="text-sm text-muted">No data available</p>
                  </div>
                )}
              </div>
              
              {/* Pie chart for author distribution */}
              <div style={{ height: '192px' }}>
                {authorDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={authorDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {authorDistributionData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index < 5 ? `hsl(${index * 50}, 70%, 50%)` : '#9CA3AF'} 
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center'
                  }}>
                    <p className="text-sm text-muted">No data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Common Words Section */}
        <div className="container-box">
          <div className="container-section">
            <h3 className="text-base text-secondary" style={{ marginBottom: '16px' }}>Common Words</h3>
            
            {commonWords.length > 0 ? (
              <div style={{ height: '192px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={commonWords.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <YAxis 
                      dataKey="word" 
                      type="category" 
                      tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="count" 
                      name="Occurrences" 
                      fill={COLORS.users}
                      radius={[0, 0, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ 
                height: '256px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <p className="text-sm text-muted">No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 