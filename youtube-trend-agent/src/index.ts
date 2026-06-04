import 'dotenv/config';
import { Command } from 'commander';
import { runOrchestrator } from './agents/orchestrator';
import { generateMarkdown, saveReport } from './utils/report';

const program = new Command();

program
  .name('youtube-trend-agent')
  .description('YouTube 트렌드 리서치 에이전트 — Phase 1 MVP')
  .version('0.1.0')
  .requiredOption('-k, --keyword <string>', '검색 키워드 (필수)')
  .option('-d, --days <number>', '분석 기간 (일)', '7')
  .option('-m, --max-results <number>', '수집할 최대 영상 수 (최대 50)', '20')
  .option('-o, --output <path>', '리포트 저장 경로 (없으면 stdout 출력)')
  .parse(process.argv);

const opts = program.opts();

async function main() {
  const options = {
    keyword: opts.keyword as string,
    days: parseInt(opts.days as string),
    maxResults: Math.min(50, parseInt(opts.maxResults as string)),
    outputPath: opts.output as string | undefined,
  };

  const report = await runOrchestrator(options);

  if (options.outputPath) {
    saveReport(report, options.outputPath);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log(generateMarkdown(report));
  }
}

main().catch((err) => {
  console.error(`\n오류 발생: ${err.message}`);
  process.exit(1);
});
