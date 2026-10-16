import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Monitor, Users, Lock, Unlock, Megaphone, Play, Square,
  RefreshCw, Hand, Eye, Copy, Code2, Wifi, WifiOff, ChevronRight,
  AlertCircle, CheckCircle2, MapPin
} from "lucide-react";

// ── 코드 에디터 (공유용) ────────────────────────────────────────────────────────
function CodeEditor({ value, onChange, readOnly, placeholder }) {
  const ref = useRef(null);
  const lines = value ? value.split("\n") : [""];
  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = ref.current;
      const s = el.selectionStart, end = el.selectionEnd;
      const nv = value.substring(0, s) + "    " + value.substring(end);
      onChange(nv);
      setTimeout(() => { el.selectionStart = el.selectionEnd = s + 4; }, 0);
    }
  };
  return (
    <div className="flex bg-[#1e1e2e] rounded-xl overflow-hidden border border-[#313244]">
      <div className="select-none bg-[#181825] text-[#6c7086] text-right text-xs leading-5 px-2.5 py-3 font-mono border-r border-[#313244] min-w-[2.5rem]">
        {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => !readOnly && onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        className="flex-1 bg-transparent text-[#cdd6f4] text-sm font-mono leading-5 p-3 resize-none focus:outline-none min-h-[200px]"
        style={{ tabSize: 4 }}
      />
    </div>
  );
}

// ── 학생 카드 ────────────────────────────────────────────────────────────────────
function StudentCard({ sc, onViewCode, onPushCode, isViewing }) {
  const statusConfig = {
    idle:    { label: "대기 중",   color: "bg-gray-100 text-gray-500" },
    typing:  { label: "작성 중",   color: "bg-blue-100 text-blue-600" },
    running: { label: "실행 중",   color: "bg-yellow-100 text-yellow-600" },
    done:    { label: "완료",      color: "bg-green-100 text-green-600" },
    error:   { label: "오류",      color: "bg-red-100 text-red-500" },
  };
  const st = statusConfig[sc.status] || statusConfig.idle;

  return (
    <div className={`bg-white rounded-xl border-2 p-3 transition-all ${isViewing ? "border-indigo-400 shadow-md shadow-indigo-100" : "border-gray-200 hover:border-gray-300"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
            {sc.student_name?.charAt(0)}
          </div>
          <span className="font-semibold text-gray-800 text-sm">{sc.student_name}</span>
          {sc.is_hand_raised && (
            <span className="text-base animate-bounce" title="손들기">✋</span>
          )}
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
      </div>

      {/* 현재 위치 */}
      {sc.current_page_label && (
        <div className="flex items-center gap-1 mb-2 text-[10px] text-indigo-600 bg-indigo-50 rounded-md px-2 py-1">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="font-medium truncate">{sc.current_page_label}</span>
          {sc.page_detail && <span className="text-gray-400 truncate">· {sc.page_detail}</span>}
        </div>
      )}

      {/* 코드 미리보기 */}
      <div className="bg-[#1e1e2e] rounded-lg p-2 mb-2 min-h-[48px] max-h-[72px] overflow-hidden">
        <pre className="text-[10px] text-[#cdd6f4] font-mono leading-4 whitespace-pre-wrap line-clamp-3">
          {sc.code || "// 아직 코드 없음"}
        </pre>
      </div>

      {sc.last_output && (
        <div className="bg-gray-900 rounded px-2 py-1 mb-2">
          <pre className="text-[10px] text-green-400 font-mono truncate">{sc.last_output}</pre>
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={() => onViewCode(sc)}
          className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
            isViewing ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
          }`}
        >
          <Eye className="w-3 h-3" />보기
        </button>
        <button
          onClick={() => onPushCode(sc.student_id)}
          className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-600 font-medium transition-colors"
        >
          <Copy className="w-3 h-3" />전송
        </button>
      </div>
    </div>
  );
}

