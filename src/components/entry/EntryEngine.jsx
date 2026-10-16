// 블록 실행 엔진 (비동기 인터프리터)
// stageRef를 통해 오브젝트 상태를 직접 변경

export class EntryEngine {
  constructor(stageRef) {
    this.stageRef = stageRef;
    this.running = false;
    this.loops = []; // 취소 가능한 루프 추적
    this.keyListeners = {};
    this.keyStates = {};
    this.variables = {};
    this._stopFlag = false;
    this._onObjectClickHandlers = {}; // objId → [fn, ...]
  }

  stop() {
    this._stopFlag = true;
    this.running = false;
    this.loops.forEach(fn => fn());
    this.loops = [];
    this._onObjectClickHandlers = {};
    // 말풍선 클리어
    if (this.stageRef?.current) {
      const stage = this.stageRef.current;
      stage.initObjects && stage.initObjects(stage.getObjects());
    }
  }

  notifyObjectClick(objId) {
    const handlers = this._onObjectClickHandlers[objId] || [];
    handlers.forEach(fn => fn());
  }

  notifyKeyDown(key) {
    this.keyStates[key] = true;
  }

  notifyKeyUp(key) {
    this.keyStates[key] = false;
  }

  // 모든 오브젝트의 스크립트를 동시에 실행
  async runAll(allScripts, objects) {
    this._stopFlag = false;
    this.running = true;
    this.variables = {};

    // 실행 화면 초기화 (오브젝트 위치 등 리셋)
    if (this.stageRef?.current) {
      this.stageRef.current.initObjects(objects);
    }

    // 각 오브젝트, 각 스크립트를 병렬 실행
    const promises = [];
    for (const objId of Object.keys(allScripts)) {
      for (const scriptObj of (allScripts[objId] || [])) {
        const stack = scriptObj.stack || [];
        if (stack.length === 0) continue;
        const firstBlock = stack[0];
        if (firstBlock.hat) {
          if (firstBlock.type === "on_start") {
            promises.push(this._runStack(stack.slice(1), objId));
          } else if (firstBlock.type === "on_click") {
            if (!this._onObjectClickHandlers[objId]) this._onObjectClickHandlers[objId] = [];
            this._onObjectClickHandlers[objId].push(() => this._runStack(stack.slice(1), objId));
          } else if (firstBlock.type === "on_key_right") {
            this._listenKey("ArrowRight", () => this._runStack(stack.slice(1), objId));
          } else if (firstBlock.type === "on_key_left") {
            this._listenKey("ArrowLeft", () => this._runStack(stack.slice(1), objId));
          } else if (firstBlock.type === "on_key_up") {
            this._listenKey("ArrowUp", () => this._runStack(stack.slice(1), objId));
          } else if (firstBlock.type === "on_key_down") {
            this._listenKey("ArrowDown", () => this._runStack(stack.slice(1), objId));
          } else if (firstBlock.type === "on_key_space") {
            this._listenKey(" ", () => this._runStack(stack.slice(1), objId));
          } else if (firstBlock.type === "define_func") {
            // 함수 정의 등록
            const funcName = firstBlock.params?.name || "함수";
            this._funcDefs = this._funcDefs || {};
            this._funcDefs[funcName] = stack.slice(1);
          }
        }
      }
    }
    await Promise.allSettled(promises);
  }

  _listenKey(key, fn) {
    if (!this.keyListeners[key]) this.keyListeners[key] = [];
    this.keyListeners[key].push(fn);
  }

  handleKeyDown(key) {
    if (!this.running) return;
    const handlers = this.keyListeners[key] || [];
    handlers.forEach(fn => fn());
  }

  async _runStack(blocks, objId) {
    for (const block of blocks) {
      if (this._stopFlag) return;
      await this._execBlock(block, objId);
    }
  }

