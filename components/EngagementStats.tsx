'use client';

import React, { useMemo } from 'react';

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
      return {
        totalMessages: 0,
        uniqueUsers: 0,
        topUsers: [],
        averageMessageLength: 0,
        engagement: 'No Data'
      };
    }

    // Count messages per user
    const userMessages: Record<string, number> = {};
    let totalMessageLength = 0;

    messages.forEach(msg => {
      userMessages[msg.authorName] = (userMessages[msg.authorName] || 0) + 1;
      totalMessageLength += msg.message.length;
    });

    // Get unique users count
    const uniqueUsers = Object.keys(userMessages).length;

    // Sort users by message count and get top 5
    const topUsers = Object.entries(userMessages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([user, count]) => ({ user, count }));

    // Calculate average message length
    const averageMessageLength = Math.round(totalMessageLength / messages.length);

    // Determine engagement level
    let engagement = 'Low';
    const messagesPerMinute = messages.length / 5; // Assuming 5 minutes of data

    if (messagesPerMinute >= 30) {
      engagement = 'Very High';
    } else if (messagesPerMinute >= 15) {
      engagement = 'High';
    } else if (messagesPerMinute >= 5) {
      engagement = 'Moderate';
    }

    return {
      totalMessages: messages.length,
      uniqueUsers,
      topUsers,
      averageMessageLength,
      engagement
    };
  }, [messages]);

  const getEngagementColor = (level: string): string => {
    switch (level) {
      case 'Very High':
        return 'text-primary';
      case 'High':
        return 'text-success';
      case 'Moderate':
        return 'text-secondary';
      case 'Low':
        return 'text-warning';
      default:
        return 'text-muted';
    }
  };

  return (
    <div className="container-box">
      <div className="container-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h3 className="text-lg text-primary">Chat Analytics</h3>
          <div className="status-indicator" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
            Real-time
          </div>
        </div>

        <div className="grid grid-cols-2" style={{ gap: '16px', marginBottom: '24px' }}>
          {/* Total Messages Card */}
          <div className="container-box" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 className="text-sm text-muted">Total Messages</h4>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-primary">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
            </div>
            <p className="text-lg text-primary" style={{ fontWeight: '700', fontSize: '20px' }}>{stats.totalMessages.toLocaleString()}</p>
          </div>

          {/* Unique Users Card */}
          <div className="container-box" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 className="text-sm text-muted">Unique Users</h4>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-primary">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            </div>
            <p className="text-lg text-primary" style={{ fontWeight: '700', fontSize: '20px' }}>{stats.uniqueUsers.toLocaleString()}</p>
          </div>

          {/* Avg Message Length Card */}
          <div className="container-box" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 className="text-sm text-muted">Avg Length</h4>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-primary">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-lg text-primary" style={{ fontWeight: '700', fontSize: '20px' }}>{stats.averageMessageLength} chars</p>
          </div>

          {/* Engagement Level Card */}
          <div className="container-box" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 className="text-sm text-muted">Engagement</h4>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-primary">
                <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v6a1 1 0 102 0V7zm-3 2a1 1 0 10-2 0v4a1 1 0 102 0V9zm-3 3a1 1 0 10-2 0v1a1 1 0 102 0v-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className={`text-lg ${getEngagementColor(stats.engagement)}`} style={{ fontWeight: '700', fontSize: '20px' }}>{stats.engagement}</p>
          </div>
        </div>

        {/* Top Users Section */}
        {stats.topUsers.length > 0 && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 className="text-base text-secondary">Top Contributors</h3>
            </div>
            <div className="container-box" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-xs text-muted" style={{ padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', fontWeight: '600' }}>Rank</th>
                      <th className="text-xs text-muted" style={{ padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', fontWeight: '600' }}>User</th>
                      <th className="text-xs text-muted" style={{ padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', fontWeight: '600' }}>Messages</th>
                      <th className="text-xs text-muted" style={{ padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', fontWeight: '600' }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topUsers.map((user, index) => (
                      <tr key={user.user} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="text-sm text-secondary" style={{ padding: '12px 16px' }}>{index + 1}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '24px',
                              height: '24px',
                              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                              border: '1px solid var(--border-light)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <span className="text-xs" style={{ color: 'white', fontWeight: '600' }}>{user.user.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="text-sm text-primary" style={{ fontWeight: '500' }}>{user.user}</div>
                          </div>
                        </td>
                        <td className="text-sm text-secondary" style={{ padding: '12px 16px' }}>{user.count}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ 
                              width: '60px', 
                              height: '6px', 
                              background: 'var(--card-bg)', 
                              border: '1px solid var(--border)' 
                            }}>
                              <div 
                                style={{ 
                                  background: 'linear-gradient(to right, var(--primary), var(--accent))', 
                                  height: '100%',
                                  width: `${Math.round((user.count / stats.totalMessages) * 100)}%` 
                                }}
                              />
                            </div>
                            <span className="text-sm text-secondary">{Math.round((user.count / stats.totalMessages) * 100)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {stats.totalMessages === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ margin: '0 auto', color: 'var(--text-muted)' }}>
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-lg text-secondary" style={{ marginBottom: '8px' }}>No chat data yet</p>
            <p className="text-muted">Chat messages will appear as viewers engage</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EngagementStats; 