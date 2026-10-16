import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getSessionUser } from "@/lib/auth";
import { usePageTracker } from "@/hooks/usePageTracker";
import { Button } from "@/components/ui/button";
import {
  Wifi, WifiOff, Hand, Play, Square, ChevronRight,
  Megaphone, Lock, Loader2, LogIn, MapPin
} from "lucide-react";

// ── 코드 에디터 ─────────────────────────────────────────────────────────────────
function CodeEditor({ value, onChange, readOnly }) {
  const ref = useRef(null);
  const lines = value ? value.split("\n") : [""];
  const handleKeyDown = (e) => {
    if (readOnly) return;
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
    <div className={`flex bg-[#1e1e2e] rounded-xl overflow-hidden border-2 transition-all ${readOnly ? "border-red-500/50" : "border-[#313244]"}`}>
      <div className="select-none bg-[#181825] text-[#6c7086] text-right text-xs leading-5 px-2.5 py-3 font-mono border-r border-[#313244] min-w-[2.5rem]">
        {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => !readOnly && onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        spellCheck={false}
        className="flex-1 bg-transparent text-[#cdd6f4] text-sm font-mono leading-5 p-3 resize-none focus:outline-none min-h-[280px]"
        style={{ tabSize: 4 }}
      />
    </div>
  );
}

// ── 메인 ───────────────────────────────────────────────────────────────────────
export default function LiveClassStudent() {
  const [user] = useState(() => getSessionUser());
  const [inputCode, setInputCode] = useState("");
  const [session, setSession] = useState(null);
  const [myRecord, setMyRecord] = useState(null);
  const [myCode, setMyCode] = useState("# 코드를 작성하세요\n");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [joining, setJoining] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [pageDetail, setPageDetail] = useState("");
  const syncTimer = useRef(null);
  const unsubSession = useRef(null);
  const unsubMyCode = useRef(null);
  const prevAnnounce = useRef("");

  // 현재 페이지 실시간 추적
  usePageTracker(myRecord?.id || null, pageDetail);

  const cleanup = useCallback(() => {
    if (unsubSession.current) unsubSession.current();
    if (unsubMyCode.current) unsubMyCode.current();
    clearTimeout(syncTimer.current);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // 실시간 구독 시작
  const subscribe = useCallback((sess, record) => {
    // 세션 변화 구독 (잠금, 공지, 공유 코드)
    unsubSession.current = base44.entities.LiveSession.subscribe((event) => {
      if ((event.data?.id === sess.id || event.id === sess.id) && event.type === "update") {
        const updated = event.data;
        setSession(updated);
        // 공지 표시
        if (updated.announcement && updated.announcement !== prevAnnounce.current) {
          prevAnnounce.current = updated.announcement;
          setAnnouncement(updated.announcement);
          setShowAnnounce(true);
          setTimeout(() => setShowAnnounce(false), 8000);
        }
        // 수업 종료
        if (updated.status === "ended") {
          setConnected(false);
          setSession(null);
        }
      }
    });

    // 내 코드 레코드 구독 (선생님이 코드 전송 시 반영)
    unsubMyCode.current = base44.entities.LiveStudentCode.subscribe((event) => {
      if (event.data?.id === record.id) {
        if (event.type === "update") {
          const d = event.data;
          setMyRecord(d);
          if (d.code !== undefined && d.code !== myCode) {
            setMyCode(d.code);
          }
          if (d.is_hand_raised !== undefined) setHandRaised(d.is_hand_raised);
        }
      }
    });
    setConnected(true);
  }, [myCode]);

  // 수업 입장
  const handleJoin = async () => {
    if (!inputCode.trim()) { setError("수업 코드를 입력해주세요."); return; }
    setJoining(true);
    setError("");

    const sessions = await base44.entities.LiveSession.filter({
      session_code: inputCode.trim().toUpperCase(),
      status: "active",
    });
    if (!sessions.length) {
      setError("수업 코드가 올바르지 않거나 수업이 종료되었습니다.");
      setJoining(false);
      return;
    }
    const sess = sessions[0];

    const sid = user.student_id;
    if (!sid) {
      setError("학생 계정이 연결되지 않았습니다. 관리자에게 문의해 주세요.");
      setJoining(false);
      return;
    }

    // 기존 레코드 확인 or 새로 생성
    const existing = await base44.entities.LiveStudentCode.filter({
      session_id: sess.id,
      student_id: sid,
    });
    let record;
    if (existing.length > 0) {
      record = existing[0];
      setMyCode(record.code || "# 코드를 작성하세요\n");
    } else {
      record = await base44.entities.LiveStudentCode.create({
        session_id: sess.id,
        session_code: sess.session_code,
        student_id: sid,
        student_name: user.name,
        code: "# 코드를 작성하세요\n",
        status: "idle",
        is_hand_raised: false,
      });

      // 참가자 목록에 추가
      const participants = [...(sess.participants || [])];
      if (!participants.find(p => p.student_id === sid)) {
        participants.push({
          student_id: sid,
          student_name: user.name,
          joined_at: new Date().toISOString(),
        });
        await base44.entities.LiveSession.update(sess.id, { participants });
      }
    }

    setMyRecord(record);
    setSession(sess);
    setHandRaised(record.is_hand_raised || false);
    subscribe(sess, record);
    setJoining(false);
  };

  // 코드 변경 → 실시간 동기화 (400ms 디바운스)
  const handleCodeChange = useCallback((newCode) => {
    setMyCode(newCode);
    if (!myRecord) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      await base44.entities.LiveStudentCode.update(myRecord.id, {
        code: newCode,
        status: "typing",
      });
    }, 400);
  }, [myRecord]);

  // 코드 실행
  const handleRun = async () => {
    if (!myRecord) return;
    setRunning(true);
    await base44.entities.LiveStudentCode.update(myRecord.id, { status: "running" });

    const res = await base44.functions.invoke("runPythonCode", { code: myCode, mode: "simple" });
    const out = res.data?.error || res.data?.output || "(출력 없음)";
    const hasError = !!res.data?.error;
    setOutput(out);

    await base44.entities.LiveStudentCode.update(myRecord.id, {
      last_output: out,
      last_run_at: new Date().toISOString(),
      status: hasError ? "error" : "done",
    });
    setRunning(false);
  };

  // 손들기 토글
  const handleHandRaise = async () => {
    if (!myRecord) return;
    const next = !handRaised;
    setHandRaised(next);
    await base44.entities.LiveStudentCode.update(myRecord.id, { is_hand_raised: next });
  };

  // ── 입장 전 화면 ──────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="max-w-md mx-auto pt-8">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white mb-5 text-center">
          <div className="text-4xl mb-2">👨‍💻</div>
          <h1 className="text-xl font-bold">실시간 코딩 수업</h1>
          <p className="text-indigo-200 text-sm mt-1">선생님이 알려준 수업 코드를 입력하세요</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">수업 코드</label>
            <input
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              placeholder="예: AB1C2D"
              maxLength={6}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 uppercase"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <span>⚠️</span>{error}
            </div>
          )}
          <Button onClick={handleJoin} disabled={joining} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 gap-2">
            {joining ? <><Loader2 className="w-4 h-4 animate-spin" />입장 중...</> : <><LogIn className="w-4 h-4" />수업 입장</>}
          </Button>
        </div>
      </div>
    );
  }

  const isLocked = session.is_locked;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* 공지 배너 */}
      {showAnnounce && announcement && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl px-4 py-3 flex items-start gap-3 shadow-sm">
          <Megaphone className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">선생님 공지</p>
            <p className="text-sm text-amber-800 mt-0.5">{announcement}</p>
          </div>
          <button onClick={() => setShowAnnounce(false)} className="ml-auto text-amber-400 hover:text-amber-600">✕</button>
        </div>
      )}

      {/* 상태 바 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-bold text-gray-900 text-sm">{session.title}</span>
        </div>
        <span className="bg-indigo-100 text-indigo-700 font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg">
          {session.session_code}
        </span>
        {isLocked && (
          <span className="flex items-center gap-1 text-xs text-red-500 font-semibold bg-red-50 px-2.5 py-1 rounded-full">
            <Lock className="w-3 h-3" />편집 잠금
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {connected
            ? <span className="flex items-center gap-1 text-xs text-green-600"><Wifi className="w-3.5 h-3.5" />연결됨</span>
            : <span className="flex items-center gap-1 text-xs text-red-500"><WifiOff className="w-3.5 h-3.5" />연결 끊김</span>}
        </div>
      </div>

      {/* 공유 코드 (읽기 전용) */}
      {session.shared_code && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-indigo-50">
            <ChevronRight className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-700">선생님 공유 코드</span>
          </div>
          <div className="p-3">
            <div className="flex bg-[#1e1e2e] rounded-lg overflow-hidden border border-[#313244]">
              <div className="select-none bg-[#181825] text-[#6c7086] text-right text-xs leading-5 px-2.5 py-2 font-mono border-r border-[#313244] min-w-[2rem]">
                {session.shared_code.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <pre className="flex-1 text-[#cdd6f4] text-xs font-mono leading-5 p-2 max-h-48 overflow-auto whitespace-pre-wrap">
                {session.shared_code}
              </pre>
            </div>
            <button
              onClick={() => handleCodeChange(session.shared_code)}
              className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
            >
              → 내 편집 창에 가져오기
            </button>
          </div>
        </div>
      )}

      {/* 내 코드 편집 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">내 코드 작성</span>
          {isLocked && (
            <span className="text-xs text-red-500 flex items-center gap-1"><Lock className="w-3 h-3" />선생님이 편집을 잠갔습니다</span>
          )}
        </div>
        <div className="p-3">
          <CodeEditor value={myCode} onChange={handleCodeChange} readOnly={isLocked} />
        </div>
        <div className="px-3 pb-3 flex items-center gap-2 justify-between">
          <Button
            onClick={handleHandRaise}
            variant={handRaised ? "default" : "outline"}
            size="sm"
            className={`gap-1.5 text-xs ${handRaised ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
          >
            <Hand className="w-3.5 h-3.5" />
            {handRaised ? "손 내리기" : "손들기 ✋"}
          </Button>
          <Button
            onClick={handleRun}
            disabled={running || isLocked}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs"
          >
            {running
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />실행 중...</>
              : <><Play className="w-3.5 h-3.5" />실행</>}
          </Button>
        </div>
      </div>

      {/* 실행 결과 */}
      {output && (
        <div className="bg-[#1e1e2e] rounded-xl border border-[#313244] p-4">
          <div className="text-xs text-[#6c7086] mb-2 flex items-center gap-1.5">
            <Square className="w-3 h-3 text-green-400" />실행 결과
          </div>
          <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
}