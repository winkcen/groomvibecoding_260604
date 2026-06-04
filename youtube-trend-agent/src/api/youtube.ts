import axios from 'axios';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.');
  return key;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function searchVideos(
  keyword: string,
  maxResults: number,
  daysAgo: number
): Promise<any[]> {
  const publishedAfter = new Date(
    Date.now() - daysAgo * 24 * 60 * 60 * 1000
  ).toISOString();

  const response = await axios.get(`${BASE_URL}/search`, {
    params: {
      key: getApiKey(),
      q: keyword,
      type: 'video',
      order: 'viewCount',
      publishedAfter,
      regionCode: 'KR',
      relevanceLanguage: 'ko',
      maxResults,
      part: 'snippet',
    },
  });

  return response.data.items ?? [];
}

export async function getVideoStats(videoIds: string[]): Promise<any[]> {
  const chunks = chunkArray(videoIds, 50);
  const results: any[] = [];

  for (const chunk of chunks) {
    const response = await axios.get(`${BASE_URL}/videos`, {
      params: {
        key: getApiKey(),
        id: chunk.join(','),
        part: 'statistics,snippet,contentDetails',
      },
    });
    results.push(...(response.data.items ?? []));
  }

  return results;
}

export async function getChannelStats(channelIds: string[]): Promise<any[]> {
  const uniqueIds = [...new Set(channelIds)];
  const chunks = chunkArray(uniqueIds, 50);
  const results: any[] = [];

  for (const chunk of chunks) {
    const response = await axios.get(`${BASE_URL}/channels`, {
      params: {
        key: getApiKey(),
        id: chunk.join(','),
        part: 'statistics,snippet',
      },
    });
    results.push(...(response.data.items ?? []));
  }

  return results;
}
