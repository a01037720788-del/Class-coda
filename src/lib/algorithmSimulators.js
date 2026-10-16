/**
 * 알고리즘 시뮬레이터 엔진
 * 각 알고리즘 타입별로 단계(steps) 배열을 생성.
 */

// 선형 탐색
export function simulateLinearSearch(cfg) {
  const arr = cfg.array_data || [];
  const target = cfg.target ?? arr[0];
  const steps = [];
  let found = -1;
  steps.push({
    description: `배열에서 ${target}을(를) 찾습니다. 처음부터 순서대로 확인합니다.`,
    highlight: [], pointers: { i: -1 }, array: [...arr], found: false, done: false,
  });
  for (let i = 0; i < arr.length; i++) {
    steps.push({
      description: `인덱스 ${i}: ${arr[i]} 확인 중...`,
      highlight: [i], pointers: { i }, array: [...arr], found: false, done: false, comparing: true,
    });
    if (arr[i] === target) {
      found = i;
      steps.push({
        description: `찾았습니다! 인덱스 ${i}에 ${target}이(가) 있습니다.`,
        highlight: [i], pointers: { i }, array: [...arr], found: true, foundIndex: i, done: true,
      });
      break;
    } else {
      steps.push({
        description: `${arr[i]} ≠ ${target}. 다음으로 이동합니다.`,
        highlight: [i], pointers: { i }, array: [...arr], found: false, done: false,
      });
    }
  }
  if (found === -1) {
    steps.push({
      description: `끝까지 확인했지만 ${target}을(를) 찾지 못했습니다.`,
      highlight: [], pointers: { i: arr.length - 1 }, array: [...arr], found: false, done: true,
    });
  }
  return steps;
}

// 이진 탐색
export function simulateBinarySearch(cfg) {
  const arr = cfg.array_data || [];
  const target = cfg.target ?? arr[0];
  const steps = [];
  let left = cfg.start_index ?? 0;
  let right = arr.length - 1;
  steps.push({
    description: `정렬된 배열에서 ${target}을(를) 이진탐색합니다. left=${left}, right=${right}`,
    highlight: [], pointers: { left, right, mid: -1 }, array: [...arr], range: [left, right], found: false, done: false,
  });
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    steps.push({
      description: `mid = (${left} + ${right}) // 2 = ${mid}. arr[${mid}] = ${arr[mid]}`,
      highlight: [mid], pointers: { left, right, mid }, array: [...arr], range: [left, right], found: false, done: false, comparing: true,
    });
    if (arr[mid] === target) {
      steps.push({
        description: `찾았습니다! 인덱스 ${mid}에 ${target}이(가) 있습니다.`,
        highlight: [mid], pointers: { left, right, mid }, array: [...arr], range: [left, right], found: true, foundIndex: mid, done: true,
      });
      return steps;
    } else if (arr[mid] < target) {
      steps.push({
        description: `${arr[mid]} < ${target}. 오른쪽 절반으로 범위 이동. left = ${mid + 1}`,
        highlight: [], pointers: { left, right, mid }, array: [...arr], range: [left, right], found: false, done: false,
      });
      left = mid + 1;
    } else {
      steps.push({
        description: `${arr[mid]} > ${target}. 왼쪽 절반으로 범위 이동. right = ${mid - 1}`,
        highlight: [], pointers: { left, right, mid }, array: [...arr], range: [left, right], found: false, done: false,
      });
      right = mid - 1;
    }
    steps.push({
      description: `새 탐색 범위: left=${left}, right=${right}`,
      highlight: [], pointers: { left, right, mid: -1 }, array: [...arr], range: [left, right], found: false, done: false,
    });
  }
  steps.push({
    description: `탐색 종료. ${target}을(를) 찾지 못했습니다.`,
    highlight: [], pointers: { left, right, mid: -1 }, array: [...arr], found: false, done: true,
  });
  return steps;
}

