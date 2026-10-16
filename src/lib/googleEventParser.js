// Google Calendar 일정 제목 파서
// 형식: H-17:00 신도헌 (NLCS/Y5/W1/Py)
// 또는: H-17:00 신도헌 (NLCS/Y5/Py)
// 또는: H-17:00 신도헌
// 또는: 신도헌 (NLCS/Y5/W1/Py)

// 과목 코드 → 과목명 매핑
const SUBJECT_CODE_MAP = {
  py: "Python",
  python: "Python",
  cpp: "C++",
  "c++": "C++",
  c: "C++",
  alg: "알고리즘 학습",
  algorithm: "알고리즘 학습",
  algo: "알고리즘 학습",
  jpy: "저학년 Python",
  jrpy: "저학년 Python",
  juniorpy: "저학년 Python",
  junior: "저학년 Python",
  java: "Java",
  html: "HTML",
  web: "HTML",
  entry: "엔트리",
  block: "블록코딩",
  cos: "COS",
};

// Subject entity type 값 → 표시 과목명
const SUBJECT_TYPE_TO_NAME = {
  python: "Python",
  junior_python: "저학년 Python",
  cpp: "C++",
  java: "Java",
  html: "HTML",
  algorithm_learning: "알고리즘 학습",
  algorithm: "알고리즘",
  entry: "엔트리",
  block: "블록코딩",
  cos: "COS",
};

/**
 * Google Calendar 제목을 파싱하여 구조화된 정보 반환
 * @param {string} rawTitle - Google Calendar 일정 제목
 * @returns {{prefix, display_time, student_name, school, grade, week_or_level, subject_code, subject_name}}
 */
export function parseGoogleEventTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== "string") {
    return { prefix: "", display_time: "", student_name: "", school: "", grade: "", week_or_level: "", subject_code: "", subject_name: "" };
  }

  const title = rawTitle.trim();
  const result = {
    prefix: "",
    display_time: "",
    student_name: "",
    school: "",
    grade: "",
    week_or_level: "",
    subject_code: "",
    subject_name: "",
  };

  // 1. 괄호 안 정보 추출: (NLCS/Y5/W1/Py)
  const parenMatch = title.match(/\(([^)]+)\)/);
  let parenContent = "";
  if (parenMatch) {
    parenContent = parenMatch[1].trim();
  }

  // 괄호 안 정보 분리: school/grade/week/subject_code
  if (parenContent) {
    const parts = parenContent.split("/").map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      const lower = part.toLowerCase();
      // 과목 코드 (마지막 요소이거나 알려진 코드)
      if (SUBJECT_CODE_MAP[lower]) {
        result.subject_code = part;
        result.subject_name = SUBJECT_CODE_MAP[lower];
        continue;
      }
      // 학년: Y5, Y6, G5 등
      if (/^[yg]\d+$/i.test(part) || /^[yg]\d+\-\d+$/i.test(part)) {
        result.grade = part;
        continue;
      }
      // 주차/레벨: W1, W2 등
      if (/^w\d+$/i.test(part)) {
        result.week_or_level = part;
        continue;
      }
      // 학교: NLCS, KIS 등 (과목 코드가 아닌 첫 번째 요소)
      if (!result.school) {
        result.school = part;
      }
    }
  }

  // 2. 괄호 외부 텍스트에서 prefix, time, student_name 추출
  const outsideText = title.replace(/\([^)]+\)/, "").trim();

  // 패턴: H-17:00 신도헌  또는  H-17:00 신도헌
  // prefix와 시간 추출: H-17:00, S-15:00 등
  const prefixTimeMatch = outsideText.match(/^([A-Za-z])\s*[-:]\s*(\d{1,2}:\d{2})\s*(.*)/);
  if (prefixTimeMatch) {
    result.prefix = prefixTimeMatch[1].toUpperCase();
    result.display_time = prefixTimeMatch[2];
    result.student_name = prefixTimeMatch[3].trim();
  } else {
    // 시간만 있는 경우: 17:00 신도헌
    const timeOnlyMatch = outsideText.match(/^(\d{1,2}:\d{2})\s+(.*)/);
    if (timeOnlyMatch) {
      result.display_time = timeOnlyMatch[1];
      result.student_name = timeOnlyMatch[2].trim();
    } else {
      // 시간 없이 이름만: 신도헌
      result.student_name = outsideText;
    }
  }

  // 학생 이름 정리: 특수문자 제거, 앞뒤 공백
  if (result.student_name) {
    result.student_name = result.student_name
      .replace(/^[\-:\s]+/, "")
      .replace(/[\-:\s]+$/, "")
      .trim();
  }

  return result;
}

/**
 * 파싱된 정보에서 과목 코드를 Subject 엔티티와 매칭
 * @param {object} parsedInfo - parseGoogleEventTitle 결과
 * @param {Array} subjects - Subject 엔티티 목록
 * @returns {{subject_id, subject_name} | null}
 */
