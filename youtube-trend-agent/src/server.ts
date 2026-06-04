import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { runOrchestrator } from './agents/orchestrator';
import { generateMarkdown } from './utils/report';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// SSE 스트리밍 분석 엔드포인트
app.get('/api/analyze/stream', async (req: Request, res: Response) => {
  const keyword = req.query.keyword as string;
  const days = parseInt((req.query.days as string) || '7');
  const maxResults = Math.min(50, parseInt((req.query.maxResults as string) || '20'));

  if (!keyword?.trim()) {
    res.status(400).json({ error: '키워드를 입력해주세요.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const report = await runOrchestrator(
      { keyword, days, maxResults },
      (step, message) => {
        send('progress', { step, message });
      }
    );

    const markdown = generateMarkdown(report);
    send('done', { report, markdown });
  } catch (err: any) {
    send('error', { message: err.message });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(` YouTube 트렌드 리서치 에이전트`);
  console.log(` 서버 실행 중: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
