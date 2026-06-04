import { callGPT } from '../api/openai';

export async function runPatternAnalysisAgent(titles: string[]): Promise<string> {
  console.log(`[Pattern Agent] ${titles.length}개 제목 패턴 분석 중...`);

  const prompt = `다음은 YouTube에서 조회수가 높은 영상 제목 목록입니다.

${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

위 제목들을 분석하여 다음을 한국어로 작성해주세요:

1. **자주 등장하는 패턴** (숫자 포함, 질문형, 비교형, 충격/반전 키워드 등)
2. **인기 키워드 Top 5** (빈도 기준)
3. **추천 제목 공식 2~3개** (예: "[숫자]가지 [키워드] 방법", "왜 [현상]이 일어나는가?" 등)

간결하고 실용적으로 작성해주세요.`;

  const result = await callGPT(prompt);
  console.log(`[Pattern Agent] 패턴 분석 완료`);
  return result;
}
