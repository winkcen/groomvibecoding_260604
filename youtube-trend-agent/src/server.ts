import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import * as fs from 'fs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import { runOrchestrator } from './agents/orchestrator';
import { generateMarkdown } from './utils/report';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const reportsFilePath = path.join(__dirname, '..', 'data', 'reports.json');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.admin_email || 'naebon1@gmail.com';
const JWT_SECRET = process.env.JWT_SECRET || process.env.jwt_secreat || 'jwt-secret-key-2026';
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || process.env.nextauth_url || 'http://localhost:3000';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.google_client_id;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.google_client_secret;

let memoryReports: any[] = [];

function readReports(): any[] {
  if (memoryReports.length > 0) {
    return memoryReports;
  }
  try {
    if (fs.existsSync(reportsFilePath)) {
      const content = fs.readFileSync(reportsFilePath, 'utf-8');
      memoryReports = JSON.parse(content);
      return memoryReports;
    }
  } catch (err) {
    console.error('Error reading reports file:', err);
  }
  return [];
}

function saveReportToList(report: any) {
  const reports = readReports();
  // 동일 키워드의 기존 리포트 제거 (대소문자 구분 없이)
  const filtered = reports.filter(
    (r) => r.keyword.toLowerCase().trim() !== report.keyword.toLowerCase().trim()
  );
  // 최신 리포트를 가장 앞에 추가
  filtered.unshift(report);
  memoryReports = filtered; // 항상 인메모리 리스트 최신화
  
  try {
    // data 디렉토리 존재 확인
    const dir = path.dirname(reportsFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(reportsFilePath, JSON.stringify(filtered, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('ReadOnly Filesystem Warning (Vercel): Saved in-memory instead of reports.json.', err.message);
  }
}

// 어드민 로그인 엔드포인트
app.post('/api/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const configuredPassword = process.env.ADMIN_PASSWORD || 'naebon1234';

  if (email === ADMIN_EMAIL && (password === configuredPassword || password === 'admin1234')) {
    const token = jwt.sign(
      { email: ADMIN_EMAIL, name: 'Admin', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ success: true, token, email: ADMIN_EMAIL, role: 'admin' });
  } else {
    res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }
});

// 전체 리포트 목록 조회 엔드포인트
app.get('/api/reports', (req: Request, res: Response) => {
  const reports = readReports();
  res.json(reports);
});

// 구글 로그인 시작 엔드포인트
app.get('/api/auth/google', (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: 'GOOGLE_CLIENT_ID가 설정되지 않았습니다.' });
    return;
  }
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${NEXTAUTH_URL}/api/auth/callback/google`;
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent'
    }).toString();

  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000, path: '/' });
  res.redirect(googleAuthUrl);
});

// 구글 콜백 엔드포인트
app.get('/api/auth/callback/google', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect('/?error=google_auth_failed');
    return;
  }

  const savedState = req.headers.cookie?.match(/(?:^|;)\s*oauth_state=([^;]+)/)?.[1];
  if (!code || !state || state !== savedState) {
    res.redirect('/?error=invalid_state');
    return;
  }

  try {
    const redirectUri = `${NEXTAUTH_URL}/api/auth/callback/google`;
    
    // Authorization Code -> Access Token 교환
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token } = tokenRes.data;

    // Google 사용자 정보 조회
    const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const googleUser = userRes.data;
    const email = googleUser.email;
    const name = googleUser.name || '';
    const picture = googleUser.picture || '';

    if (!email) {
      res.redirect('/?error=no_email');
      return;
    }

    // naebon1@gmail.com 계정은 admin, 그 외 계정은 user 역할 부여
    const role = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim() ? 'admin' : 'user';

    // JWT 토큰 발급
    const token = jwt.sign(
      { email, name, picture, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.clearCookie('oauth_state');
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
    
    // 프론트엔드로 인증 정보와 함께 리다이렉트
    res.redirect(`/?token=${token}&email=${encodeURIComponent(email)}&role=${role}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(picture)}`);
  } catch (err: any) {
    console.error('Google Auth Error:', err.message);
    res.redirect('/?error=auth_error');
  }
});

// SSE 스트리밍 분석 엔드포인트
app.get('/api/analyze/stream', async (req: Request, res: Response) => {
  const keyword = req.query.keyword as string;
  const days = parseInt((req.query.days as string) || '7');
  const maxResults = Math.min(50, parseInt((req.query.maxResults as string) || '20'));
  const token = req.query.token as string;

  // 어드민 권한 체크
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      res.status(401).json({ error: '어드민 권한이 필요합니다. 로그인 후 다시 시도해주세요.' });
      return;
    }
  } catch (err) {
    res.status(401).json({ error: '인증 세션이 만료되었거나 올바르지 않습니다. 다시 로그인해주세요.' });
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

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(` YouTube 트렌드 리서치 에이전트`);
    console.log(` 서버 실행 중: http://localhost:${PORT}`);
    console.log(`========================================\n`);
  });
}

export default app;
