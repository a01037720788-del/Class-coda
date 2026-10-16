import React, { useRef, useEffect, useImperativeHandle, forwardRef } from "react";

// 수업 설명용 펜/형광펜/지우개 캔버스 오버레이
// 임시 필기 — DB 저장 안 함, 화면 전환 시 초기화
const PenCanvas = forwardRef(({ active, tool, color, lineWidth }, ref) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      // 기존 그림 보존
      const old = ctxRef.current?.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext("2d");
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
      if (old) {
        try { ctx.putImageData(old, 0, 0); } catch { /* 크기 변경 시 무시 */ }
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
    return { x, y };
  };

  const start = (e) => {
    if (!active) return;
    e.preventDefault();
    drawing.current = true;
    lastPoint.current = getPos(e);
  };

  const move = (e) => {
    if (!active || !drawing.current) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    const pos = getPos(e);
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = tool === "highlighter" ? lineWidth * 4 : tool === "eraser" ? lineWidth * 3 : lineWidth;
    ctx.globalAlpha = tool === "highlighter" ? 0.25 : 1;
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPoint.current = pos;
  };

  const end = () => { drawing.current = false; };

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      if (canvas && ctxRef.current) {
        ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerLeave={end}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: active ? "auto" : "none",
        zIndex: active ? 60 : 1,
        touchAction: "none",
      }}
    />
  );
});

PenCanvas.displayName = "PenCanvas";
export default PenCanvas;