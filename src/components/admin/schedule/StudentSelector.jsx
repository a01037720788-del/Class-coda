import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, User, X } from "lucide-react";

export default function StudentSelector({ students, selectedIds, selectedNames, onToggle, onRemove }) {
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState(students);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      students.filter(s =>
        !q ||
        s.name?.toLowerCase().includes(q) ||
        s.grade?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.subjects?.some(sub => sub.toLowerCase().includes(q))
      )
    );
  }, [search, students]);

  return (
    <div>
      <Label className="font-semibold text-gray-800">① 학생 선택 *</Label>
      <div className="mt-1.5 border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="이름, 학년, 수강 과목으로 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm border-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="max-h-36 overflow-y-auto">
          {filtered.map(s => {
            const isSelected = selectedIds.includes(s.id);
            return (
              <div key={s.id} onClick={() => onToggle(s)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
              >
                <input type="checkbox" checked={isSelected} onChange={() => {}} className="pointer-events-none" />
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium text-gray-900">{s.name}</span>
                {s.grade && <span className="text-gray-400 text-xs">{s.grade}</span>}
                {s.subjects?.length > 0 && (
                  <span className="text-xs text-gray-300 ml-auto">{s.subjects.slice(0, 2).join(", ")}</span>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-gray-400 text-sm">검색 결과 없음</div>
          )}
        </div>
      </div>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedIds.map((id, idx) => (
            <span key={id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
              {selectedNames[idx]}
              <button onClick={() => onRemove(id, selectedNames[idx])} className="hover:text-blue-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}