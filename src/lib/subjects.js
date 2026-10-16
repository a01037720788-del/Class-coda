// 학생 전용 사이트에서 지원하는 3개 과목 정의
// key: 내부 식별자(subjectAccess key) / name: Student.subjects & subject_permissions 에 저장되는 이름

export const SIMPLE_SUBJECTS = [
  { key: "python", name: "Python" },
  { key: "junior_python", name: "저학년 Python" },
  { key: "cpp", name: "C++" },
];

export const SIMPLE_SUBJECT_NAMES = SIMPLE_SUBJECTS.map(s => s.name);