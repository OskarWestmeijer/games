// Minimal keyboard state. Screen-space axis: x = left/right, y = up/down.

export interface Input {
  keys: Set<string>;
}

export function createInput(): Input {
  const keys = new Set<string>();
  const blocked = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (blocked.includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  return { keys };
}

export function axis(input: Input): { x: number; y: number } {
  const k = input.keys;
  let x = 0;
  let y = 0;
  if (k.has('a') || k.has('arrowleft')) x -= 1;
  if (k.has('d') || k.has('arrowright')) x += 1;
  if (k.has('w') || k.has('arrowup')) y -= 1;
  if (k.has('s') || k.has('arrowdown')) y += 1;
  return { x, y };
}