// 선택 정렬
export function simulateSelectionSort(cfg) {
  const arr = [...(cfg.array_data || [])];
  const steps = [];
  steps.push({
    description: `선택 정렬 시작. 가장 작은 값을 찾아 앞으로 보냅니다.`,
    highlight: [], pointers: { i: -1, minIdx: -1, j: -1 }, array: [...arr], done: false,
  });
  for (let i = 0; i < arr.length - 1; i++) {
    let minIdx = i;
    steps.push({
      description: `i=${i}. 최솟값 후보를 arr[${i}]=${arr[i]}로 설정.`,
      highlight: [i], pointers: { i, minIdx, j: i }, array: [...arr], done: false,
    });
    for (let j = i + 1; j < arr.length; j++) {
      steps.push({
        description: `j=${j}. arr[${j}]=${arr[j]} 와 arr[${minIdx}]=${arr[minIdx]} 비교.`,
        highlight: [j, minIdx], pointers: { i, minIdx, j }, array: [...arr], done: false, comparing: true,
      });
      if (arr[j] < arr[minIdx]) {
        minIdx = j;
        steps.push({
          description: `더 작은 값 발견! 최솟값 인덱스 = ${minIdx}.`,
          highlight: [minIdx], pointers: { i, minIdx, j }, array: [...arr], done: false,
        });
      }
    }
    if (minIdx !== i) {
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
      steps.push({
        description: `swap! arr[${i}] ↔ arr[${minIdx}]. 배열: [${arr.join(", ")}]`,
        highlight: [i, minIdx], pointers: { i, minIdx, j: -1 }, array: [...arr], done: false, swapped: true,
      });
    } else {
      steps.push({
        description: `이미 제자리. 다음으로.`,
        highlight: [i], pointers: { i, minIdx, j: -1 }, array: [...arr], done: false,
      });
    }
  }
  steps.push({
    description: `정렬 완료! 결과: [${arr.join(", ")}]`,
    highlight: [], pointers: { i: -1, minIdx: -1, j: -1 }, array: [...arr], done: true,
  });
  return steps;
}

// 삽입 정렬
export function simulateInsertionSort(cfg) {
  const arr = [...(cfg.array_data || [])];
  const steps = [];
  steps.push({
    description: `삽입 정렬 시작. 두 번째 원소부터 시작.`,
    highlight: [], pointers: { i: -1, j: -1 }, array: [...arr], done: false,
  });
  for (let i = 1; i < arr.length; i++) {
    const key = arr[i];
    let j = i - 1;
    steps.push({
      description: `i=${i}. key=${key}를 정렬된 앞부분에 삽입할 위치를 찾습니다.`,
      highlight: [i], pointers: { i, j }, array: [...arr], done: false,
    });
    while (j >= 0 && arr[j] > key) {
      steps.push({
        description: `arr[${j}]=${arr[j]} > key=${key}. 오른쪽으로 밀기.`,
        highlight: [j, j + 1], pointers: { i, j }, array: [...arr], done: false, comparing: true,
      });
      arr[j + 1] = arr[j];
      j--;
      steps.push({
        description: `한 칸 이동. 배열: [${arr.join(", ")}]`,
        highlight: [j + 1], pointers: { i, j }, array: [...arr], done: false,
      });
    }
    arr[j + 1] = key;
    steps.push({
      description: `key=${key}를 위치 ${j + 1}에 삽입. 배열: [${arr.join(", ")}]`,
      highlight: [j + 1], pointers: { i, j }, array: [...arr], done: false,
    });
  }
  steps.push({
    description: `정렬 완료! 결과: [${arr.join(", ")}]`,
    highlight: [], pointers: { i: -1, j: -1 }, array: [...arr], done: true,
  });
  return steps;
}

// 버블 정렬
export function simulateBubbleSort(cfg) {
  const arr = [...(cfg.array_data || [])];
  const steps = [];
  steps.push({
    description: `버블 정렬 시작. 인접한 두 값을 비교하며 큰 값을 뒤로.`,
    highlight: [], pointers: { i: -1, j: -1 }, array: [...arr], done: false,
  });
  for (let i = 0; i < arr.length - 1; i++) {
    for (let j = 0; j < arr.length - 1 - i; j++) {
      steps.push({
        description: `i=${i}, j=${j}. arr[${j}]=${arr[j]} 와 arr[${j + 1}]=${arr[j + 1]} 비교.`,
        highlight: [j, j + 1], pointers: { i, j }, array: [...arr], done: false, comparing: true,
      });
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        steps.push({
          description: `swap! 배열: [${arr.join(", ")}]`,
          highlight: [j, j + 1], pointers: { i, j }, array: [...arr], done: false, swapped: true,
        });
      }
    }
  }
  steps.push({
    description: `정렬 완료! 결과: [${arr.join(", ")}]`,
    highlight: [], pointers: { i: -1, j: -1 }, array: [...arr], done: true,
  });
  return steps;
}

// 그래프 인접 리스트 생성 (DFS/BFS 공용)
function buildAdj(cfg) {
  const nodes = cfg.graph_nodes || [];
  const edges = cfg.graph_edges || [];
  const adj = {};
  nodes.forEach(n => { adj[n] = []; });
  edges.forEach(([a, b]) => {
    if (adj[a]) adj[a].push(b);
    if (adj[b]) adj[b].push(a);
  });
  return adj;
}