export function matchSubjectFromParsed(parsedInfo, subjects) {
  if (!parsedInfo || !subjects || subjects.length === 0) return null;

  const code = (parsedInfo.subject_code || "").toLowerCase();
  const nameFromCode = parsedInfo.subject_name || (code ? SUBJECT_CODE_MAP[code] : "");

  if (!nameFromCode) return null;

  // 1. 과목명으로 매칭 (정확 일치)
  let match = subjects.find(s => s.name === nameFromCode && !s.is_deleted);
  if (match) return { subject_id: match.id, subject_name: match.name };

  // 2. Subject type으로 매칭
  const typeKey = Object.entries(SUBJECT_TYPE_TO_NAME).find(([, name]) => name === nameFromCode)?.[0];
  if (typeKey) {
    match = subjects.find(s => s.type === typeKey && !s.is_deleted);
    if (match) return { subject_id: match.id, subject_name: match.name };
  }

  // 3. 과목명 포함 매칭 (대소문자 무시)
  match = subjects.find(s => !s.is_deleted && s.name && s.name.toLowerCase().includes(nameFromCode.toLowerCase()));
  if (match) return { subject_id: match.id, subject_name: match.name };

  // 매칭 실패 시 과목명만 반환
  return { subject_id: "", subject_name: nameFromCode };
}

/**
 * 파싱된 학생 이름으로 Student 매칭 (학교/학년 검증 포함)
 * @param {object} parsedInfo - parseGoogleEventTitle 결과
 * @param {Array} students - Student 엔티티 목록
 * @returns {{matched: Array, ambiguous: boolean, reason: string}}
 */
export function matchStudentFromParsed(parsedInfo, students) {
  if (!parsedInfo || !parsedInfo.student_name) {
    return { matched: [], ambiguous: false, reason: "학생 이름 없음" };
  }

  const name = parsedInfo.student_name.trim();
  if (!name) return { matched: [], ambiguous: false, reason: "학생 이름 없음" };

  // 이름으로 1차 필터링
  const byName = students.filter(s => s.name === name);
  if (byName.length === 0) {
    return { matched: [], ambiguous: false, reason: `이름 "${name}"과 일치하는 학생 없음` };
  }
  if (byName.length === 1) {
    return { matched: [byName[0]], ambiguous: false, reason: "정상 연결" };
  }

  // 동명이인: 학교/학년으로 좁히기
  let candidates = byName;

  // 학교로 필터링
  if (parsedInfo.school) {
    const schoolLower = parsedInfo.school.toLowerCase();
    const bySchool = candidates.filter(s =>
      s.school_name && s.school_name.toLowerCase().includes(schoolLower)
    );
    if (bySchool.length > 0 && bySchool.length < candidates.length) {
      candidates = bySchool;
    }
  }

  // 학년으로 필터링
  if (parsedInfo.grade) {
    const gradeLower = parsedInfo.grade.toLowerCase();
    const byGrade = candidates.filter(s => {
      if (!s.grade) return false;
      const studentGrade = s.grade.toLowerCase();
      // Y5 ↔ Y5, 5학년 ↔ Y5 등 유연한 매칭
      const gradeNum = gradeLower.replace(/[^0-9]/g, "");
      const studentGradeNum = studentGrade.replace(/[^0-9]/g, "");
      return gradeNum && studentGradeNum && gradeNum === studentGradeNum;
    });
    if (byGrade.length > 0 && byGrade.length < candidates.length) {
      candidates = byGrade;
    }
  }

  if (candidates.length === 1) {
    return { matched: [candidates[0]], ambiguous: false, reason: "동명이인 → 학교/학년으로 식별" };
  }

  // 여전히 여러 명이면 ambiguous
  return {
    matched: [],
    ambiguous: true,
    reason: `동명이인 ${candidates.length}명: 학교/학년으로 식별 불가`,
  };
}

/**
 * 캘린더 표시용 짧은 라벨 생성
 * @param {object} schedule - ClassSchedule 레코드
 * @returns {string} "17:00 신도헌 · Py" 형태
 */
export function getScheduleShortLabel(schedule) {
  if (!schedule) return "";
  const time = schedule.start_time || "";
  const studentName = schedule.student_names?.[0] || schedule.parsed_info?.student_name || "";
  const subjectCode = schedule.parsed_info?.subject_code || "";
  const subjectName = schedule.subject_name && schedule.subject_name !== "미지정"
    ? schedule.subject_name
    : "";

  let label = "";
  if (time) label += time + " ";
  if (studentName) label += studentName;
  if (subjectCode) label += " · " + subjectCode;
  else if (subjectName) label += " · " + subjectName;
  return label.trim();
}