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
        return 'text-purple-500';
      case 'High':
        return 'text-green-500';
      case 'Moderate':
        return 'text-blue-500';
      case 'Low':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center mb-1">
        <h3 className="text-lg font-semibold text-white">
          <span className="inline-block mr-2 bg-purple-500 w-2 h-2 rounded-full"></span>
          Chat Stats
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Total Messages Card */}
        <div className="bg-gray-900 rounded-lg p-2 sm:p-3 border border-purple-500/20 shadow">
          <div className="flex items-center justify-between">
            <h4 className="text-gray-400 text-xs sm:text-sm font-medium truncate">Total Messages</h4>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
          </div>
          <p className="text-white text-lg sm:text-xl font-bold mt-1">{stats.totalMessages.toLocaleString()}</p>
        </div>

        {/* Unique Users Card */}
        <div className="bg-gray-900 rounded-lg p-2 sm:p-3 border border-purple-500/20 shadow">
          <div className="flex items-center justify-between">
            <h4 className="text-gray-400 text-xs sm:text-sm font-medium truncate">Unique Chatters</h4>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          </div>
          <p className="text-white text-lg sm:text-xl font-bold mt-1">{stats.uniqueUsers.toLocaleString()}</p>
        </div>

        {/* Avg Message Length Card */}
        <div className="bg-gray-900 rounded-lg p-2 sm:p-3 border border-purple-500/20 shadow">
          <div className="flex items-center justify-between">
            <h4 className="text-gray-400 text-xs sm:text-sm font-medium truncate">Avg Length</h4>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-white text-lg sm:text-xl font-bold mt-1">{stats.averageMessageLength} chars</p>
        </div>

        {/* Engagement Level Card */}
        <div className="bg-gray-900 rounded-lg p-2 sm:p-3 border border-purple-500/20 shadow">
          <div className="flex items-center justify-between">
            <h4 className="text-gray-400 text-xs sm:text-sm font-medium truncate">Engagement</h4>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v6a1 1 0 102 0V7zm-3 2a1 1 0 10-2 0v4a1 1 0 102 0V9zm-3 3a1 1 0 10-2 0v1a1 1 0 102 0v-1z" clipRule="evenodd" />
            </svg>
          </div>
          <p className={`text-lg sm:text-xl font-bold mt-1 ${getEngagementColor(stats.engagement)}`}>{stats.engagement}</p>
        </div>
      </div>

      {/* Top Users Section */}
      {stats.topUsers.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center mb-3">
            <h3 className="text-base font-semibold text-white">
              <span className="inline-block mr-2 bg-purple-500 w-1.5 h-1.5 rounded-full"></span>
              Top Chatters
            </h3>
          </div>
          <div className="bg-gray-900 rounded-lg overflow-hidden border border-purple-500/20">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-gray-800">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Rank</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Messages</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {stats.topUsers.map((user, index) => (
                    <tr key={user.user} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-6 w-6 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
                            <span className="text-xs font-medium text-white">{user.user.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-white">{user.user}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{user.count}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full" 
                              style={{ width: `${Math.round((user.count / stats.totalMessages) * 100)}%` }}
                            />
                          </div>
                          <span className="ml-2 text-gray-300">{Math.round((user.count / stats.totalMessages) * 100)}%</span>
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
        <div className="text-center py-8 text-gray-400 mt-4">
          <div className="mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-lg mb-1">No chat data yet</p>
          <p>Chat messages will appear as viewers engage</p>
        </div>
      )}
    </div>
  );
};

export default EngagementStats; 