import { searchVideos } from '../api/youtube';
import { VideoSearchItem, AgentOptions } from '../types';

export async function runSearchAgent(options: AgentOptions): Promise<VideoSearchItem[]> {
  console.log(`\n[Search Agent] 키워드 "${options.keyword}" 검색 중... (최근 ${options.days}일)`);

  const items = await searchVideos(options.keyword, options.maxResults, options.days);

  const results: VideoSearchItem[] = items.map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? '',
  }));

  console.log(`[Search Agent] ${results.length}개 영상 수집 완료`);
  return results;
}