// ── 메인 선생님 화면 ────────────────────────────────────────────────────────────
export default function LiveClassRoom() {
  const [user] = useState(() => getSessionUser());
  const [session, setSession] = useState(null);
  const [studentCodes, setStudentCodes] = useState([]);
  const [sharedCode, setSharedCode] = useState("# 학생들과 공유할 코드를 작성하세요\n");
  const [viewingStudent, setViewingStudent] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [connected, setConnected] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const syncTimer = useRef(null);
  const unsubSession = useRef(null);
  const unsubCodes = useRef(null);

  // 실시간 구독
  const subscribeToSession = useCallback((sess) => {
    if (unsubSession.current) unsubSession.current();
    if (unsubCodes.current) unsubCodes.current();

    unsubSession.current = base44.entities.LiveSession.subscribe((event) => {
      if (event.data?.id === sess.id || event.id === sess.id) {
        if (event.type === "update") setSession(event.data);
        if (event.type === "delete") { setSession(null); setConnected(false); }
      }
    });

    unsubCodes.current = base44.entities.LiveStudentCode.subscribe((event) => {
      if (event.data?.session_id === sess.id || event.data?.session_code === sess.session_code) {
        setStudentCodes(prev => {
          if (event.type === "create") return [...prev, event.data];
          if (event.type === "update") return prev.map(sc => sc.id === event.id ? event.data : sc);
          if (event.type === "delete") return prev.filter(sc => sc.id !== event.id);
          return prev;
        });
      }
    });
    setConnected(true);
  }, []);

  useEffect(() => {
    return () => {
      if (unsubSession.current) unsubSession.current();
      if (unsubCodes.current) unsubCodes.current();
    };
  }, []);

  useEffect(() => {
    const h = studentCodes.filter(sc => sc.is_hand_raised).length;
    setHandCount(h);
  }, [studentCodes]);

  // 수업 시작
  const handleCreateSession = async () => {
    if (!sessionTitle.trim()) return;
    setCreating(true);
    const code6 = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sess = await base44.entities.LiveSession.create({
      session_code: code6,
      teacher_id: user.id,
      teacher_name: user.name,
      title: sessionTitle,
      status: "active",
      shared_code: sharedCode,
      is_locked: false,
      participants: [],
    });
    setSession(sess);
    subscribeToSession(sess);
    setCreating(false);
  };

  // 코드 공유 (디바운스 100ms)
  const handleShareCode = useCallback((newCode) => {
    setSharedCode(newCode);
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      if (session) {
        await base44.entities.LiveSession.update(session.id, { shared_code: newCode });
      }
    }, 400);
  }, [session]);

  // 잠금 토글
  const handleToggleLock = async () => {
    if (!session) return;
    const updated = await base44.entities.LiveSession.update(session.id, { is_locked: !session.is_locked });
    setSession(updated);
  };

  // 공지 전송
  const handleSendAnnouncement = async () => {
    if (!announcement.trim() || !session) return;
    await base44.entities.LiveSession.update(session.id, { announcement });
    setAnnouncement("");
    setShowAnnounce(false);
  };

  // 학생 코드 전송 (공유 코드 → 학생 코드 덮어쓰기)
  const handlePushCode = async (studentId) => {
    const sc = studentCodes.find(s => s.student_id === studentId);
    if (!sc) return;
    await base44.entities.LiveStudentCode.update(sc.id, { code: sharedCode, status: "idle" });
  };

  // 모든 학생에게 코드 전송
  const handlePushToAll = async () => {
    if (!confirm(`모든 학생(${studentCodes.length}명)에게 현재 코드를 전송하시겠습니까?`)) return;
    await Promise.all(studentCodes.map(sc =>
      base44.entities.LiveStudentCode.update(sc.id, { code: sharedCode, status: "idle" })
    ));
  };

  // 수업 종료
  const handleEndSession = async () => {
    if (!confirm("수업을 종료하시겠습니까?")) return;
    await base44.entities.LiveSession.update(session.id, { status: "ended" });
    setSession(null);
    setStudentCodes([]);
    setConnected(false);
    if (unsubSession.current) unsubSession.current();
    if (unsubCodes.current) unsubCodes.current();
  };

  // 손내리기
  const handleLowerHand = async (studentId) => {
    const sc = studentCodes.find(s => s.student_id === studentId);
    if (sc) await base44.entities.LiveStudentCode.update(sc.id, { is_hand_raised: false });
  };

  // ── 수업 전 화면 ──────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Monitor className="w-6 h-6" />
            <h1 className="text-xl font-bold">실시간 코딩 수업</h1>
          </div>
          <p className="text-indigo-200 text-sm">학생 화면 공유 · 코드 동기화 · 실시간 피드백</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-900">새 수업 시작</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">수업 제목</label>
            <input
              value={sessionTitle}
              onChange={e => setSessionTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateSession()}
              placeholder="예: Python 기초 2주차"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <Button
            onClick={handleCreateSession}
            disabled={creating || !sessionTitle.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5"
          >
            {creating ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />생성 중...</> : <><Play className="w-4 h-4 mr-2" />수업 시작</>}
          </Button>
        </div>
      </div>
    );
  }

  const viewingCode = viewingStudent
    ? studentCodes.find(sc => sc.student_id === viewingStudent?.student_id)
    : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 상단 바 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-bold text-gray-900 text-sm">{session.title}</span>
        </div>
        <div className="bg-indigo-100 text-indigo-700 font-mono font-bold text-sm px-3 py-1 rounded-lg tracking-widest">
          {session.session_code}
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <Users className="w-3 h-3" />{studentCodes.length}명
        </Badge>
        {handCount > 0 && (
          <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
            ✋ {handCount}명 손들기
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1 text-xs text-green-600"><Wifi className="w-3.5 h-3.5" />연결됨</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-500"><WifiOff className="w-3.5 h-3.5" />연결 끊김</span>
          )}
          <Button variant="outline" size="sm" onClick={handleToggleLock} className="gap-1.5 text-xs">
            {session.is_locked ? <><Lock className="w-3.5 h-3.5 text-red-500" />잠금 해제</> : <><Unlock className="w-3.5 h-3.5" />편집 잠금</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAnnounce(true)} className="gap-1.5 text-xs">
            <Megaphone className="w-3.5 h-3.5" />공지
          </Button>
          <Button size="sm" onClick={handleEndSession} className="bg-red-500 hover:bg-red-600 text-white text-xs gap-1.5">
            <Square className="w-3 h-3" />수업 종료
          </Button>
        </div>
      </div>

      {/* 공지 입력 팝업 */}
      {showAnnounce && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <Megaphone className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <input
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSendAnnouncement()}
            placeholder="학생들에게 전달할 메시지..."
            className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none"
            autoFocus
          />
          <Button size="sm" onClick={handleSendAnnouncement} className="bg-amber-500 hover:bg-amber-600 text-white text-xs">전송</Button>
          <button onClick={() => setShowAnnounce(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 내 코드 + 학생 보기 */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-800">
                {viewingStudent ? `${viewingStudent.student_name} 학생 코드 보기` : "공유 코드 편집"}
              </span>
              {viewingStudent && (
                <button onClick={() => setViewingStudent(null)} className="text-xs text-indigo-500 hover:underline">← 내 코드로</button>
              )}
            </div>
            {!viewingStudent && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handlePushToAll} className="text-xs gap-1 h-7">
                  <ChevronRight className="w-3 h-3" />전체 전송
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            <CodeEditor
              value={viewingStudent ? (viewingCode?.code || "") : sharedCode}
              onChange={viewingStudent ? () => {} : handleShareCode}
              readOnly={!!viewingStudent}
            />
            {viewingStudent && viewingCode?.last_output && (
              <div className="mt-3 bg-gray-900 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />실행 결과
                </div>
                <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">{viewingCode.last_output}</pre>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 학생 목록 */}
        <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden bg-gray-50">
          <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-800">참여 학생</span>
            </div>
            <span className="text-xs text-gray-400">{studentCodes.length}명</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {studentCodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <div className="text-3xl mb-2">👋</div>
                <p className="text-sm text-gray-400">학생 입장 대기 중...</p>
                <p className="text-xs text-gray-400 mt-1">코드: <span className="font-mono font-bold text-indigo-600">{session.session_code}</span></p>
              </div>
            ) : (
              studentCodes.map(sc => (
                <div key={sc.id}>
                  <StudentCard
                    sc={sc}
                    onViewCode={(s) => { setViewingStudent(s); if (s.is_hand_raised) handleLowerHand(s.student_id); }}
                    onPushCode={handlePushCode}
                    isViewing={viewingStudent?.student_id === sc.student_id}
                  />
                </div>
              ))
            )}
          </div>

          {/* 입장 안내 */}
          <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
            <p className="text-[11px] text-gray-400 text-center">학생은 수업 코드로 입장합니다</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="font-mono font-bold text-indigo-600 text-lg tracking-widest">{session.session_code}</span>
              <button
                onClick={() => navigator.clipboard.writeText(session.session_code)}
                className="text-gray-400 hover:text-indigo-600 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}