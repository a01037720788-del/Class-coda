import React, { useEffect, useRef, useState } from "react";

const CHAR_SIZE = 60;

/**
 * 간단한 캔버스 기반 실행 화면
 * JS 코드에서 say/move/moveY/setColor/setSize/setVisibility/print 명령을 실행합니다.
 */
export default function BlockCanvas({ jsCode, onLog }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    x: 200, y: 200, color: "#7c3aed", size: 60, visible: true,
    message: "", messageTimer: null,
  });
  const animFrameRef = useRef(null);

  const drawCanvas = (state) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 배경
    ctx.fillStyle = "#f0f9ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 격자 (옅은)
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    if (!state.visible) return;

    const sz = state.size;

    // 말하기 말풍선
    if (state.message) {
      const bx = state.x + sz / 2 + 8;
      const by = state.y - sz / 2 - 30;
      const bw = Math.max(state.message.length * 11 + 16, 60);
      const bh = 28;
      ctx.fillStyle = "white";
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1e293b";
      ctx.font = "13px sans-serif";
      ctx.fillText(state.message, bx + 8, by + 19);
    }

    // 캐릭터 (원형 + 이모지 얼굴)
    ctx.beginPath();
    ctx.arc(state.x, state.y, sz / 2, 0, Math.PI * 2);
    ctx.fillStyle = state.color;
    ctx.fill();

    ctx.font = `${sz * 0.5}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("😊", state.x, state.y);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  };

  const runCode = (code) => {
    if (!code) return;
    const state = stateRef.current;
    const logs = [];

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const canvas = canvasRef.current;
    const W = canvas?.width || 400;
    const H = canvas?.height || 400;

    // 명령 큐 방식 실행
    const cmds = [];

    const ctx = {
      say: (msg) => cmds.push({ type: "say", msg: String(msg) }),
      move: (dir, steps) => cmds.push({ type: "move", dir, steps: Number(steps) }),
      moveY: (dir, steps) => cmds.push({ type: "moveY", dir, steps: Number(steps) }),
      setColor: (color) => cmds.push({ type: "setColor", color }),
      setSize: (size) => cmds.push({ type: "setSize", size: Number(size) }),
      setVisibility: (v) => cmds.push({ type: "setVisibility", v }),
      wait: (secs) => cmds.push({ type: "wait", secs: Number(secs) }),
      print: (text) => {
        const msg = String(text);
        logs.push(msg);
        cmds.push({ type: "print", msg });
      },
      onKey: () => {},
    };

    try {
      const fn = new Function(...Object.keys(ctx), code);
      fn(...Object.values(ctx));
    } catch (e) {
      logs.push("❌ 오류: " + e.message);
    }

    onLog?.(logs);

    // 명령 순서대로 실행 (딜레이 누적)
    let delay = 0;
    cmds.forEach(cmd => {
      const d = delay;
      setTimeout(() => {
        if (cmd.type === "move") {
          state.x = clamp(state.x + (cmd.dir === "right" ? cmd.steps : -cmd.steps), 30, W - 30);
        } else if (cmd.type === "moveY") {
          state.y = clamp(state.y + (cmd.dir === "down" ? cmd.steps : -cmd.steps), 30, H - 30);
        } else if (cmd.type === "setColor") {
          state.color = cmd.color;
        } else if (cmd.type === "setSize") {
          state.size = clamp(cmd.size, 10, 200);
        } else if (cmd.type === "setVisibility") {
          state.visible = cmd.v === "show";
        } else if (cmd.type === "say" || cmd.type === "print") {
          state.message = cmd.msg;
          if (state.messageTimer) clearTimeout(state.messageTimer);
          state.messageTimer = setTimeout(() => {
            state.message = "";
            drawCanvas(state);
          }, 2000);
        } else if (cmd.type === "wait") {
          // wait는 delay에만 기여
        }
        drawCanvas(state);
      }, d);

      if (cmd.type === "wait") delay += cmd.secs * 1000;
      else delay += 300;
    });

    if (cmds.length === 0) drawCanvas(state);
  };

  const resetState = () => {
    const canvas = canvasRef.current;
    const W = canvas?.width || 400;
    const H = canvas?.height || 400;
    stateRef.current = {
      x: W / 2, y: H / 2, color: "#7c3aed", size: 60,
      visible: true, message: "", messageTimer: null,
    };
    drawCanvas(stateRef.current);
  };

  useEffect(() => {
    resetState();
  }, []);

  const handleRun = () => {
    resetState();
    setTimeout(() => runCode(jsCode), 100);
  };

  return (
    <div className="flex flex-col h-full">
      <canvas
        ref={canvasRef}
        width={400} height={380}
        className="w-full rounded-t-lg border border-gray-200 bg-blue-50"
        style={{ maxHeight: "380px", objectFit: "contain" }}
      />
      <div className="flex gap-2 p-2 bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg">
        <button
          onClick={handleRun}
          className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-2 rounded-lg transition-colors"
        >
          ▶ 실행
        </button>
        <button
          onClick={resetState}
          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors"
        >
          ↺ 초기화
        </button>
      </div>
    </div>
  );
}