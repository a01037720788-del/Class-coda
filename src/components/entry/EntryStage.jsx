import React, { useRef, useEffect, useImperativeHandle, forwardRef } from "react";

// 배경 색상 팔레트
const BACKGROUNDS = {
  white: { label: "흰 배경", color: "#ffffff", emoji: "⬜" },
  classroom: { label: "교실", color: "#f0e6d3", emoji: "🏫" },
  playground: { label: "운동장", color: "#7ec850", emoji: "⚽" },
  space: { label: "우주", color: "#0d0d2b", emoji: "🚀" },
  ocean: { label: "바다", color: "#1a6fa8", emoji: "🌊" },
};

const OBJECT_EMOJIS = {
  cat: "🐱", dog: "🐶", robot: "🤖", ball: "⚽", car: "🚗",
};

const EntryStage = forwardRef(({ objects, background, running, onObjectClick, width = 480, height = 360 }, ref) => {
  const canvasRef = useRef(null);
  const stateRef = useRef({ objects: [], speechBubbles: {} });

  // 외부에서 호출할 수 있는 메서드
  useImperativeHandle(ref, () => ({
    getState: () => stateRef.current,
    setState: (newState) => { stateRef.current = { ...stateRef.current, ...newState }; },
    getSpeechBubbles: () => stateRef.current.speechBubbles,
    setSpeechBubble: (objId, text, duration) => {
      stateRef.current.speechBubbles[objId] = text;
      if (duration) {
        setTimeout(() => {
          delete stateRef.current.speechBubbles[objId];
        }, duration * 1000);
      }
    },
    clearSpeechBubble: (objId) => {
      delete stateRef.current.speechBubbles[objId];
    },
    getObjects: () => stateRef.current.objects,
    updateObject: (id, changes) => {
      stateRef.current.objects = stateRef.current.objects.map(o =>
        o.id === id ? { ...o, ...changes } : o
      );
    },
    initObjects: (objs) => {
      stateRef.current.objects = objs.map(o => ({ ...o }));
      stateRef.current.speechBubbles = {};
    },
  }));

  // objects prop이 바뀌면 stateRef 초기화 (실행 전)
  useEffect(() => {
    if (!running) {
      stateRef.current.objects = objects.map(o => ({ ...o }));
      stateRef.current.speechBubbles = {};
    }
  }, [objects, running]);

  // 캔버스 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animId;
    const bg = BACKGROUNDS[background] || BACKGROUNDS.white;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 배경
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, width, height);

      // 배경 장식
      drawBackground(ctx, background, width, height);

      // 오브젝트
      const objs = running ? stateRef.current.objects : objects;
      objs.forEach(obj => {
        if (obj.visible === false) return;
        drawObject(ctx, obj, width, height, stateRef.current.speechBubbles[obj.id]);
      });

      animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [objects, background, running, width, height]);

  const handleClick = (e) => {
    if (!onObjectClick) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const cx = mx * scaleX;
    const cy = my * scaleY;

    const objs = running ? stateRef.current.objects : objects;
    // 역순으로 클릭 감지 (맨 위 오브젝트 우선)
    for (let i = objs.length - 1; i >= 0; i--) {
      const obj = objs[i];
      if (obj.visible === false) continue;
      const ox = width / 2 + (obj.x || 0);
      const oy = height / 2 - (obj.y || 0);
      const size = (obj.size || 60);
      if (Math.abs(cx - ox) < size / 2 && Math.abs(cy - oy) < size / 2) {
        onObjectClick(obj.id);
        return;
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      className="w-full h-full cursor-pointer"
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
});

function drawBackground(ctx, bg, w, h) {
  if (bg === "classroom") {
    // 칠판
    ctx.fillStyle = "#2d5e2d";
    ctx.fillRect(60, 20, w - 120, 80);
    ctx.strokeStyle = "#1a3e1a";
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 20, w - 120, 80);
    // 바닥
    ctx.fillStyle = "#c8a878";
    ctx.fillRect(0, h - 40, w, 40);
    // 책상들
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "#e0c898";
      ctx.fillRect(20 + i * 110, h - 100, 90, 50);
    }
  } else if (bg === "playground") {
    // 잔디
    ctx.fillStyle = "#5aab3a";
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    // 구름
    ctx.fillStyle = "white";
    drawCloud(ctx, 80, 60);
    drawCloud(ctx, 320, 40);
  } else if (bg === "space") {
    // 별들
    ctx.fillStyle = "white";
    const stars = [[30,20],[100,60],[200,30],[350,80],[420,20],[80,150],[260,110]];
    stars.forEach(([x,y]) => {
      ctx.fillRect(x, y, 2, 2);
    });
    // 행성
    ctx.fillStyle = "#e05c00";
    ctx.beginPath();
    ctx.arc(380, 60, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8c00";
    ctx.beginPath();
    ctx.arc(375, 55, 20, 0, Math.PI * 2);
    ctx.fill();
  } else if (bg === "ocean") {
    // 파도
    ctx.fillStyle = "#0d5a8a";
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
    // 파도 무늬
    ctx.strokeStyle = "#1e90c8";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, h * 0.55 + i * 30);
      ctx.bezierCurveTo(w * 0.25, h * 0.5 + i * 30, w * 0.5, h * 0.6 + i * 30, w, h * 0.55 + i * 30);
      ctx.stroke();
    }
    // 구름
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    drawCloud(ctx, 60, 50);
    drawCloud(ctx, 300, 70);
  }
}

function drawCloud(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.arc(x + 25, y - 10, 25, 0, Math.PI * 2);
  ctx.arc(x + 50, y, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawObject(ctx, obj, w, h, speechText) {
  const ox = w / 2 + (obj.x || 0);
  const oy = h / 2 - (obj.y || 0);
  const size = obj.size || 60;
  const emoji = OBJECT_EMOJIS[obj.type] || "❓";

  ctx.save();
  ctx.translate(ox, oy);

  // 방향 회전
  if (obj.direction && obj.direction !== 90) {
    ctx.rotate(((obj.direction - 90) * Math.PI) / 180);
  }

  // 이모지 그리기
  ctx.font = `${size * 0.8}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, 0);

  ctx.restore();

  // 말풍선
  if (speechText) {
    const bx = ox + size * 0.5;
    const by = oy - size * 0.6;
    const padding = 8;
    ctx.font = "13px sans-serif";
    const tw = ctx.measureText(speechText).width;
    const bw = tw + padding * 2;
    const bh = 28;

    ctx.fillStyle = "white";
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by - bh, bw, bh, 8);
    ctx.fill();
    ctx.stroke();

    // 꼬리
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(bx + 10, by);
    ctx.lineTo(bx + 3, by + 8);
    ctx.lineTo(bx + 20, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#333";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(speechText, bx + padding, by - bh / 2);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export { BACKGROUNDS, OBJECT_EMOJIS };
export default EntryStage;