import { runSearchAgent } from './searchAgent';
import { runVideoStatsAgent } from './videoStatsAgent';
import { runChannelAnalysisAgent } from './channelAnalysisAgent';
import { runPatternAnalysisAgent } from './patternAnalysisAgent';
import { callGPT } from '../api/openai';
import { AgentOptions, TrendReport } from '../types';

export type ProgressCallback = (step: string, message: string) => void;

export async function runOrchestrator(
  options: AgentOptions,
  onProgress?: ProgressCallback
): Promise<TrendReport> {
  const log = (step: string, message: string) => {
    console.log(`[${step}] ${message}`);
    onProgress?.(step, message);
  };

  log('시작', `키워드: "${options.keyword}" | 기간: 최근 ${options.days}일`);

  // Step 1: 영상 검색
  log('1/5', '유튜브 영상 검색 중...');
  const searchResults = await runSearchAgent(options);
  if (searchResults.length === 0) {
    throw new Error('검색 결과가 없습니다. 키워드나 기간을 변경해보세요.');
  }
  log('1/5', `${searchResults.length}개 영상 수집 완료`);

  // Step 2: 영상 통계 수집
  log('2/5', '영상 통계 및 급상승 스코어 계산 중...');
  const videoStats = await runVideoStatsAgent(searchResults);
  log('2/5', '통계 수집 완료');

  // Step 3: 채널 분석
  log('3/5', '채널 정보 분석 중...');
  const channelIds = videoStats.map((v) => v.channelId);
  const channelStats = await runChannelAnalysisAgent(channelIds);
  log('3/5', '채널 분석 완료');

  // Step 4: 제목 패턴 분석 (전체 제목 사용)
  log('4/5', 'GPT-4o로 제목 패턴 분석 중...');
  const allTitles = videoStats.map((v) => v.title);
  const titlePatterns = await runPatternAnalysisAgent(allTitles);
  log('4/5', '제목 패턴 분석 완료');

  // Step 5: 트렌드 요약 (GPT)
  log('5/5', 'GPT-4o로 트렌드 요약 및 콘텐츠 아이디어 생성 중...');
  const top20 = videoStats.slice(0, 20);
  const trendingSummary = await callGPT(`
다음은 YouTube "${options.keyword}" 키워드로 최근 ${options.days}일간 가장 많이 본 영상 Top 20 데이터입니다.

${top20
  .map(
    (v, i) =>
      `${i + 1}. [${v.trendLabel || '일반'}] "${v.title}"
   - 채널: ${v.channelTitle} | 조회수: ${v.viewCount.toLocaleString()} | 시간당 조회수: ${v.velocityScore.toLocaleString()}`
  )
  .join('\n')}

위 데이터를 바탕으로 다음을 한국어로 작성해주세요:

1. **현재 급부상 중인 핵심 토픽 3~5개** (각 토픽당 2~3문장 해설)
2. **트렌드 배경 분석** (왜 지금 이 주제가 인기인지)
3. **크리에이터에게 주는 시사점** (어떤 콘텐츠를 만들어야 하는지)

실용적이고 구체적으로 작성해주세요.`);

  // Step 6: 채널별 콘텐츠 아이디어 (GPT)
  const contentIdeas = await callGPT(`
"${options.keyword}" 관련 YouTube 트렌드 요약:

${trendingSummary.slice(0, 1000)}

이를 바탕으로 다음 세 가지 채널 유형에 맞는 콘텐츠 아이디어를 각 3~4개씩 제안해주세요.
각 아이디어에는 추천 제목 후보 1개를 포함해주세요.

### NXP 블로그 (기술 분석, 깊이 있는 글)
### AI 뉴스 채널 (빠른 정보 전달, 숏폼 가능)
### 일반 채널 (대중적, 입문자 대상)

한국어로 작성해주세요.`);

  log('완료', '전체 분석 완료!');

  return {
    keyword: options.keyword,
    generatedAt: new Date().toISOString(),
    trendingSummary,
    topVideos: videoStats.slice(0, 10),
    channelStats,
    titlePatterns,
    contentIdeas,
  };
}
