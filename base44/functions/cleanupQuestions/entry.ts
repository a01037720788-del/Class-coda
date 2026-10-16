import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CHUNK_SIZE = 5;

function buildPrompt(questions, context) {
  return `당신은 교육 플랫폼의 문제 데이터 정리 전문가입니다.
아래 문제 목록을 분석하여 각 문제를 올바른 형식으로 정리해주세요.

## 문제 유형 규칙
- 객관식 (1개 선택): type="객관식", options=["보기1","보기2",...], answer="번호(1부터)"
- 객관식복수 (여러 개 선택): type="객관식복수", options=["보기1","보기2",...], answer="1,3" 형식
- OX 퀴즈: type="OX", answer="O" 또는 "X"
- 단답형: type="빈칸채우기", answer="정답단어"
- 코드 결과 예측: type="코드결과예측", code_items=[{"code":"코드","expected_output":"출력"}]
- 짝맞추기: type="짝맞추기", pairs=[{"left":"항목","right":"정답"}]
- 순서맞추기: type="순서맞추기", options=["1번째 항목","2번째 항목",...]
- 주관식 (서술형): type="주관식"

## 난이도 추정 규칙
- easy: 개념 확인, 용어 문제, 단순 OX
- medium: 코드 결과 예측, 빈칸채우기, 짝맞추기
- hard: 응용 문제, 복잡한 코드 분석, 복수선택

## 추가 컨텍스트
${context || "없음"}

## 정리할 문제 목록
${JSON.stringify(questions, null, 2)}

위 문제들을 정리하여 cleaned_questions 배열로 반환하세요.
각 문제는 다음 필드를 모두 포함해야 합니다:
number(숫자), type(문자열), question(문자열), options(배열), pairs(배열), code_items(배열), answer(문자열), explanation(문자열), difficulty(문자열: easy/medium/hard), code_block(문자열), expected_output(문자열)

중요:
- question 필드는 반드시 채워야 합니다
- 없는 필드는 빈 배열([]) 또는 빈 문자열("")로 채우세요
- 코드가 포함된 문제는 code_block에 코드를 분리하세요
- 불필요한 번호 접두사(Q1. 1. 등)는 question에서 제거하세요
- summary 필드에 처리 요약을 작성하세요`;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    cleaned_questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'number' },
          type: { type: 'string' },
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          pairs: { type: 'array', items: { type: 'object', properties: { left: { type: 'string' }, right: { type: 'string' } } } },
          code_items: { type: 'array', items: { type: 'object', properties: { code: { type: 'string' }, expected_output: { type: 'string' } } } },
          answer: { type: 'string' },
          explanation: { type: 'string' },
          difficulty: { type: 'string' },
          code_block: { type: 'string' },
          expected_output: { type: 'string' },
        },
        required: ['number', 'type', 'question', 'answer'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['cleaned_questions', 'summary'],
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // 커스텀 로그인 관리자도 사용 가능하도록 auth 실패해도 차단하지 않음
  let user = null;
  try {
    user = await base44.auth.me();
  } catch (_) {
    user = null;
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const { questions, context } = body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return Response.json({ error: '정리할 문제가 없습니다.' }, { status: 400 });
  }

  // 5개씩 청크로 나눠서 처리
  const chunks = [];
  for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
    chunks.push(questions.slice(i, i + CHUNK_SIZE));
  }

  const allCleaned = [];
  const summaries = [];

  for (const chunk of chunks) {
    try {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildPrompt(chunk, context),
        response_json_schema: RESPONSE_SCHEMA,
      });

      if (!result || !Array.isArray(result.cleaned_questions)) {
        // AI 응답 형식 오류 시 원본 청크 유지
        console.error("cleanupQuestions AI 응답 형식 오류:", result);
        for (const q of chunk) allCleaned.push(q);
        summaries.push("일부 문제 형식 오류로 원본 유지");
      } else {
        for (const q of result.cleaned_questions) allCleaned.push(q);
        if (result.summary) summaries.push(result.summary);
      }
    } catch (err) {
      // 청크 실패 시 해당 청크 원본 유지, 전체 실패 안 함
      console.error("cleanupQuestions 청크 오류:", err);
      for (const q of chunk) allCleaned.push(q);
      summaries.push(`일부 문제(${chunk.length}개) AI 정리 실패, 원본 유지`);
    }
  }

  // 번호 재정렬
  const reindexed = allCleaned.map((q, i) => ({ ...q, number: i + 1 }));

  return Response.json({
    success: true,
    cleaned_questions: reindexed,
    summary: summaries.join(' | ') || `${reindexed.length}개 문제 정리 완료`,
  });
});