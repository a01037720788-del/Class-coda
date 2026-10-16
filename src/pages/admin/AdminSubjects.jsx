import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import PythonUnitManagement from "@/components/admin/PythonUnitManagement";
import JuniorPythonUnitManagement from "@/components/admin/JuniorPythonUnitManagement";
import CppUnitManagement from "@/components/admin/CppUnitManagement";
import { SIMPLE_SUBJECTS } from "@/lib/subjects";

// 지원 과목 → 단원 관리 화면 매핑 (3과목 전용)
const MANAGEMENT_BY_KEY = {
  python: PythonUnitManagement,
  junior_python: JuniorPythonUnitManagement,
  cpp: CppUnitManagement,
};

export default function AdminSubjects() {
  const [activeKey, setActiveKey] = useState(SIMPLE_SUBJECTS[0].key);
  const ActiveManagement = MANAGEMENT_BY_KEY[activeKey];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">과목 관리</h1>
          <p className="text-xs text-gray-400">Python · 저학년 Python · C++ 3과목만 관리합니다.</p>
        </div>
      </div>

      {/* 과목 선택 */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit max-w-full">
        {SIMPLE_SUBJECTS.map(sub => (
          <button
            key={sub.key}
            onClick={() => setActiveKey(sub.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeKey === sub.key
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {sub.name}
          </button>
        ))}
      </div>

      {/* 선택한 과목의 단원 관리 */}
      {ActiveManagement && <ActiveManagement />}
    </div>
  );
}