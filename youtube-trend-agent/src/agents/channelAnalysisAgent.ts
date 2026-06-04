import { getChannelStats } from '../api/youtube';
import { ChannelStatsItem } from '../types';

export async function runChannelAnalysisAgent(channelIds: string[]): Promise<ChannelStatsItem[]> {
  const uniqueIds = [...new Set(channelIds)];
  console.log(`[Channel Agent] ${uniqueIds.length}개 채널 분석 중...`);

  const rawChannels = await getChannelStats(uniqueIds);

  const results: ChannelStatsItem[] = rawChannels.map((item: any) => ({
    channelId: item.id,
    channelTitle: item.snippet?.title ?? '',
    subscriberCount: parseInt(item.statistics?.subscriberCount ?? '0'),
    totalViewCount: parseInt(item.statistics?.viewCount ?? '0'),
    videoCount: parseInt(item.statistics?.videoCount ?? '0'),
  }));

  console.log(`[Channel Agent] 채널 분석 완료`);
  return results;
}