  async _execBlock(block, objId) {
    if (this._stopFlag) return;
    const stage = this.stageRef?.current;
    if (!stage) return;
    const params = block.params || {};

    switch (block.type) {
      // ── 움직임 ──
      case "move_right": {
        const obj = this._getObj(objId);
        stage.updateObject(objId, { x: (obj?.x || 0) + (Number(params.amount) || 10) });
        await this._tick();
        break;
      }
      case "move_left": {
        const obj = this._getObj(objId);
        stage.updateObject(objId, { x: (obj?.x || 0) - (Number(params.amount) || 10) });
        await this._tick();
        break;
      }
      case "move_up": {
        const obj = this._getObj(objId);
        stage.updateObject(objId, { y: (obj?.y || 0) + (Number(params.amount) || 10) });
        await this._tick();
        break;
      }
      case "move_down": {
        const obj = this._getObj(objId);
        stage.updateObject(objId, { y: (obj?.y || 0) - (Number(params.amount) || 10) });
        await this._tick();
        break;
      }
      case "set_x": {
        stage.updateObject(objId, { x: Number(params.x) || 0 });
        await this._tick();
        break;
      }
      case "set_y": {
        stage.updateObject(objId, { y: Number(params.y) || 0 });
        await this._tick();
        break;
      }
      case "set_direction": {
        stage.updateObject(objId, { direction: Number(params.dir) || 90 });
        await this._tick();
        break;
      }
      case "move_to_xy": {
        const sec = Number(params.sec) || 1;
        const tx = Number(params.x) || 0;
        const ty = Number(params.y) || 0;
        const obj = this._getObj(objId);
        const sx = obj?.x || 0;
        const sy = obj?.y || 0;
        const steps = Math.ceil(sec * 30);
        for (let i = 0; i <= steps; i++) {
          if (this._stopFlag) return;
          const t = i / steps;
          stage.updateObject(objId, { x: sx + (tx - sx) * t, y: sy + (ty - sy) * t });
          await this._sleep(sec * 1000 / steps);
        }
        break;
      }

      // ── 생김새 ──
      case "say": {
        stage.setSpeechBubble(objId, String(params.text || "안녕!"), 0);
        await this._tick();
        break;
      }
      case "say_for": {
        const sec = Number(params.sec) || 2;
        stage.setSpeechBubble(objId, String(params.text || "안녕!"), sec);
        await this._sleep(sec * 1000);
        break;
      }
      case "show": {
        stage.updateObject(objId, { visible: true });
        await this._tick();
        break;
      }
      case "hide": {
        stage.updateObject(objId, { visible: false });
        await this._tick();
        break;
      }
      case "change_size": {
        const obj = this._getObj(objId);
        stage.updateObject(objId, { size: (obj?.size || 60) + (Number(params.amount) || 10) });
        await this._tick();
        break;
      }
      case "set_size": {
        const baseSize = 60;
        stage.updateObject(objId, { size: baseSize * (Number(params.size) || 100) / 100 });
        await this._tick();
        break;
      }

      // ── 흐름 ──
      case "wait": {
        await this._sleep((Number(params.sec) || 1) * 1000);
        break;
      }
      case "repeat": {
        const count = Number(params.count) || 10;
        for (let i = 0; i < count; i++) {
          if (this._stopFlag) return;
          await this._runStack(block.children || [], objId);
        }
        break;
      }
      case "forever": {
        while (!this._stopFlag) {
          await this._runStack(block.children || [], objId);
          await this._tick();
        }
        break;
      }
      case "if": {
        const cond = await this._evalCondition(block.conditionBlock, objId);
        if (cond) await this._runStack(block.children || [], objId);
        break;
      }
      case "if_else": {
        const cond = await this._evalCondition(block.conditionBlock, objId);
        if (cond) {
          await this._runStack(block.children || [], objId);
        } else {
          await this._runStack(block.elseChildren || [], objId);
        }
        break;
      }
      case "stop_all": {
        this._stopFlag = true;
        break;
      }
      case "stop_this": {
        return; // 이 스택 중단
      }

      // ── 소리 ──
      case "play_sound": {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.connect(ctx.destination);
          osc.frequency.value = 440;
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        } catch {}
        break;
      }

      // ── 자료 ──
      case "set_var": {
        this.variables[String(params.name || "변수")] = Number(params.value) || 0;
        break;
      }
      case "change_var": {
        const name = String(params.name || "변수");
        this.variables[name] = (this.variables[name] || 0) + (Number(params.amount) || 1);
        break;
      }

      // ── 함수 ──
      case "call_func": {
        const funcName = String(params.name || "함수");
        const funcBlocks = this._funcDefs?.[funcName];
        if (funcBlocks) await this._runStack(funcBlocks, objId);
        break;
      }

      default:
        break;
    }
  }

  async _evalCondition(block, objId) {
    if (!block) return false;
    const params = block.params || {};
    switch (block.type) {
      case "eq": return (Number(params.a) || 0) === (Number(params.b) || 0);
      case "gt": return (Number(params.a) || 0) > (Number(params.b) || 0);
      case "lt": return (Number(params.a) || 0) < (Number(params.b) || 0);
      default: return false;
    }
  }

  _getObj(objId) {
    return this.stageRef?.current?.getObjects()?.find(o => o.id === objId);
  }

  _tick() { return this._sleep(16); }
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}