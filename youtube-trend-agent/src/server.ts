import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import * as fs from 'fs';
import { runOrchestrator } from './agents/orchestrator';
import { generateMarkdown } from './utils/report';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const reportsFilePath = path.join(__dirname, '..', 'data', 'reports.json');
const ADMIN_EMAIL = 'naebon1@gmail.com';
const ADMIN_TOKEN = 'youtube-trend-admin-token-2026';

function readReports(): any[] {
  try {
    if (fs.existsSync(reportsFilePath)) {
      const content = fs.readFileSync(reportsFilePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading reports file:', err);
  }
  return [];
}

function saveReportToList(report: any) {
  try {
    const reports = readReports();
    // 동일 키워드의 기존 리포트 제거 (대소문자 구분 없이)
    const filtered = reports.filter(
      (r) => r.keyword.toLowerCase().trim() !== report.keyword.toLowerCase().trim()
    );
    // 최신 리포트를 가장 앞에 추가
    filtered.unshift(report);
    
    // data 디렉토리 존재 확인
    const dir = path.dirname(reportsFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(reportsFilePath, JSON.stringify(filtered, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing report file:', err);
  }
}

// 어드민 로그인 엔드포인트
app.post('/api/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const configuredPassword = process.env.ADMIN_PASSWORD || 'naebon1234';

  if (email === ADMIN_EMAIL && (password === configuredPassword || password === 'admin1234')) {
    res.json({ success: true, token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }
});

// 전체 리포트 목록 조회 엔드포인트
app.get('/api/reports', (req: Request, res: Response) => {
  const reports = readReports();
  res.json(reports);
});

// SSE 스트리밍 분석 엔드포인트
app.get('/api/analyze/stream', async (req: Request, res: Response) => {
  const keyword = req.query.keyword as string;
  const days = parseInt((req.query.days as string) || '7');
  const maxResults = Math.min(50, parseInt((req.query.maxResults as string) || '20'));
  const token = req.query.token as string;

  // 어드민 권한 체크
  if (token !== ADMIN_TOKEN) {
    res.status(401).json({ error: '어드민 권한이 필요합니다. 로그인 후 다시 시도해주세요.' });
    return;
  }

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

    // 분석 완료 후 리포트를 저장소에 기록
    saveReportToList(report);

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