// DFS
export function simulateDFS(cfg) {
  const nodes = cfg.graph_nodes || [];
  const start = cfg.start_node || nodes[0];
  const adj = buildAdj(cfg);
  const visited = [];
  const stack = [start];
  const steps = [];
  steps.push({
    description: `DFS 시작. 시작 노드 ${start}를 스택에 push.`,
    visited: [...visited], stack: [...stack], queue: [], currentNode: null, done: false,
  });
  while (stack.length > 0) {
    const node = stack.pop();
    steps.push({
      description: `스택에서 pop → ${node}.`,
      visited: [...visited], stack: [...stack], queue: [], currentNode: node, done: false,
    });
    if (!visited.includes(node)) {
      visited.push(node);
      steps.push({
        description: `${node} 방문. 방문 목록: [${visited.join(", ")}]`,
        visited: [...visited], stack: [...stack], queue: [], currentNode: node, done: false,
      });
      const neighbors = (adj[node] || [])
        .filter(n => !visited.includes(n) && !stack.includes(n))
        .reverse();
      neighbors.forEach(n => stack.push(n));
      steps.push({
        description: `인접 노드 [${neighbors.join(", ")}]를 스택에 push. 스택: [${stack.join(", ")}]`,
        visited: [...visited], stack: [...stack], queue: [], currentNode: node, done: false,
      });
    }
  }
  steps.push({
    description: `DFS 완료! 방문 순서: [${visited.join(", ")}]`,
    visited: [...visited], stack: [], queue: [], currentNode: null, done: true,
  });
  return steps;
}

// BFS
export function simulateBFS(cfg) {
  const nodes = cfg.graph_nodes || [];
  const start = cfg.start_node || nodes[0];
  const adj = buildAdj(cfg);
  const visited = [start];
  const queue = [start];
  const steps = [];
  steps.push({
    description: `BFS 시작. 시작 노드 ${start}를 큐에 enqueue.`,
    visited: [...visited], stack: [], queue: [...queue], currentNode: null, done: false,
  });
  while (queue.length > 0) {
    const node = queue.shift();
    steps.push({
      description: `큐에서 dequeue → ${node}.`,
      visited: [...visited], stack: [], queue: [...queue], currentNode: node, done: false,
    });
    const neighbors = (adj[node] || []).filter(n => !visited.includes(n));
    neighbors.forEach(n => { visited.push(n); queue.push(n); });
    steps.push({
      description: `${node}의 인접 노드 [${neighbors.join(", ")}]를 큐에 enqueue. 큐: [${queue.join(", ")}]`,
      visited: [...visited], stack: [], queue: [...queue], currentNode: node, done: false,
    });
  }
  steps.push({
    description: `BFS 완료! 방문 순서: [${visited.join(", ")}]`,
    visited: [...visited], stack: [], queue: [], currentNode: null, done: true,
  });
  return steps;
}

// 스택
export function simulateStack(cfg) {
  const arr = cfg.array_data || [];
  const steps = [];
  const stack = [];
  steps.push({ description: `빈 스택에서 시작.`, stack: [...stack], done: false, operation: "init" });
  arr.forEach((v) => {
    stack.push(v);
    steps.push({ description: `push(${v}). 스택: [${stack.join(", ")}]`, stack: [...stack], done: false, operation: "push", value: v });
  });
  while (stack.length > 0) {
    const v = stack.pop();
    steps.push({ description: `pop() → ${v}. 스택: [${stack.join(", ")}]`, stack: [...stack], done: false, operation: "pop", value: v });
  }
  steps.push({ description: `스택이 비었습니다.`, stack: [], done: true, operation: "done" });
  return steps;
}

// 큐
export function simulateQueue(cfg) {
  const arr = cfg.array_data || [];
  const steps = [];
  const queue = [];
  steps.push({ description: `빈 큐에서 시작.`, queue: [...queue], done: false, operation: "init" });
  arr.forEach((v) => {
    queue.push(v);
    steps.push({ description: `enqueue(${v}). 큐: [${queue.join(", ")}]`, queue: [...queue], done: false, operation: "enqueue", value: v });
  });
  while (queue.length > 0) {
    const v = queue.shift();
    steps.push({ description: `dequeue() → ${v}. 큐: [${queue.join(", ")}]`, queue: [...queue], done: false, operation: "dequeue", value: v });
  }
  steps.push({ description: `큐가 비었습니다.`, queue: [], done: true, operation: "done" });
  return steps;
}

