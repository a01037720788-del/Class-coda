import React, { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Play, Square, RotateCcw, ChevronLeft, Save, Send, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import EntryStage from "@/components/entry/EntryStage";
import EntryBlockPalette from "@/components/entry/EntryBlockPalette";
import EntryBlockWorkspace from "@/components/entry/EntryBlockWorkspace";
import EntryObjectPanel from "@/components/entry/EntryObjectPanel";
import { EntryEngine } from "@/components/entry/EntryEngine";

let _objCounter = 1;

function makeObject(type, name) {
  return {
    id: `obj_${Date.now()}_${_objCounter++}`,
    type, name,
    x: 0, y: 0,
    size: 60,
    direction: 90,
    visible: true,
  };
}

export default function EntryEditorPage({ unit, mission, onBack }) {
  const { studentData } = useOutletContext();
  const { toast } = useToast();

  const [objects, setObjects] = useState([makeObject("cat", "고양이1")]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [background, setBackground] = useState("white");
  // scripts: { [objId]: [{ id, stack: [...] }, ...] }
  const [scripts, setScripts] = useState({});
  const [projectName, setProjectName] = useState("새 프로젝트");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [activeObjId, setActiveObjId] = useState(null); // 블록 편집 중인 오브젝트

  const stageRef = useRef(null);
  const engineRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  const studentId = studentData?.id;
  const storageKey = `entry_project_${studentId}_${unit?.id}_${mission?.number ?? "free"}`;

  // 선택된 오브젝트의 스크립트
  const currentObjId = activeObjId || (objects[0]?.id);
  const currentScripts = scripts[currentObjId] || [];

  // ── 초기 로드 ──
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.objects?.length) setObjects(data.objects);
        if (data.background) setBackground(data.background);
        if (data.scripts) setScripts(data.scripts);
        if (data.projectName) setProjectName(data.projectName);
        setActiveObjId(data.objects?.[0]?.id || null);
      } catch {}
    } else {
      const initObj = makeObject("cat", "고양이1");
      setObjects([initObj]);
      setActiveObjId(initObj.id);
    }
  }, [storageKey]);

  // 처음 오브젝트 선택
  useEffect(() => {
    if (!activeObjId && objects.length > 0) {
      setActiveObjId(objects[0].id);
    }
  }, [objects]);

  // ── 자동 저장 ──
  const saveToLocal = useCallback(() => {
    const data = { objects, background, scripts, projectName, savedAt: new Date().toISOString() };
    localStorage.setItem(storageKey, JSON.stringify(data));
    setSavedAt(new Date());
  }, [objects, background, scripts, projectName, storageKey]);

  useEffect(() => {
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setInterval(saveToLocal, 5000);
    return () => clearInterval(autoSaveTimerRef.current);
  }, [saveToLocal]);

  // ── 키보드 이벤트 ──
  useEffect(() => {
    const onKeyDown = (e) => {
      if (running && engineRef.current) {
        engineRef.current.handleKeyDown(e.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [running]);

  // ── 실행 ──
  const handleRun = async () => {
    saveToLocal();
    setRunning(true);
    engineRef.current = new EntryEngine(stageRef);
    await engineRef.current.runAll(scripts, objects);
    setRunning(false);
  };

  const handleStop = () => {
    engineRef.current?.stop();
    setRunning(false);
  };

  const handleRestart = () => {
    handleStop();
    setTimeout(handleRun, 100);
  };

  // ── 오브젝트 관리 ──
  const handleAddObject = (type, label) => {
    const newObj = makeObject(type, `${label}${objects.length + 1}`);
    setObjects(prev => [...prev, newObj]);
    setActiveObjId(newObj.id);
  };

  const handleDeleteObject = (id) => {
    setObjects(prev => prev.filter(o => o.id !== id));
    setScripts(prev => { const s = { ...prev }; delete s[id]; return s; });
    if (activeObjId === id) setActiveObjId(objects.find(o => o.id !== id)?.id || null);
  };

  const handleUpdateObject = (id, changes) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...changes } : o));
  };

  const handleObjectClick = (objId) => {
    if (running && engineRef.current) {
      engineRef.current.notifyObjectClick(objId);
    } else {
      setActiveObjId(objId);
    }
  };

  // ── 스크립트 업데이트 ──
  const handleScriptsChange = (newScripts) => {
    setScripts(prev => ({ ...prev, [currentObjId]: newScripts }));
  };

  // ── Mission 제출 ──
  const handleSubmit = async () => {
    if (!mission || !studentId) return;
    setSubmitting(true);
    saveToLocal();
    const projectData = JSON.stringify({ objects, background, scripts, projectName });
    const existing = await base44.entities.EntrySubmission.filter({
      student_id: studentId, unit_id: unit.id, mission_number: mission.number,
    });
    const payload = {
      student_id: studentId,
      student_name: studentData?.name || "",
      unit_id: unit.id,
      unit_title: unit.title,
      mission_number: mission.number,
      mission_title: mission.title,
      project_url: storageKey,
      description: projectData,
      submitted_at: new Date().toISOString(),
      is_checked: false,
    };
    if (existing.length > 0) {
      await base44.entities.EntrySubmission.update(existing[0].id, payload);
    } else {
      await base44.entities.EntrySubmission.create(payload);
    }
    toast({ title: "🎉 Mission 제출 완료!" });
    setSubmitting(false);
  };

  const currentObj = objects.find(o => o.id === currentObjId);

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100 overflow-hidden z-30">
      {/* 상단 툴바 */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center gap-2 px-3 flex-shrink-0 z-10 shadow-sm">
        <button onClick={onBack} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input
          className="text-sm font-bold text-gray-800 bg-transparent border-0 outline-none w-40"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
        />
        {mission && (
          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full font-medium">
            🎯 Mission {mission.number}: {mission.title}
          </span>
        )}
        <div className="flex-1" />
        {savedAt && (
          <span className="text-[10px] text-gray-400 hidden sm:block">
            {savedAt.toLocaleTimeString()} 저장됨
          </span>
        )}
        <button onClick={saveToLocal} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
          <Save className="w-3.5 h-3.5" />저장
        </button>
        {mission && (
          <Button size="sm" onClick={handleSubmit} disabled={submitting}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 text-xs h-8">
            <Send className="w-3.5 h-3.5" />{submitting ? "제출 중..." : "제출하기"}
          </Button>
        )}
      </div>

      {/* 메인 레이아웃 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 오브젝트/배경 패널 */}
        <EntryObjectPanel
          objects={objects}
          selectedObjectId={activeObjId}
          onSelectObject={(id) => { setActiveObjId(id); setSelectedObjectId(id); }}
          onAddObject={handleAddObject}
          onDeleteObject={handleDeleteObject}
          onUpdateObject={handleUpdateObject}
          background={background}
          onChangeBackground={setBackground}
        />

        {/* 가운데: 블록 팔레트 + 워크스페이스 */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* 오브젝트 탭 선택 */}
          <div className="h-9 bg-white border-b border-gray-200 flex items-center gap-0 px-2 overflow-x-auto flex-shrink-0">
            {objects.map(obj => (
              <button
                key={obj.id}
                onClick={() => setActiveObjId(obj.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t transition-colors whitespace-nowrap ${activeObjId === obj.id ? "bg-green-50 text-green-700 border-b-2 border-green-500" : "text-gray-500 hover:text-gray-700"}`}
              >
                <span>{obj.name}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* 블록 팔레트 */}
            <EntryBlockPalette />

            {/* 블록 워크스페이스 */}
            <EntryBlockWorkspace
              scripts={currentScripts}
              onChange={handleScriptsChange}
            />
          </div>
        </div>

        {/* 오른쪽: 실행 화면 */}
        <div className="flex flex-col bg-white border-l border-gray-200 flex-shrink-0" style={{ width: 500 }}>
          {/* 실행 버튼 */}
          <div className="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-center gap-2 px-3">
            <button
              onClick={running ? handleStop : handleRun}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-sm font-bold transition-all shadow-sm ${running ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
            >
              {running ? <Square className="w-3.5 h-3.5" fill="white" /> : <Play className="w-3.5 h-3.5" fill="white" />}
              {running ? "정지" : "시작"}
            </button>
            <button
              onClick={handleRestart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm hover:bg-gray-100 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            {running && (
              <span className="text-xs text-green-600 font-bold animate-pulse">▶ 실행 중</span>
            )}
          </div>

          {/* 캔버스 */}
          <div className="flex-1 flex items-center justify-center bg-gray-200 overflow-hidden">
            <div className="shadow-lg rounded overflow-hidden" style={{ width: 480, height: 360 }}>
              <EntryStage
                ref={stageRef}
                objects={objects}
                background={background}
                running={running}
                onObjectClick={handleObjectClick}
                width={480}
                height={360}
              />
            </div>
          </div>

          {/* 하단: 오브젝트 속성 미니 패널 */}
          {currentObj && (
            <div className="border-t border-gray-200 px-3 py-2 bg-white flex items-center gap-3 flex-wrap text-xs">
              <span className="font-bold text-gray-700">{currentObj.name}</span>
              <label className="flex items-center gap-1 text-gray-500">X
                <input type="number" className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-center"
                  value={currentObj.x || 0} onChange={e => handleUpdateObject(currentObj.id, { x: Number(e.target.value) })} />
              </label>
              <label className="flex items-center gap-1 text-gray-500">Y
                <input type="number" className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-center"
                  value={currentObj.y || 0} onChange={e => handleUpdateObject(currentObj.id, { y: Number(e.target.value) })} />
              </label>
              <label className="flex items-center gap-1 text-gray-500">크기
                <input type="number" className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-center"
                  value={currentObj.size || 60} onChange={e => handleUpdateObject(currentObj.id, { size: Number(e.target.value) })} />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}