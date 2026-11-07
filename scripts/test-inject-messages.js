/**
 *   DevTools Console  
 *   Cowork   200  
 *
 *  :
 *   1.   Cowork  
 *   2.   DevTools (Cmd+Shift+I)
 *   3.   Console  
 */

(function injectTestMessages() {
  // Try multiple methods to find Redux store
  let store = null;

  // Method 1: window.__REDUX_STORE__ (if exposed)
  if (window.__REDUX_STORE__) {
    store = window.__REDUX_STORE__;
  }

  // Method 2: Walk React fiber tree
  if (!store) {
    const rootEl = document.getElementById('root');
    if (rootEl) {
      const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
      if (fiberKey) {
        let fiber = rootEl[fiberKey];
        while (fiber) {
          const s = fiber.memoizedProps?.store || fiber.stateNode?.store;
          if (s?.dispatch && s?.getState) {
            store = s;
            break;
          }
          fiber = fiber.return;
        }
      }
    }
  }

  // Method 3: Scan all DOM elements for React Provider
  if (!store) {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const key = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
      if (!key) continue;
      let fiber = el[key];
      let depth = 0;
      while (fiber && depth < 50) {
        const s = fiber.memoizedProps?.store;
        if (s?.dispatch && s?.getState) {
          store = s;
          break;
        }
        fiber = fiber.return;
        depth++;
      }
      if (store) break;
    }
  }

  if (!store) {
    console.error('Cannot find Redux store. Try running this in the renderer process DevTools.');
    console.log('Tip: In Electron, use View > Toggle Developer Tools, or press Cmd+Option+I while the main window is focused.');
    return;
  }

  const state = store.getState();
  console.log('Found Redux store. State keys:', Object.keys(state));
  const sessionId = state.cowork?.currentSessionId;
  if (!sessionId) {
    console.error('No active cowork session. Please open a session first.');
    return;
  }

  console.log(`Injecting 200 messages into session: ${sessionId}`);

  const sampleContents = [
    ' ',
    ' ...\n\n```typescript\nfunction fibonacci(n: number): number {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n```\n\n  O(2^n) ',
    ' ',
    ' \n\n```typescript\nfunction fibonacci(n: number): number {\n  if (n <= 1) return n;\n  let prev = 0, curr = 1;\n  for (let i = 2; i <= n; i++) {\n    [prev, curr] = [curr, prev + curr];\n  }\n  return curr;\n}\n```\n\n  O(2^n)   O(n)  O(1) ',
    ' ',
    ' ** **  O(log n) \n\n$$\\begin{pmatrix} F(n+1) \\\\ F(n) \\end{pmatrix} = \\begin{pmatrix} 1 & 1 \\\\ 1 & 0 \\end{pmatrix}^n \\begin{pmatrix} 1 \\\\ 0 \\end{pmatrix}$$\n\n O(n)  ',
    '  React  ',
    '  `@dnd-kit/core`  \n\n```tsx\nimport { DndContext, closestCenter } from \'@dnd-kit/core\';\nimport { SortableContext, verticalListSortingStrategy } from \'@dnd-kit/sortable\';\n\nfunction SortableList({ items, onReorder }) {\n  return (\n    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>\n      <SortableContext items={items} strategy={verticalListSortingStrategy}>\n        {items.map(item => <SortableItem key={item.id} item={item} />)}\n      </SortableContext>\n    </DndContext>\n  );\n}\n```',
    '  TypeScript  ',
    ' ',
    '```\nTS2345: Argument of type \'string\' is not assignable to parameter of type \'number\'.\n```',
    '  `parseInt()`   `Number()`  ',
    ' ',
    ' ...\n\n```\nsrc/\n├── main/          # Electron  \n├── renderer/      # React  \n│   ├── components/\n│   ├── services/\n│   ├── store/\n│   └── types/\n└── shared/        #  \n```',
    ' ',
    '```typescript\nimport { describe, it, expect } from \'vitest\';\nimport { fibonacci } from \'./fibonacci\';\n\ndescribe(\'fibonacci\', () => {\n  it(\'should return 0 for n=0\', () => {\n    expect(fibonacci(0)).toBe(0);\n  });\n  it(\'should return 1 for n=1\', () => {\n    expect(fibonacci(1)).toBe(1);\n  });\n  it(\'should return 55 for n=10\', () => {\n    expect(fibonacci(10)).toBe(55);\n  });\n});\n```',
    '  ✅',
    ' ',
    ' ',
    ' \n\n1. ** ** -   `fibonacci(-1)`  \n2. ** ** -   `fibonacci(50)`  \n3. ** ** -  ',
    ' ',
  ];

  const now = Date.now();
  const messages = [];

  for (let i = 0; i < 200; i++) {
    const isUser = i % 2 === 0;
    const contentIndex = i % sampleContents.length;
    messages.push({
      sessionId,
      message: {
        id: `test-msg-${i}-${Date.now()}`,
        type: isUser ? 'user' : 'assistant',
        content: sampleContents[contentIndex],
        timestamp: now - (200 - i) * 1000,
        metadata: isUser ? {} : { isFinal: true },
      },
    });
  }

  // Batch dispatch
  const batchSize = 10;
  let injected = 0;

  function injectBatch() {
    const batch = messages.slice(injected, injected + batchSize);
    batch.forEach(msg => {
      store.dispatch({ type: 'cowork/addMessage', payload: msg });
    });
    injected += batch.length;
    console.log(`Injected ${injected}/${messages.length} messages...`);

    if (injected < messages.length) {
      requestAnimationFrame(injectBatch);
    } else {
      console.log('✅ Done! 200 messages injected. Scroll the chat to test performance.');
    }
  }

  injectBatch();
})();