// 투포인터 (정렬된 배열에서 두 수의 합)
export function simulateTwoPointer(cfg) {
  const arr = [...(cfg.array_data || [])].sort((a, b) => a - b);
  const target = cfg.target ?? 0;
  const steps = [];
  let left = 0, right = arr.length - 1;
  steps.push({
    description: `투포인터 시작. left=0, right=${right}. 목표 합=${target}`,
    highlight: [left, right], pointers: { left, right }, array: [...arr], done: false,
  });
  while (left < right) {
    const sum = arr[left] + arr[right];
    steps.push({
      description: `arr[${left}]+arr[${right}] = ${arr[left]}+${arr[right]} = ${sum}`,
      highlight: [left, right], pointers: { left, right }, array: [...arr], done: false, comparing: true,
    });
    if (sum === target) {
      steps.push({
        description: `찾았습니다! ${arr[left]} + ${arr[right]} = ${target}`,
        highlight: [left, right], pointers: { left, right }, array: [...arr], done: true, found: true,
      });
      return steps;
    } else if (sum < target) {
      left++;
      steps.push({
        description: `${sum} < ${target}. left++ → ${left}`,
        highlight: [left, right], pointers: { left, right }, array: [...arr], done: false,
      });
    } else {
      right--;
      steps.push({
        description: `${sum} > ${target}. right-- → ${right}`,
        highlight: [left, right], pointers: { left, right }, array: [...arr], done: false,
      });
    }
  }
  steps.push({
    description: `두 수의 합이 ${target}인 쌍을 찾지 못했습니다.`,
    highlight: [], pointers: { left, right }, array: [...arr], done: true,
  });
  return steps;
}

// 누적합
export function simulatePrefixSum(cfg) {
  const arr = cfg.array_data || [];
  const steps = [];
  const prefix = [0];
  steps.push({
    description: `누적합 시작. prefix[0] = 0 (초기값).`,
    prefix: [...prefix], array: [...arr], highlight: [], done: false,
  });
  arr.forEach((v, i) => {
    const next = prefix[prefix.length - 1] + v;
    prefix.push(next);
    steps.push({
      description: `prefix[${i + 1}] = prefix[${i}] + arr[${i}] = ${prefix[prefix.length - 2]} + ${v} = ${next}`,
      prefix: [...prefix], array: [...arr], highlight: [i], done: false,
    });
  });
  steps.push({
    description: `완료! 누적합 배열: [${prefix.join(", ")}]`,
    prefix: [...prefix], array: [...arr], highlight: [], done: true,
  });
  return steps;
}

// 그리디 기초 (동전 거스름)
export function simulateGreedy(cfg) {
  const coins = [500, 100, 50, 10];
  let amount = cfg.target ?? cfg.array_data?.[0] ?? 1260;
  const steps = [];
  const result = {};
  steps.push({
    description: `거스름 ${amount}원을 큰 단위 동전부터 나눕니다.`,
    coins: [...coins], result: {}, amount, done: false,
  });
  for (const c of coins) {
    const count = Math.floor(amount / c);
    if (count > 0) {
      result[c] = count;
      amount -= c * count;
      steps.push({
        description: `${c}원 × ${count}개 사용. 남은 금액 ${amount}원.`,
        coins: [...coins], result: { ...result }, amount, done: false,
      });
    }
  }
  steps.push({
    description: `완료! 사용 동전: ${Object.entries(result).map(([c, n]) => `${c}원×${n}`).join(", ")}`,
    coins: [...coins], result: { ...result }, amount: 0, done: true,
  });
  return steps;
}

const ENGINES = {
  linear_search: simulateLinearSearch,
  binary_search: simulateBinarySearch,
  selection_sort: simulateSelectionSort,
  insertion_sort: simulateInsertionSort,
  bubble_sort: simulateBubbleSort,
  dfs: simulateDFS,
  bfs: simulateBFS,
  stack: simulateStack,
  queue: simulateQueue,
  two_pointer: simulateTwoPointer,
  prefix_sum: simulatePrefixSum,
  greedy: simulateGreedy,
};

export const ALGORITHM_LABELS = {
  linear_search: "선형 탐색",
  binary_search: "이진 탐색",
  selection_sort: "선택 정렬",
  insertion_sort: "삽입 정렬",
  bubble_sort: "버블 정렬",
  dfs: "DFS",
  bfs: "BFS",
  stack: "스택",
  queue: "큐",
  two_pointer: "투포인터",
  prefix_sum: "누적합",
  greedy: "그리디 기초",
};

export function getSimulationSteps(cfg) {
  const fn = ENGINES[cfg?.algorithm_type];
  if (!fn) return [{ description: "지원하지 않는 알고리즘입니다.", done: true }];
  return fn(cfg);
}