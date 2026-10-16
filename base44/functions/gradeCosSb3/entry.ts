import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import JSZip from 'npm:jszip@3.10.1';

// ── sb3 파일에서 project.json 추출 ──────────────────────────────────────────
const extractProjectJson = async (fileUrl, label) => {
  let res;
  try { res = await fetch(fileUrl); } catch (e) {
    throw new Error(`${label} 다운로드 실패: 네트워크 오류`);
  }
  if (!res.ok) throw new Error(`${label} 다운로드 실패: HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer().catch(() => { throw new Error(`${label} 읽기 실패`); });
  const zip = await JSZip.loadAsync(arrayBuffer).catch(() => { throw new Error(`${label} sb3 압축 해제 실패`); });
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error(`${label} project.json 없음`);
  const text = await projectFile.async('text').catch(() => { throw new Error(`${label} project.json 읽기 실패`); });
  try { return JSON.parse(text); } catch (e) { throw new Error(`${label} project.json 파싱 실패`); }
};

// ── 구조 비교 채점 로직 ──────────────────────────────────────────────────────

/**
 * 값 정규화: "10"↔10, ["front", null]↔["front"] 처럼 의미 동일한 값을 통일
 */
const normalizeValue = (v) => {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) {
    // null/undefined 끝 요소 제거
    const trimmed = [...v];
    while (trimmed.length > 0 && (trimmed[trimmed.length - 1] === null || trimmed[trimmed.length - 1] === undefined)) {
      trimmed.pop();
    }
    return trimmed.map(normalizeValue);
  }
  if (typeof v === 'string') {
    const num = Number(v);
    if (!isNaN(num) && v.trim() !== '') return num;
    return v;
  }
  return v;
};

const normEq = (a, b) => JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));

/**
 * 블록 맵에서 루트 블록(parent==null, opcode 있음)을 찾아
 * 블록 체인을 순서대로 직렬화한다 (ID 제외, opcode/inputs/fields만)
 */
const serializeBlockChain = (blocksObj, startId) => {
  const result = [];
  let id = startId;
  const visited = new Set();
  while (id && !visited.has(id)) {
    visited.add(id);
    const b = blocksObj[id];
    if (!b || !b.opcode) break;

    // inputs: ID 참조를 재귀 직렬화로 치환
    const inputs = {};
    for (const [key, inputArr] of Object.entries(b.inputs || {})) {
      inputs[key] = inputArr.map(item => {
        if (typeof item === 'string' && blocksObj[item]) {
          return serializeBlockChain(blocksObj, item);
        }
        return normalizeValue(item);
      });
    }

    // fields: ID 부분(인덱스1의 ID 문자열) 제거
    const fields = {};
    for (const [key, fieldArr] of Object.entries(b.fields || {})) {
      fields[key] = [normalizeValue(fieldArr[0])]; // index 0만 (이름/값), index 1은 variable ID → 무시
    }

    result.push({ opcode: b.opcode, inputs, fields });
    id = b.next;
  }
  return result;
};

/**
 * 한 스프라이트의 블록 구조를 "루트별 체인 배열"로 직렬화
 */
const serializeSprite = (target) => {
  const blocksObj = target.blocks || {};
  const roots = Object.entries(blocksObj)
    .filter(([, b]) => b.opcode && (b.parent === null || b.parent === undefined))
    .map(([id]) => serializeBlockChain(blocksObj, id));
  // 루트 체인들을 JSON 문자열로 정렬 (순서 독립적)
  return roots.map(c => JSON.stringify(c)).sort();
};

/**
 * 두 프로젝트를 구조적으로 비교한다
 * 반환: { correct, differences, ignored_differences }
 */
const compareProjects = (studentProj, answerProj) => {
  const differences = [];
  const ignored = [];

  const sTargets = studentProj.targets || [];
  const aTargets = answerProj.targets || [];

  const sSprites = sTargets.filter(t => !t.isStage);
  const aSprites = aTargets.filter(t => !t.isStage);
  const sStage = sTargets.find(t => t.isStage);
  const aStage = aTargets.find(t => t.isStage);

  // ── 1. 스프라이트 이름 비교 ──
  const sNames = sSprites.map(s => s.name).sort();
  const aNames = aSprites.map(s => s.name).sort();
  if (JSON.stringify(sNames) !== JSON.stringify(aNames)) {
    differences.push(`스프라이트 이름 불일치: 정답[${aNames.join(', ')}] vs 학생[${sNames.join(', ')}]`);
  }

  // ── 2. 변수/리스트 비교 (stage + 각 스프라이트) ──
  const collectVars = (targets) => {
    const vars = {};
    for (const t of targets) {
      for (const [, v] of Object.entries(t.variables || {})) vars[v[0]] = normalizeValue(v[1]);
      for (const [, l] of Object.entries(t.lists || {})) vars[`[list]${l[0]}`] = (l[1] || []).map(normalizeValue);
    }
    return vars;
  };
  const sVars = collectVars(sTargets);
  const aVars = collectVars(aTargets);
  const allVarKeys = new Set([...Object.keys(sVars), ...Object.keys(aVars)]);
  for (const k of allVarKeys) {
    if (!(k in aVars)) { differences.push(`추가 변수/리스트: "${k}"`); continue; }
    if (!(k in sVars)) { differences.push(`누락 변수/리스트: "${k}"`); continue; }
    if (JSON.stringify(sVars[k]) !== JSON.stringify(aVars[k])) {
      differences.push(`변수 초기값 불일치 "${k}": 정답=${JSON.stringify(aVars[k])}, 학생=${JSON.stringify(sVars[k])}`);
    }
  }

  // ── 3. 방송 메시지 비교 ──
  const collectMessages = (targets) => {
    const msgs = new Set();
    for (const t of targets) {
      for (const [, m] of Object.entries(t.broadcasts || {})) msgs.add(m);
    }
    return msgs;
  };
  const sMsgs = collectMessages(sTargets);
  const aMsgs = collectMessages(aTargets);
  for (const m of aMsgs) { if (!sMsgs.has(m)) differences.push(`누락 방송 메시지: "${m}"`); }
  for (const m of sMsgs) { if (!aMsgs.has(m)) differences.push(`추가 방송 메시지: "${m}"`); }

  // ── 4. 의상/소리 이름 비교 (스프라이트별) ──
  for (const aSprite of aSprites) {
    const sSprite = sSprites.find(s => s.name === aSprite.name);
    if (!sSprite) continue; // 스프라이트 불일치는 위에서 이미 처리

    const aCostumes = (aSprite.costumes || []).map(c => c.name).sort();
    const sCostumes = (sSprite.costumes || []).map(c => c.name).sort();
    if (JSON.stringify(aCostumes) !== JSON.stringify(sCostumes)) {
      differences.push(`[${aSprite.name}] 의상 불일치: 정답[${aCostumes.join(', ')}] vs 학생[${sCostumes.join(', ')}]`);
    }

    const aSounds = (aSprite.sounds || []).map(s => s.name).sort();
    const sSounds = (sSprite.sounds || []).map(s => s.name).sort();
    if (JSON.stringify(aSounds) !== JSON.stringify(sSounds)) {
      differences.push(`[${aSprite.name}] 소리 불일치: 정답[${aSounds.join(', ')}] vs 학생[${sSounds.join(', ')}]`);
    }
  }

  // ── 5. 블록 구조 비교 (스프라이트별 + 무대) ──
  const compareTargetBlocks = (sTarget, aTarget, label) => {
    const sChains = serializeSprite(sTarget);
    const aChains = serializeSprite(aTarget);

    // 정답에 있는 체인이 학생에게 없으면 → 차이
    for (const ac of aChains) {
      if (!sChains.includes(ac)) {
        const parsed = JSON.parse(ac);
        const opcodes = parsed.map(b => b.opcode).join(' → ');
        differences.push(`[${label}] 누락 블록 체인: ${opcodes}`);
      }
    }
    // 학생에게만 있는 체인 → 추가 (무시 목록)
    for (const sc of sChains) {
      if (!aChains.includes(sc)) {
        const parsed = JSON.parse(sc);
        const opcodes = parsed.map(b => b.opcode).join(' → ');
        ignored.push(`[${label}] 추가 블록 체인(정답 무관): ${opcodes}`);
      }
    }
  };

  for (const aSprite of aSprites) {
    const sSprite = sSprites.find(s => s.name === aSprite.name);
    if (sSprite) compareTargetBlocks(sSprite, aSprite, aSprite.name);
  }
  if (sStage && aStage) compareTargetBlocks(sStage, aStage, '무대');

  const correct = differences.length === 0;
  return { correct, differences, ignored_differences: ignored };
};

// ── AI 채점용 프로젝트 요약 ─────────────────────────────────────────────────
const summarizeProject = (proj) => {
  if (!proj) return null;
  const targets = proj.targets || [];
  const sprites = targets.filter(t => !t.isStage);
  const stage = targets.find(t => t.isStage);
  const extractBlocks = (blocksObj) =>
    Object.values(blocksObj || {}).filter(b => b.opcode).map(b => b.opcode);
  const allOpcodes = targets.flatMap(t => extractBlocks(t.blocks));
  const uniqueOpcodes = [...new Set(allOpcodes)];
  return {
    sprite_count: sprites.length,
    sprite_names: sprites.map(s => s.name),
    stage_backdrops: stage?.costumes?.length || 0,
    total_block_count: allOpcodes.length,
    unique_opcodes_count: uniqueOpcodes.length,
    has_events: uniqueOpcodes.some(op => op.startsWith('event_')),
    has_motion: uniqueOpcodes.some(op => op.startsWith('motion_')),
    has_loops: uniqueOpcodes.some(op => ['control_repeat', 'control_repeat_until', 'control_forever'].includes(op)),
    has_variables: uniqueOpcodes.some(op => op.startsWith('data_setvariable') || op.startsWith('data_changevariable')),
    has_sound: uniqueOpcodes.some(op => op.startsWith('sound_')),
    has_looks: uniqueOpcodes.some(op => op.startsWith('looks_')),
    has_conditionals: uniqueOpcodes.some(op => ['control_if', 'control_if_else'].includes(op)),
    opcodes_sample: uniqueOpcodes.slice(0, 50),
    variables: (proj.variables ? Object.values(proj.variables).map(v => v[0]) : []),
    lists: (proj.lists ? Object.values(proj.lists).map(v => v[0]) : []),
  };
};

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // 인증: 실패해도 차단하지 않음 (커스텀 학생 로그인 지원)
  try { await base44.auth.me(); } catch (e) { /* ignore */ }

  let body;
  try { body = await req.json(); } catch (e) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { student_file_url, answer_file_url, problem_description, grading_mode } = body;

  if (!student_file_url) {
    return Response.json({ error: '학생 파일 URL이 없습니다.' }, { status: 400 });
  }

  // 학생 파일 추출 (필수)
  let studentProject;
  try {
    studentProject = await extractProjectJson(student_file_url, "학생 파일");
  } catch (e) {
    console.error("학생 파일 처리 실패:", e.message);
    return Response.json({
      success: false, correct: false, score: 0, score_breakdown: {},
      feedback: [e.message, "제출은 저장되었으며 선생님 확인이 필요합니다."],
      pending_manual_review: true, error: e.message,
    }, { status: 200 });
  }

  // 정답 파일 추출 (선택 — 실패해도 계속)
  let answerProject = null;
  if (answer_file_url) {
    try {
      answerProject = await extractProjectJson(answer_file_url, "정답 파일");
    } catch (e) {
      console.warn("정답 파일 분석 실패 (무시하고 계속):", e.message);
    }
  }

  // ── 구조 비교 모드 ──
  if (grading_mode === 'structure' && answerProject) {
    try {
      const { correct, differences, ignored_differences } = compareProjects(studentProject, answerProject);
      const score = correct ? 100 : Math.max(0, 100 - differences.length * 20);
      const feedback = correct
        ? ["정답입니다! 프로젝트 구조가 정답과 일치합니다."]
        : differences.slice(0, 5);
      return Response.json({
        success: true,
        grading_mode: 'structure',
        correct,
        score,
        score_breakdown: {},
        feedback,
        differences,
        ignored_differences,
      });
    } catch (e) {
      console.error("구조 비교 실패:", e.message);
      // 구조 비교 실패 시 AI 채점으로 fallback
    }
  }

  // ── AI 채점 모드 ──
  const studentSummary = summarizeProject(studentProject);
  const answerSummary = answerProject ? summarizeProject(answerProject) : null;

  const prompt = `
당신은 스크래치(Scratch) 프로그래밍 채점 전문가입니다.
학생이 제출한 스크래치 프로젝트를 채점해주세요.

## 문제 설명
${problem_description || '(문제 설명 없음)'}

## 정답 프로젝트 특징
${answerSummary ? JSON.stringify(answerSummary, null, 2) : '(정답 파일 없음 - 문제 설명 기반으로만 채점)'}

## 학생 제출 프로젝트 특징
${JSON.stringify(studentSummary, null, 2)}

## 채점 기준 (각 20점, 총 100점)
1. 이벤트 블록 사용 (event_ 계열): 20점
2. 동작/출력 블록 사용 (motion_, looks_, sound_ 계열): 20점
3. 반복문 사용 (control_repeat, control_forever, control_repeat_until): 20점
4. 변수 사용 (data_setvariable, data_changevariable): 20점
5. 최종 목표 달성 (문제 설명의 핵심 요구사항 충족): 20점

## 응답 형식 (반드시 이 JSON만 반환)
{
  "score": <0~100 숫자>,
  "correct": <score >= 60이면 true, 아니면 false>,
  "score_breakdown": {
    "events": <0~20>,
    "motion": <0~20>,
    "loops": <0~20>,
    "variables": <0~20>,
    "goal": <0~20>
  },
  "feedback": [<구체적 피드백 문장 1~5개>]
}

정답 파일과 완전히 동일하지 않더라도 문제를 해결했다면 정답으로 인정하세요.
반드시 JSON 형식으로만 응답하세요.
`.trim();

  try {
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          score: { type: "number" },
          correct: { type: "boolean" },
          score_breakdown: {
            type: "object",
            properties: {
              events: { type: "number" }, motion: { type: "number" },
              loops: { type: "number" }, variables: { type: "number" }, goal: { type: "number" },
            }
          },
          feedback: { type: "array", items: { type: "string" } },
        },
        required: ["score", "correct", "feedback"]
      }
    });

    return Response.json({
      success: true,
      grading_mode: 'ai',
      score: aiResult.score ?? 0,
      correct: aiResult.correct ?? false,
      score_breakdown: aiResult.score_breakdown ?? {},
      feedback: aiResult.feedback ?? [],
    });

  } catch (error) {
    console.error("AI 채점 실패:", error);
    return Response.json({
      success: false, correct: false, score: 0, score_breakdown: {},
      feedback: [
        error?.message || "AI 채점 중 오류가 발생했습니다.",
        "제출은 저장되었으며 선생님 확인이 필요합니다.",
      ],
      pending_manual_review: true,
      error: error?.message || "Unknown error",
    }, { status: 200 });
  }
});