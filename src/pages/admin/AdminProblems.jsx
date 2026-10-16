import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import ProblemManagement from "@/components/admin/ProblemManagement";

export default function AdminProblems() {
  const [algoSubject, setAlgoSubject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlgoSubject();
  }, []);

  const loadAlgoSubject = async () => {
    const subjects = await base44.entities.Subject.list();
    let algo = subjects.find(s => s.name === "알고리즘");
    // 알고리즘 과목이 없으면 자동 생성
    if (!algo) {
      algo = await base44.entities.Subject.create({
        name: "알고리즘",
        description: "알고리즘 문제 풀이",
        color: "#3B82F6",
        is_active: true,
      });
    }
    setAlgoSubject(algo);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-gray-400 text-sm">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">문제 관리</h2>
      <p className="text-gray-500 text-sm mb-6">알고리즘 문제를 추가하고 관리합니다.</p>
      {algoSubject && <ProblemManagement subject={algoSubject} />}
    </div>
  );
}