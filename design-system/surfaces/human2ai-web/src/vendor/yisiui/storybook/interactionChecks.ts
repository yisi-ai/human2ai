export function assertStoryText(root: HTMLElement, expected: string): void {
  if (!root.textContent?.includes(expected)) {
    throw new Error(`Story interaction contract missing text: ${expected}`);
  }
}

export function assertStoryRole(root: HTMLElement, role: string): void {
  if (!root.querySelector(`[role="${role}"]`)) {
    throw new Error(`Story interaction contract missing role: ${role}`);
  }
}

export function assertStorySelector(root: HTMLElement, selector: string): void {
  if (!root.querySelector(selector)) {
    throw new Error(`Story interaction contract missing selector: ${selector}`);
  }
}
