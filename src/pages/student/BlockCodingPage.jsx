import React, { useState, useEffect, lazy, Suspense } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Save, Play, Code2, ChevronLeft,
  Plus, Trash2, CheckCircle, Send, X, Eye, Terminal, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import GenericUnitViewer from "@/components/student/GenericUnitViewer";

const BlocklyEditor = lazy(() => import("@/components/blockly/BlocklyEditor"));
const BlockCanvas = lazy(() => import("@/components/blockly/BlockCanvas"));

const EMPTY_XML = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="entry_start" x="50" y="50"/></xml>`;

export default function BlockCodingPage() {
  const { studentData } = useOutletContext();
  const { toast } = useToast();
  const studentId = studentData?.id;

  // ── 뷰 상태 ──
  const [view, setView] = useState("list"); // list | editor | missions | learn
  const [projects, setProjects] = useState([]);
  const [units, setUnits] = useState([]); // EntryUnit (missions용)
  const [loading, setLoading] = useState(true);

  // ── 에디터 상태 ──
  const [currentProject, setCurrentProject] = useState(null);
  const [projectTitle, setProjectTitle] = useState("새 프로젝트");
  const [xmlData, setXmlData] = useState(EMPTY_XML);
  const [jsCode, setJsCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [runKey, setRunKey] = useState(0); // canvas re-mount on run
  const [pendingRun, setPendingRun] = useState(false);

  // ── Mission 제출 ──
  const [selectedMissionUnit, setSelectedMissionUnit] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [missionDesc, setMissionDesc] = useState("");
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    loadAll();
  }, [studentId]);

  const loadAll = async () => {
    setLoading(true);
    const [projs, us, subs] = await Promise.all([
      studentId ? base44.entities.BlockProject.filter({ student_id: studentId }) : Promise.resolve([]),
      base44.entities.EntryUnit.list("unit_number"),
      studentId ? base44.entities.EntrySubmission.filter({ student_id: studentId }) : Promise.resolve([]),
    ]);
    setProjects(projs.sort((a, b) => (b.last_saved_at || "") < (a.last_saved_at || "") ? -1 : 1));
    setUnits(us.filter(u => u.is_active !== false && (u.missions || []).length > 0));
    setSubmissions(subs);
    setLoading(false);
  };

  const openNewProject = () => {
    setCurrentProject(null);
    setProjectTitle("새 프로젝트");
    setXmlData(EMPTY_XML);
    setJsCode("");
    setLogs([]);
    setView("editor");
  };

  const openProject = (proj) => {
    setCurrentProject(proj);
    setProjectTitle(proj.title);
    setXmlData(proj.xml_data || EMPTY_XML);
    setJsCode(proj.generated_js || "");
    setLogs([]);
    setView("editor");
  };

  const handleBlockChange = ({ xml, js }) => {
    setXmlData(xml);
    setJsCode(js);
  };

  const saveProject = async () => {
    if (!studentId) return;
    setSaving(true);
    const data = {
      student_id: studentId,
      student_name: studentData?.name || "",
      title: projectTitle,
      xml_data: xmlData,
      generated_js: jsCode,
      last_saved_at: new Date().toISOString(),
    };
    if (currentProject?.id) {
      await base44.entities.BlockProject.update(currentProject.id, data);
      setCurrentProject(p => ({ ...p, ...data }));
    } else {
      const created = await base44.entities.BlockProject.create(data);
      setCurrentProject(created);
    }
    toast({ title: "💾 저장 완료!" });
    setSaving(false);
    loadAll();
  };

  const deleteProject = async (id, e) => {
    e.stopPropagation();
    if (!confirm("프로젝트를 삭제하시겠습니까?")) return;
    await base44.entities.BlockProject.delete(id);
    toast({ title: "삭제 완료" });
    loadAll();
  };

  const handleRun = () => {
    setRunKey(k => k + 1);
    setPendingRun(true);
    setLogs([]);
  };

  const handleMissionSubmit = async () => {
    if (!selectedMissionUnit || !selectedMission) return;
    if (!jsCode && !xmlData) { toast({ title: "블록을 먼저 만들어 주세요.", variant: "destructive" }); return; }

    // 먼저 프로젝트 저장
    await saveProject();

    const existing = submissions.find(s =>
      s.unit_id === selectedMissionUnit.id && s.mission_number === selectedMission.number
    );
    const data = {
      student_id: studentId,
      student_name: studentData?.name || "",
      unit_id: selectedMissionUnit.id,
      unit_title: selectedMissionUnit.title,
      mission_number: selectedMission.number,
      mission_title: selectedMission.title,
      project_url: `[블록코딩] ${projectTitle}`,
      description: missionDesc,
      submitted_at: new Date().toISOString(),
      is_checked: false,
    };
    if (existing) {
      await base44.entities.EntrySubmission.update(existing.id, data);
    } else {
      await base44.entities.EntrySubmission.create(data);
    }
    toast({ title: "🎉 미션 제출 완료!" });
    setSelectedMissionUnit(null);
    setSelectedMission(null);
    setMissionDesc("");
    loadAll();
  };

  const getMissionSub = (unitId, mNum) =>
    submissions.find(s => s.unit_id === unitId && s.mission_number === mNum);

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>;

  // ── 프로젝트 목록 ──────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🧱 블록 코딩</h2>
            <p className="text-gray-500 text-sm mt-1">블록을 조합하여 프로그램을 만들어 보세요!</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setView("learn")} variant="outline" className="gap-2">
              <BookOpen className="w-4 h-4" />학습 Unit
            </Button>
            <Button onClick={() => setView("missions")} variant="outline" className="gap-2">
              <CheckCircle className="w-4 h-4" />미션
            </Button>
            <Button onClick={openNewProject} className="bg-green-600 hover:bg-green-700 gap-2">
              <Plus className="w-4 h-4" />새 프로젝트
            </Button>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="text-5xl mb-4">🧱</div>
            <p className="text-gray-500 font-medium mb-2">아직 만든 프로젝트가 없습니다</p>
            <p className="text-gray-400 text-sm mb-6">새 프로젝트를 만들어 블록 코딩을 시작해 보세요!</p>
            <Button onClick={openNewProject} className="bg-green-600 hover:bg-green-700 gap-2">
              <Plus className="w-4 h-4" />첫 번째 프로젝트 만들기
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(proj => (
              <div key={proj.id} onClick={() => openProject(proj)}
                className="bg-white rounded-2xl border border-gray-200 p-5 cursor-pointer hover:shadow-lg hover:border-green-300 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🧱</div>
                  <button onClick={e => deleteProject(proj.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="font-bold text-gray-900 mb-1 line-clamp-1">{proj.title}</p>
                {proj.last_saved_at && (
                  <p className="text-xs text-gray-400">
                    {new Date(proj.last_saved_at).toLocaleDateString("ko-KR")} 저장
                  </p>
                )}
                {proj.is_submitted && (
                  <Badge className="mt-2 bg-blue-100 text-blue-700 border-0 text-xs">제출됨</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── 학습 Unit ────────────────────────────────────────────────────────────────
  if (view === "learn") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView("list")} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">📚 블록코딩 학습 Unit</h2>
            <p className="text-gray-500 text-sm">개념과 예제를 통해 학습해보세요!</p>
          </div>
        </div>
        <GenericUnitViewer subjectType="block" label="블록코딩" />
      </div>
    );
  }

  // ── 미션 목록 ──────────────────────────────────────────────────────────────
  if (view === "missions") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView("list")} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">🎯 블록 코딩 미션</h2>
            <p className="text-gray-500 text-sm">미션을 클리어하고 실력을 키워 보세요!</p>
          </div>
        </div>

        {units.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
            <p>등록된 미션이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {units.map(unit => (
              <div key={unit.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="font-bold text-gray-900 mb-3">Unit {unit.unit_number}. {unit.title}</p>
                <div className="space-y-2">
                  {(unit.missions || []).map((m, i) => {
                    const sub = getMissionSub(unit.id, m.number);
                    return (
                      <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${sub ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
                        <div className="flex items-center gap-2">
                          {sub ? <CheckCircle className="w-4 h-4 text-green-500" /> : <span>🎯</span>}
                          <div>
                            <p className={`text-sm font-semibold ${sub ? "text-green-700" : "text-gray-800"}`}>
                              Mission {m.number}. {m.title}
                            </p>
                            {m.description && <p className="text-xs text-gray-500">{m.description}</p>}
                          </div>
                        </div>
                        <Button size="sm" onClick={() => {
                          setSelectedMissionUnit(unit);
                          setSelectedMission(m);
                          openNewProject();
                        }} className="text-xs bg-green-600 hover:bg-green-700 ml-2">
                          {sub ? "다시 도전" : "시작하기"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── 에디터 화면 ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 140px)", minHeight: "600px" }}>
      {/* 에디터 헤더 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <button onClick={() => setView("list")} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <Input
          value={projectTitle}
          onChange={e => setProjectTitle(e.target.value)}
          className="max-w-[200px] h-8 text-sm font-semibold border-0 bg-gray-100 focus:bg-white"
        />
        {selectedMission && (
          <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">
            🎯 Mission {selectedMission.number}: {selectedMission.title}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowCode(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showCode ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            <Code2 className="w-3.5 h-3.5" />{showCode ? "블록 보기" : "코드 보기"}
          </button>
          <Button onClick={handleRun} size="sm" className="bg-green-500 hover:bg-green-600 gap-1.5 text-xs">
            <Play className="w-3.5 h-3.5" />실행
          </Button>
          <Button onClick={saveProject} disabled={saving} size="sm" variant="outline" className="gap-1.5 text-xs">
            <Save className="w-3.5 h-3.5" />{saving ? "저장 중..." : "저장"}
          </Button>
          {selectedMission && (
            <Button onClick={() => {
              setSelectedMissionUnit(u => u);
              handleMissionSubmit();
            }} size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1.5 text-xs">
              <Send className="w-3.5 h-3.5" />제출
            </Button>
          )}
        </div>
      </div>

      {/* 미션 제출 패널 */}
      {selectedMission && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-semibold text-orange-700">🎯 미션 설명:</span>
          <span className="text-xs text-orange-600 flex-1">{selectedMission.description}</span>
          <input
            value={missionDesc}
            onChange={e => setMissionDesc(e.target.value)}
            placeholder="완성 후 간단한 설명 입력..."
            className="text-xs border border-orange-200 rounded-lg px-2 py-1 w-48 bg-white"
          />
          <Button size="sm" onClick={handleMissionSubmit} className="bg-orange-500 hover:bg-orange-600 text-xs gap-1">
            <Send className="w-3 h-3" />제출
          </Button>
          <button onClick={() => { setSelectedMissionUnit(null); setSelectedMission(null); }} className="text-orange-400 hover:text-orange-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 메인 에디터 레이아웃 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: Blockly 에디터 또는 코드 뷰 */}
        <div className="flex-1 overflow-hidden relative">
          {showCode ? (
            <div className="h-full bg-gray-900 p-4 overflow-auto">
              <p className="text-xs text-gray-400 mb-2 font-mono">// 생성된 JavaScript 코드</p>
              <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">{jsCode || "// 블록을 추가하면 코드가 생성됩니다."}</pre>
            </div>
          ) : (
            <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">Blockly 로딩 중...</div>}>
              <BlocklyEditor
                xmlData={xmlData}
                onChange={handleBlockChange}
                height="100%"
              />
            </Suspense>
          )}
        </div>

        {/* 오른쪽: 실행 화면 + 로그 */}
        <div className="w-[420px] flex-shrink-0 flex flex-col border-l border-gray-200 bg-white">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />실행 화면
            </p>
          </div>
          <div className="flex-1 p-2 overflow-hidden">
            <Suspense fallback={<div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">로딩 중...</div>}>
              <BlockCanvas
                key={runKey}
                jsCode={pendingRun ? jsCode : ""}
                onLog={(l) => { setLogs(l); setPendingRun(false); }}
              />
            </Suspense>
          </div>

          {/* 로그 출력 */}
          <div className="border-t border-gray-100">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
              <Terminal className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">출력</span>
              {logs.length > 0 && (
                <button onClick={() => setLogs([])} className="ml-auto text-xs text-gray-400 hover:text-gray-600">지우기</button>
              )}
            </div>
            <div className="h-20 overflow-auto bg-gray-900 p-2">
              {logs.length === 0 ? (
                <p className="text-gray-600 text-xs font-mono">▶ 실행 버튼을 눌러주세요</p>
              ) : (
                logs.map((l, i) => (
                  <p key={i} className={`text-xs font-mono ${l.startsWith("❌") ? "text-red-400" : "text-green-400"}`}>{l}</p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}