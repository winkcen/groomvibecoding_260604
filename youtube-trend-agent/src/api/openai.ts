import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    client = new OpenAI({ apiKey: key });
  }
  return client;
}

const SYSTEM_PROMPT = `당신은 YouTube 콘텐츠 트렌드 분석 전문가입니다.
수집된 YouTube 데이터를 바탕으로 핵심 인사이트를 한국어로 제공하세요.
콘텐츠 크리에이터와 마케터가 즉시 활용할 수 있는 실용적인 분석을 작성하세요.`;

export async function callGPT(userContent: string): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content ?? '';
}
