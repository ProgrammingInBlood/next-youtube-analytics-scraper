'use client';

import React, { useMemo } from 'react';
import { MessageSquare, Users, AlignLeft, Activity, Crown } from 'lucide-react';

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

interface EngagementStatsProps {
  messages: ChatMessage[];
}

const EngagementStats: React.FC<EngagementStatsProps> = ({ messages }) => {
  const stats = useMemo(() => {
    if (!messages || messages.length === 0) {
      return { totalMessages: 0, uniqueUsers: 0, topUsers: [] as { user: string; count: number }[], averageMessageLength: 0, engagement: 'No Data' };
    }

    const userMessages: Record<string, number> = {};
    let totalMessageLength = 0;
    messages.forEach(msg => {
      userMessages[msg.authorName] = (userMessages[msg.authorName] || 0) + 1;
      totalMessageLength += msg.message.length;
    });

    const uniqueUsers = Object.keys(userMessages).length;
    const topUsers = Object.entries(userMessages).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([user, count]) => ({ user, count }));
    const averageMessageLength = Math.round(totalMessageLength / messages.length);

    const messagesPerMinute = messages.length / 5;
    const engagement = messagesPerMinute >= 30 ? 'Very High' : messagesPerMinute >= 15 ? 'High' : messagesPerMinute >= 5 ? 'Moderate' : 'Low';

    return { totalMessages: messages.length, uniqueUsers, topUsers, averageMessageLength, engagement };
  }, [messages]);

  const engagementColor = (level: string) => {
    switch (level) {
      case 'Very High': return 'text-[var(--accent)]';
      case 'High': return 'text-[var(--green)]';
      case 'Moderate': return 'text-[var(--yellow)]';
      case 'Low': return 'text-[var(--red)]';
      default: return 'text-[var(--text-muted)]';
    }
  };

  if (stats.totalMessages === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <MessageSquare className="w-10 h-10 text-[var(--text-muted)] opacity-40" />
        <p className="text-sm font-medium text-[var(--text-dim)]">No chat data yet</p>
        <p className="text-xs text-[var(--text-muted)]">Stats appear once messages start flowing</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Messages', value: stats.totalMessages.toLocaleString(), icon: MessageSquare, color: 'text-[var(--accent)]' },
    { label: 'Users', value: stats.uniqueUsers.toLocaleString(), icon: Users, color: 'text-[var(--green)]' },
    { label: 'Avg Length', value: `${stats.averageMessageLength}`, icon: AlignLeft, color: 'text-[var(--blue)]' },
    { label: 'Engagement', value: stats.engagement, icon: Activity, color: engagementColor(stats.engagement) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-bold text-[var(--text-base)] uppercase tracking-wide">Engagement</h3>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-2">
        {statCards.map(s => (
          <div key={s.label} className="flex flex-col gap-1 p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{s.label}</span>
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
            </div>
            <span className={`text-lg font-extrabold ${s.color} tabular-nums leading-none`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Top chatters */}
      {stats.topUsers.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Crown className="w-3 h-3 text-[var(--yellow)]" />
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Top Chatters</span>
          </div>
          <div className="flex flex-col gap-1">
            {stats.topUsers.map((u, i) => {
              const pct = Math.round((u.count / stats.totalMessages) * 100);
              return (
                <div key={u.user} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] w-4 text-center">{i + 1}</span>
                  <div className="w-5 h-5 rounded-full bg-[var(--accent-muted)] flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-[var(--accent)]">{u.user.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-base)] truncate flex-1">{u.user}</span>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] tabular-nums">{u.count}</span>
                  <div className="w-12 h-1.5 rounded-full bg-[var(--bg-base)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] tabular-nums w-7 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EngagementStats; 