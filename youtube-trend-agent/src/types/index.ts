export interface VideoSearchItem {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface VideoStatsItem extends VideoSearchItem {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
  velocityScore: number;
  trendLabel: '🔥 급상승' | '📈 상승세' | '';
}

export interface ChannelStatsItem {
  channelId: string;
  channelTitle: string;
  subscriberCount: number;
  totalViewCount: number;
  videoCount: number;
}

export interface TrendReport {
  keyword: string;
  generatedAt: string;
  trendingSummary: string;
  topVideos: VideoStatsItem[];
  channelStats: ChannelStatsItem[];
  titlePatterns: string;
  contentIdeas: string;
}

export interface AgentOptions {
  keyword: string;
  days: number;
  maxResults: number;
  outputPath?: string;
}
