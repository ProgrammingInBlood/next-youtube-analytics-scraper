'use client';

import { useMemo, useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { 
  Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
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

const COLORS = {
  messages: '#9147ff',
  users: '#00e6cb',
  likes: '#fbbf24',
  views: '#f472b6',
  comments: '#a78bfa'
};

const PIE_COLORS = ['#9147ff', '#00e6cb', '#fbbf24', '#f472b6', '#a78bfa', '#4b5563'];

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
}

type YouTubeTitle = string | { runs?: Array<{ text: string }>; simpleText?: string; } | null | undefined;

interface CustomTooltipPayloadItem {
  value: number | string;
  name: string;
  dataKey: string;
  color?: string;
  payload?: Record<string, unknown> & { fullTitle?: YouTubeTitle };
}

const formatTitle = (title: YouTubeTitle): string => {
  if (!title) return 'Untitled';
  if (typeof title === 'string') return title;
  if (typeof title === 'object') {
    if (title.runs && Array.isArray(title.runs)) return title.runs.map(run => run.text).join('');
    if (title.simpleText) return title.simpleText;
  }
  try { return String(title); } catch { return 'Untitled'; }
};

const timeRanges = [
  { key: '5min', label: '5m' },
  { key: '15min', label: '15m' },
  { key: '30min', label: '30m' },
  { key: 'all', label: 'All' },
] as const;

const cardClass = "bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg overflow-hidden";
const cardHeaderClass = "flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]";
const cardTitleClass = "text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide";

export default function ChatAnalytics({ messages, metadata }: ChatAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'5min' | '15min' | '30min' | 'all'>('all');
  
  const filteredMessages = useMemo(() => {
    if (timeRange === 'all') return messages;
    const now = new Date().getTime();
    const ranges = { '5min': 5 * 60 * 1000, '15min': 15 * 60 * 1000, '30min': 30 * 60 * 1000 };
    const timeLimit = now - ranges[timeRange];
    return messages.filter(msg => new Date(msg.timestamp).getTime() > timeLimit);
  }, [messages, timeRange]);
  
  const activityChartData = useMemo(() => {
    if (filteredMessages.length === 0) return [];
    
    const messagesWithParsedDates = filteredMessages.map(msg => {
      try {
        let date: Date;
        if (typeof msg.timestamp === 'string' && msg.timestamp.match(/^\d{4}-\d{2}-\d{2}T/)) date = new Date(msg.timestamp);
        else if (typeof msg.timestamp === 'string' && /^\d+$/.test(msg.timestamp)) { const ts = parseInt(msg.timestamp); date = new Date(ts < 10000000000 ? ts * 1000 : ts); }
        else date = new Date(msg.timestamp);
        if (isNaN(date.getTime())) return null;
        return { message: msg, timestamp: date, sourceId: msg.sourceVideo.id };
      } catch { return null; }
    }).filter(Boolean) as { message: ChatMessage, timestamp: Date, sourceId: string }[];
    
    if (messagesWithParsedDates.length === 0) {
      const now = new Date();
      return Array.from({ length: 12 }, (_, i) => {
        const t = new Date(now.getTime() - (11 - i) * 5 * 60 * 1000);
        return { time: `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`, messages: 0, users: 0 };
      });
    }
    
    let oldest = messagesWithParsedDates[0].timestamp.getTime();
    let newest = oldest;
    messagesWithParsedDates.forEach(i => { const t = i.timestamp.getTime(); if (t < oldest) oldest = t; if (t > newest) newest = t; });
    
    const rangeMin = (newest - oldest) / 60000;
    let interval = rangeMin > 120 ? 10 : rangeMin > 60 ? 5 : rangeMin > 30 ? 2 : 1;
    const numBuckets = Math.max(10, Math.ceil(rangeMin / interval));
    interval = Math.max(1, Math.ceil(rangeMin / numBuckets));
    
    const buckets: Record<string, { time: string; rawTime: number; messages: number; uniqueUsers: Set<string> }> = {};
    let cur = new Date(oldest);
    while (cur.getTime() <= newest) {
      const key = `${cur.getHours()}:${cur.getMinutes()}`;
      buckets[key] = { time: `${cur.getHours().toString().padStart(2, '0')}:${cur.getMinutes().toString().padStart(2, '0')}`, rawTime: cur.getTime(), messages: 0, uniqueUsers: new Set() };
      cur = new Date(cur.getTime() + interval * 60000);
    }
    
    messagesWithParsedDates.forEach(item => {
      let closest = ''; let minDiff = Infinity;
      for (const k in buckets) { const d = Math.abs(buckets[k].rawTime - item.timestamp.getTime()); if (d < minDiff) { minDiff = d; closest = k; } }
      if (closest && buckets[closest]) { buckets[closest].messages++; buckets[closest].uniqueUsers.add(item.message.authorChannelId); }
    });
    
    return Object.values(buckets).sort((a, b) => a.rawTime - b.rawTime).map(b => ({ time: b.time, messages: b.messages, users: b.uniqueUsers.size }));
  }, [filteredMessages]);
  
  const engagementChartData = useMemo(() => {
    if (metadata.length === 0) return [];
    const msgCount: Record<string, number> = {};
    filteredMessages.forEach(m => { msgCount[m.sourceVideo.id] = (msgCount[m.sourceVideo.id] || 0) + 1; });
    return metadata.map(v => ({
      name: v.title ? (v.title.length > 18 ? v.title.substring(0, 18) + '…' : v.title) : v.videoId.substring(0, 6),
      fullTitle: v.title || 'Unknown',
      videoId: v.videoId,
      views: v.viewCount || 0,
      likes: v.likeCount || 0,
      comments: msgCount[v.videoId] || 0
    }));
  }, [metadata, filteredMessages]);
  
  const topChatters = useMemo(() => {
    const counts: Record<string, { count: number; name: string }> = {};
    filteredMessages.forEach(m => { if (!counts[m.authorChannelId]) counts[m.authorChannelId] = { count: 0, name: m.authorName }; counts[m.authorChannelId].count++; });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredMessages]);
  
  const authorDistributionData = useMemo(() => {
    if (topChatters.length === 0) return [];
    const topCount = topChatters.reduce((s, c) => s + c.count, 0);
    const other = filteredMessages.length - topCount;
    const data = topChatters.slice(0, 5).map(c => ({ name: c.name, value: c.count }));
    if (other > 0) data.push({ name: 'Others', value: other });
    return data;
  }, [topChatters, filteredMessages]);
  
  const commonWords = useMemo(() => {
    const counts: Record<string, number> = {};
    const stops = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'in', 'that', 'have', 'it', 'for', 'on', 'with', 'as', 'this', 'by', 'from']);
    filteredMessages.forEach(m => {
      m.message.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stops.has(w)).forEach(w => { counts[w] = (counts[w] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word, count]) => ({ word, count }));
  }, [filteredMessages]);
  
  const engagementScore = useMemo(() => {
    if (filteredMessages.length === 0) return 0;
    const total = filteredMessages.length;
    const users = new Set(filteredMessages.map(m => m.authorChannelId)).size;
    const avgLen = filteredMessages.reduce((s, m) => s + m.message.length, 0) / total;
    return Math.round((total * 0.5) + (users * 0.3) + (avgLen * 0.2));
  }, [filteredMessages]);

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 shadow-xl max-w-[280px]">
        <p className="text-xs font-bold text-[var(--text-base)] mb-1.5">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-[11px] mb-0.5" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : String(entry.value)}
          </p>
        ))}
        {payload[0]?.payload?.fullTitle && (
          <p className="text-[10px] text-[var(--text-muted)] mt-1.5 pt-1.5 border-t border-[var(--border)]">
            {formatTitle(payload[0].payload.fullTitle)}
          </p>
        )}
      </div>
    );
  };

  const EmptyState = ({ text = 'No data available' }: { text?: string }) => (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      <BarChart3 className="w-8 h-8 text-[var(--text-muted)] opacity-30" />
      <p className="text-xs text-[var(--text-muted)]">{text}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header + time range */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-[var(--text-base)] uppercase tracking-wide">Analytics</h2>
        <div className="flex items-center gap-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-0.5">
          {timeRanges.map(r => (
            <button key={r.key} onClick={() => setTimeRange(r.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                timeRange === r.key ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Row 1: Activity + Score */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className={`lg:col-span-3 ${cardClass}`}>
          <div className={cardHeaderClass}>
            <span className={cardTitleClass}>Message Activity</span>
            <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{filteredMessages.length} msgs</span>
          </div>
          <div className="h-56 p-2">
            {activityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityChartData} margin={{ top: 5, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="time" tick={{ fill: '#737380', fontSize: 10 }} angle={-45} textAnchor="end" tickMargin={8} />
                  <YAxis tick={{ fill: '#737380', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="messages" name="Messages" stroke={COLORS.messages} fill={COLORS.messages} fillOpacity={0.2} strokeWidth={2} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="users" name="Users" stroke={COLORS.users} fill={COLORS.users} fillOpacity={0.1} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Waiting for messages" />}
          </div>
        </div>
        
        <div className={`${cardClass} flex flex-col`}>
          <div className={cardHeaderClass}>
            <span className={cardTitleClass}>Score</span>
            <TrendingUp className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <span className="text-5xl font-extrabold text-[var(--accent)] tabular-nums leading-none">{engagementScore}</span>
            <span className="text-[10px] text-[var(--text-muted)] mt-2 text-center">
              {filteredMessages.length} msgs · {new Set(filteredMessages.map(m => m.authorChannelId)).size} users
            </span>
          </div>
        </div>
      </div>
      
      {/* Row 2: Engagement metrics */}
      <div className={cardClass}>
        <div className={cardHeaderClass}>
          <span className={cardTitleClass}>Video Engagement</span>
        </div>
        <div className="h-72 p-2">
          {engagementChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={engagementChartData} margin={{ top: 5, right: 20, left: 10, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fill: '#737380', fontSize: 10 }} angle={-45} textAnchor="end" height={70} interval={0} />
                <YAxis yAxisId="left" tick={{ fill: '#737380', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#737380', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="comments" name="Chat" fill={COLORS.comments} barSize={18} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="likes" name="Likes" fill={COLORS.likes} barSize={18} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="views" name="Views" stroke={COLORS.views} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>
      </div>
      
      {/* Row 3: Radar */}
      <div className={cardClass}>
        <div className={cardHeaderClass}>
          <span className={cardTitleClass}>Metrics Comparison</span>
        </div>
        <div className="h-72 p-2">
          {engagementChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={engagementChartData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="name" tick={{ fill: '#737380', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#737380', fontSize: 9 }} />
                <Radar name="Chat" dataKey="comments" stroke={COLORS.comments} fill={COLORS.comments} fillOpacity={0.5} />
                <Radar name="Likes" dataKey="likes" stroke={COLORS.likes} fill={COLORS.likes} fillOpacity={0.4} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>
      </div>
      
      {/* Row 4: Chatters + Words */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <span className={cardTitleClass}>Top Chatters</span>
          </div>
          <div className="grid grid-cols-2 gap-0 divide-x divide-[var(--border)]">
            <div className="p-3">
              {topChatters.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {topChatters.slice(0, 5).map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[var(--accent-muted)] flex items-center justify-center text-[9px] font-bold text-[var(--accent)] flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-base)] truncate">{c.name}</p>
                        <div className="w-full h-1 rounded-full bg-[var(--bg-base)] mt-1 overflow-hidden">
                          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(c.count / topChatters[0].count) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[var(--text-muted)] tabular-nums">{c.count}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState />}
            </div>
            <div className="h-48 p-1">
              {authorDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={authorDistributionData} cx="50%" cy="50%" innerRadius={25} outerRadius={55} paddingAngle={2} dataKey="value" nameKey="name">
                      {authorDistributionData.map((_, i) => <Cell key={`c-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>
          </div>
        </div>
        
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <span className={cardTitleClass}>Common Words</span>
          </div>
          <div className="h-52 p-2">
            {commonWords.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commonWords.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis type="number" tick={{ fill: '#737380', fontSize: 10 }} />
                  <YAxis dataKey="word" type="category" tick={{ fill: '#adadb8', fontSize: 10 }} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Count" fill={COLORS.users} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </div>
        </div>
      </div>
    </div>
  );
} 
