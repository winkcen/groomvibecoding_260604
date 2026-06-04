import { getVideoStats } from '../api/youtube';
import { VideoSearchItem, VideoStatsItem } from '../types';

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? '0');
  const minutes = parseInt(match[2] ?? '0');
  const seconds = parseInt(match[3] ?? '0');
  return hours * 3600 + minutes * 60 + seconds;
}

function calcVelocity(viewCount: number, publishedAt: string): { score: number; label: VideoStatsItem['trendLabel'] } {
  const hoursSince = Math.max(1, (Date.now() - new Date(publishedAt).getTime()) / 3_600_000);
  const score = Math.round(viewCount / hoursSince);

  const daysSince = hoursSince / 24;
  let label: VideoStatsItem['trendLabel'] = '';
  if (daysSince <= 1 && score > 10_000) label = '🔥 급상승';
  else if (daysSince <= 7 && score > 3_000) label = '📈 상승세';

  return { score, label };
}

export async function runVideoStatsAgent(searchResults: VideoSearchItem[]): Promise<VideoStatsItem[]> {
  console.log(`[Video Stats Agent] ${searchResults.length}개 영상 통계 수집 중...`);

  const videoIds = searchResults.map((v) => v.videoId);
  const rawStats = await getVideoStats(videoIds);

  const statsMap = new Map<string, any>(rawStats.map((item: any) => [item.id, item]));

  const results: VideoStatsItem[] = searchResults.map((search) => {
    const raw = statsMap.get(search.videoId);
    const viewCount = parseInt(raw?.statistics?.viewCount ?? '0');
    const likeCount = parseInt(raw?.statistics?.likeCount ?? '0');
    const commentCount = parseInt(raw?.statistics?.commentCount ?? '0');
    const duration = raw?.contentDetails?.duration ?? 'PT0S';
    const { score, label } = calcVelocity(viewCount, search.publishedAt);

    return {
      ...search,
      viewCount,
      likeCount,
      commentCount,
      duration: formatDuration(parseISO8601Duration(duration)),
      velocityScore: score,
      trendLabel: label,
    };
  });

  const sorted = results.sort((a, b) => b.viewCount - a.viewCount);
  console.log(`[Video Stats Agent] 통계 수집 완료`);
  return sorted;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
