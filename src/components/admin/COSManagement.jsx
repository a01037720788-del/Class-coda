import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight, Layers, Eye, EyeOff, Edit, Trash2, ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import COSUnitForm from "@/components/admin/cos/COSUnitForm";
import COSUnitDetail from "@/components/admin/cos/COSUnitDetail";
import COSSubmissionViewer from "@/components/admin/COSSubmissionViewer";

export default function COSManagement() {
  const [units, setUnits] = useState([]);
  const [allProblems, setAllProblems] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null); // null = 목록, "unclassified" = 미분류, unitObj = 해당 Unit
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [mainTab, setMainTab] = useState("units"); // "units" | "submissions"
  const [loadError, setLoadError] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoadError(null);
    try {
      const [us, ps] = await Promise.all([
        base44.entities.COSUnit.list("order"),
        base44.entities.COSProblem.list("problem_number"),
      ]);
      setUnits(us);
      setAllProblems(ps);
    } catch (err) {
      setLoadError("COS 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.");
      console.warn("COS loadAll 실패:", err);
    }
  };

  const openAddUnit = () => { setEditingUnit(null); setShowUnitForm(true); };
  const openEditUnit = (u, e) => { e.stopPropagation(); setEditingUnit(u); setShowUnitForm(true); };

  const deleteUnit = async (u, e) => {
    e.stopPropagation();
    if (!confirm(`"${u.title}" Unit을 삭제하시겠습니까?\n소속 문제들은 미분류로 이동됩니다.`)) return;
    // 소속 문제들의 unit_id 제거 (미분류 이동)
    const unitProblems = allProblems.filter(p => p.unit_id === u.id);
    await Promise.all(unitProblems.map(p => base44.entities.COSProblem.update(p.id, { unit_id: "" })));
    await base44.entities.COSUnit.delete(u.id);
    toast({ title: "Unit 삭제 완료" });
    loadAll();
  };

  const deleteUnitAndProblems = async (u, e) => {
    e.stopPropagation();
    if (!confirm(`"${u.title}" Unit과 소속 문제 및 제출 기록을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    const unitProblems = allProblems.filter(p => p.unit_id === u.id);
    // 제출 기록 cascade 삭제
    let subCount = 0;
    for (const p of unitProblems) {
      const subs = await base44.entities.COSSubmission.filter({ problem_id: p.id });
      for (const s of subs) await base44.entities.COSSubmission.delete(s.id);
      subCount += subs.length;
      await base44.entities.COSProblem.delete(p.id);
    }
    await base44.entities.COSUnit.delete(u.id);
    toast({ title: `완전 삭제 완료 (문제 ${unitProblems.length}건, 제출 ${subCount}건)` });
    loadAll();
  };

  const togglePublish = async (u, e) => {
    e.stopPropagation();
    await base44.entities.COSUnit.update(u.id, { is_published: !u.is_published });
    loadAll();
  };

  const problemCountForUnit = (unitId) => allProblems.filter(p => p.unit_id === unitId).length;
  const unclassifiedCount = allProblems.filter(p => !p.unit_id).length;

  if (loadError && units.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
        <p className="text-gray-600 font-medium mb-1">{loadError}</p>
        <p className="text-xs text-gray-400 mb-4">COS는 Base44 서비스를 사용합니다. Base44 서비스 상태를 확인해 주세요.</p>
        <Button variant="outline" size="sm" onClick={loadAll}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />다시 시도
        </Button>
      </div>
    );
  }

  // ── Unit 상세 보기 ──
  if (selectedUnit) {
    const isUnclassified = selectedUnit === "unclassified";
    const unitProblems = isUnclassified
      ? allProblems.filter(p => !p.unit_id)
      : allProblems.filter(p => p.unit_id === selectedUnit.id);

    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedUnit(null); loadAll(); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />Unit 목록으로
        </button>
        <COSUnitDetail
          unit={isUnclassified ? { id: null, title: "미분류 문제" } : selectedUnit}
          problems={unitProblems}
          allProblems={allProblems}
          isUnclassified={isUnclassified}
          onRefresh={loadAll}
        />
      </div>
    );
  }

  // ── Unit 목록 ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold text-gray-800">COS 자격증 관리</h3>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button onClick={() => setMainTab("units")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mainTab === "units" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
              Unit 관리
            </button>
            <button onClick={() => setMainTab("submissions")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mainTab === "submissions" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
              제출 관리
            </button>
          </div>
          {mainTab === "units" && (
            <Button size="sm" onClick={openAddUnit} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
              <Plus className="w-4 h-4" />Unit 추가
            </Button>
          )}
        </div>
      </div>

      {mainTab === "submissions" && (
        <COSSubmissionViewer units={units} problems={allProblems} />
      )}

      {mainTab !== "units" ? null : (<>

      <div className="space-y-2">
        {units.map((u) => (
          <div key={u.id}
            className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-colors"
            onClick={() => setSelectedUnit(u)}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {u.order || "?"}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{u.title}</p>
                {u.description && <p className="text-xs text-gray-400 truncate">{u.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                문제 {problemCountForUnit(u.id)}개
              </span>
              <button onClick={e => togglePublish(u, e)}
                className={`p-1.5 rounded-lg transition-colors ${u.is_published !== false ? "text-green-600 bg-green-50 hover:bg-green-100" : "text-gray-400 bg-gray-100 hover:bg-gray-200"}`}>
                {u.is_published !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <Button variant="ghost" size="sm" onClick={e => openEditUnit(u, e)} className="h-7 w-7 p-0">
                <Edit className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={e => deleteUnit(u, e)} className="h-7 w-7 p-0 text-orange-400 hover:text-orange-600" title="Unit 삭제 (문제 미분류 이동)">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={e => deleteUnitAndProblems(u, e)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600" title="Unit+문제+제출 완전 삭제">
                <Trash2 className="w-3.5 h-3.5 fill-current opacity-70" />
              </Button>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          </div>
        ))}

        {/* 미분류 */}
        {unclassifiedCount > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl hover:border-orange-300 cursor-pointer transition-colors"
            onClick={() => setSelectedUnit("unclassified")}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-orange-800 text-sm">미분류 문제</p>
                <p className="text-xs text-orange-500">Unit이 지정되지 않은 기존 문제들</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">문제 {unclassifiedCount}개</span>
              <ChevronRight className="w-4 h-4 text-orange-300" />
            </div>
          </div>
        )}

        {units.length === 0 && unclassifiedCount === 0 && (
          <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm">
            Unit을 추가해서 문제를 관리하세요.
          </div>
        )}
      </div>

      {/* Unit 추가/수정 폼 */}
      <COSUnitForm
        open={showUnitForm}
        unit={editingUnit}
        nextOrder={units.length + 1}
        onClose={() => setShowUnitForm(false)}
        onSaved={() => { setShowUnitForm(false); loadAll(); }}
      />
      </>)}
    </div>
  );
}