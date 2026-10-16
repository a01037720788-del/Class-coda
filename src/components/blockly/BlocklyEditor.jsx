import React, { useEffect, useRef, useState } from "react";

const EMPTY_XML = `<xml xmlns="https://developers.google.com/blockly/xml"></xml>`;
const BLOCKLY_CDN = "https://unpkg.com/blockly@11.2.1/blockly_compressed.js";
const BLOCKLY_BLOCKS_CDN = "https://unpkg.com/blockly@11.2.1/blocks_compressed.js";
const BLOCKLY_JS_CDN = "https://unpkg.com/blockly@11.2.1/javascript_compressed.js";
const BLOCKLY_LANG_CDN = "https://unpkg.com/blockly@11.2.1/msg/ko.js";

let blocklyLoadPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(); return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureBlockly() {
  if (blocklyLoadPromise) return blocklyLoadPromise;
  blocklyLoadPromise = (async () => {
    await loadScript(BLOCKLY_CDN);
    await loadScript(BLOCKLY_BLOCKS_CDN);
    await loadScript(BLOCKLY_JS_CDN);
    try { await loadScript(BLOCKLY_LANG_CDN); } catch {}
  })();
  return blocklyLoadPromise;
}

function defineCustomBlocks(Blockly, gen) {
  const defs = {
    entry_say: {
      init() {
        this.appendValueInput("TEXT").setCheck("String").appendField("💬 말하기");
        this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(160);
      }
    },
    entry_move: {
      init() {
        this.appendValueInput("STEPS").setCheck("Number")
          .appendField("🚶 x방향으로")
          .appendField(new Blockly.FieldDropdown([["오른쪽", "right"], ["왼쪽", "left"]]), "DIR");
        this.appendDummyInput().appendField("만큼 이동");
        this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(210);
      }
    },
    entry_move_y: {
      init() {
        this.appendValueInput("STEPS").setCheck("Number")
          .appendField("⬆️ y방향으로")
          .appendField(new Blockly.FieldDropdown([["위", "up"], ["아래", "down"]]), "DIR");
        this.appendDummyInput().appendField("만큼 이동");
        this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(210);
      }
    },
    entry_color: {
      init() {
        this.appendDummyInput()
          .appendField("🎨 색 바꾸기")
          .appendField(new Blockly.FieldColour("#ff0000"), "COLOR");
        this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(290);
      }
    },
    entry_size: {
      init() {
        this.appendValueInput("SIZE").setCheck("Number").appendField("📏 크기를");
        this.appendDummyInput().appendField("% 로 바꾸기");
        this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(290);
      }
    },
    entry_wait: {
      init() {
        this.appendValueInput("SECS").setCheck("Number").appendField("⏳ 기다리기 (초)");
        this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(120);
      }
    },
    entry_visibility: {
      init() {
        this.appendDummyInput()
          .appendField(new Blockly.FieldDropdown([["보이기 👁️", "show"], ["숨기기 🙈", "hide"]]), "VIS");
        this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(290);
      }
    },
    entry_start: {
      init() {
        this.appendDummyInput().appendField("🚀 시작하기 버튼을 클릭했을 때");
        this.setNextStatement(true, null); this.setColour(350); this.setDeletable(false);
      }
    },
    entry_key_event: {
      init() {
        this.appendDummyInput()
          .appendField("⌨️ 키보드")
          .appendField(new Blockly.FieldDropdown([
            ["오른쪽 →", "ArrowRight"], ["왼쪽 ←", "ArrowLeft"],
            ["위 ↑", "ArrowUp"], ["아래 ↓", "ArrowDown"], ["스페이스", " "]
          ]), "KEY")
          .appendField("키를 눌렀을 때");
        this.setNextStatement(true, null); this.setColour(350);
      }
    },
    entry_print: {
      init() {
        this.appendValueInput("TEXT").setCheck(null).appendField("📢 출력하기");
        this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(160);
      }
    },
  };

  Object.entries(defs).forEach(([type, def]) => {
    if (!Blockly.Blocks[type]) Blockly.Blocks[type] = def;
  });

  const generators = {
    entry_say: (block, g) => `say(${g.valueToCode(block, "TEXT", 0) || '""'});\n`,
    entry_move: (block, g) => `move("${block.getFieldValue("DIR")}", ${g.valueToCode(block, "STEPS", 0) || "10"});\n`,
    entry_move_y: (block, g) => `moveY("${block.getFieldValue("DIR")}", ${g.valueToCode(block, "STEPS", 0) || "10"});\n`,
    entry_color: (block) => `setColor("${block.getFieldValue("COLOR")}");\n`,
    entry_size: (block, g) => `setSize(${g.valueToCode(block, "SIZE", 0) || "100"});\n`,
    entry_wait: (block, g) => `wait(${g.valueToCode(block, "SECS", 0) || "1"});\n`,
    entry_visibility: (block) => `setVisibility("${block.getFieldValue("VIS")}");\n`,
    entry_start: () => `// 시작\n`,
    entry_key_event: (block) => `onKey("${block.getFieldValue("KEY")}", function() {\n`,
    entry_print: (block, g) => `print(${g.valueToCode(block, "TEXT", 0) || '""'});\n`,
  };

  Object.entries(generators).forEach(([type, fn]) => {
    if (gen && gen.forBlock && !gen.forBlock[type]) gen.forBlock[type] = fn;
  });
}

const TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    { kind: "category", name: "🚀 이벤트", colour: "350", contents: [
      { kind: "block", type: "entry_start" },
      { kind: "block", type: "entry_key_event" },
    ]},
    { kind: "category", name: "🚶 움직임", colour: "210", contents: [
      { kind: "block", type: "entry_move", inputs: { STEPS: { block: { type: "math_number", fields: { NUM: 10 } } } } },
      { kind: "block", type: "entry_move_y", inputs: { STEPS: { block: { type: "math_number", fields: { NUM: 10 } } } } },
    ]},
    { kind: "category", name: "🎨 모양", colour: "290", contents: [
      { kind: "block", type: "entry_color" },
      { kind: "block", type: "entry_size", inputs: { SIZE: { block: { type: "math_number", fields: { NUM: 100 } } } } },
      { kind: "block", type: "entry_visibility" },
    ]},
    { kind: "category", name: "💬 말하기", colour: "160", contents: [
      { kind: "block", type: "entry_say", inputs: { TEXT: { block: { type: "text", fields: { TEXT: "안녕!" } } } } },
      { kind: "block", type: "entry_print", inputs: { TEXT: { block: { type: "text", fields: { TEXT: "출력" } } } } },
    ]},
    { kind: "category", name: "⏳ 제어", colour: "120", contents: [
      { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: { block: { type: "math_number", fields: { NUM: 10 } } } } },
      { kind: "block", type: "controls_whileUntil" },
      { kind: "block", type: "controls_if" },
      { kind: "block", type: "entry_wait", inputs: { SECS: { block: { type: "math_number", fields: { NUM: 1 } } } } },
    ]},
    { kind: "category", name: "🔢 변수", colour: "330", custom: "VARIABLE" },
    { kind: "category", name: "➕ 연산", colour: "270", contents: [
      { kind: "block", type: "math_arithmetic" },
      { kind: "block", type: "math_number" },
      { kind: "block", type: "math_random_int" },
      { kind: "block", type: "logic_compare" },
      { kind: "block", type: "logic_operation" },
      { kind: "block", type: "logic_negate" },
    ]},
    { kind: "category", name: "📝 텍스트", colour: "160", contents: [
      { kind: "block", type: "text" },
      { kind: "block", type: "text_join" },
      { kind: "block", type: "text_length" },
    ]},
    { kind: "category", name: "🔧 함수", colour: "290", custom: "PROCEDURE" },
  ]
};

export default function BlocklyEditor({ xmlData, onChange, height = "100%" }) {
  const containerRef = useRef(null);
  const workspaceRef = useRef(null);
  const suppressRef = useRef(false);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    ensureBlockly()
      .then(() => {
        if (disposed || !containerRef.current) return;

        const Blockly = window.Blockly;
        const gen = window.Blockly?.JavaScript;
        if (!Blockly) { setStatus("error"); return; }

        defineCustomBlocks(Blockly, gen);

        const workspace = Blockly.inject(containerRef.current, {
          toolbox: TOOLBOX,
          scrollbars: true,
          trashcan: true,
          zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.3, scaleSpeed: 1.2 },
          grid: { spacing: 20, length: 3, colour: "#e5e7eb", snap: true },
        });
        workspaceRef.current = workspace;

        if (xmlData) {
          try {
            suppressRef.current = true;
            const dom = Blockly.utils.xml.textToDom(xmlData);
            Blockly.Xml.domToWorkspace(dom, workspace);
            suppressRef.current = false;
          } catch {}
        }

        workspace.addChangeListener(() => {
          if (suppressRef.current) return;
          const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace));
          let js = "";
          try { if (gen) js = gen.workspaceToCode(workspace); } catch {}
          onChange?.({ xml, js });
        });

        setStatus("ready");
      })
      .catch(() => setStatus("error"));

    return () => {
      disposed = true;
      if (workspaceRef.current) {
        workspaceRef.current.dispose();
        workspaceRef.current = null;
      }
    };
  }, []);

  // xmlData 외부 변경 반영
  useEffect(() => {
    const ws = workspaceRef.current;
    const Blockly = window.Blockly;
    if (!ws || !Blockly || !xmlData) return;
    try {
      suppressRef.current = true;
      ws.clear();
      Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xmlData), ws);
      suppressRef.current = false;
    } catch {}
  }, [xmlData]);

  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400 text-sm z-10">
          Blockly 불러오는 중...
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-400 text-sm z-10">
          Blockly 로드 실패. 인터넷 연결을 확인해 주세요.
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}