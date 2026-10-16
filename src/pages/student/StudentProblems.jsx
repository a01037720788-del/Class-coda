import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Code2, ChevronRight, Filter } from "lucide-react";
import ProblemDetail from "@/components/judge/ProblemDetail";

const difficultyColors = {
  Bronze: "bg-amber-100 text-amber-700 border-amber-200",
  Silver: "bg-gray-100 text-gray-600 border-gray-200",
  Gold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Platinum: "bg-teal-100 text-teal-700 border-teal-200",
};

const ALGO_TYPES = ["전체", "입출력", "조건문", "반복문", "배열", "문자열", "브루트포스", "정렬", "그리디", "이진 탐색", "DFS/BFS", "DP", "자료구조"];

export default function StudentProblems() {
  const [problems, setProblems] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("전체");
  const [selectedProblem, setSelectedProblem] = useState(null);

  useEffect(() => {
    base44.entities.Problem.filter({ is_active: true }, "problem_number").then(setProblems);
  }, []);

  const filtered = problems.filter(p => {
    const matchSearch = !search || p.title?.toLowerCase().includes(search.toLowerCase()) || String(p.problem_number).includes(search);
    const matchType = selectedType === "전체" || p.algorithm_type === selectedType;
    return matchSearch && matchType;
  });

  if (selectedProblem) {
    return <ProblemDetail problem={selectedProblem} onBack={() => setSelectedProblem(null)} />;
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">문제 풀이</h2>
      <p className="text-sm text-gray-500 mb-6">알고리즘 문제를 풀어보세요.</p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="문제 번호 또는 제목으로 검색" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          {ALGO_TYPES.map(t => (
            <button key={t} onClick={() => setSelectedType(t)} className={`text-xs px-3 py-1 rounded-full border transition-colors ${selectedType === t ? "bg-[#7c3aed] text-white border-[#7c3aed]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#7c3aed]" />
            <span className="font-semibold text-gray-900 text-sm">문제 목록</span>
          </div>
          <Badge variant="outline" className="text-xs">{filtered.length}문제</Badge>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">번호</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">제목</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">유형</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">난이도</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(p => (
              <tr key={p.id} onClick={() => setSelectedProblem(p)} className="hover:bg-purple-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-[#7c3aed] text-sm">#{p.problem_number}</td>
                <td className="px-4 py-3 font-medium text-gray-900 text-sm">{p.title}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {p.algorithm_type && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{p.algorithm_type}</span>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {p.difficulty && <Badge className={`text-xs border ${difficultyColors[p.difficulty] || ""}`}>{p.difficulty}</Badge>}
                </td>
                <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-gray-400" /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">문제가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}