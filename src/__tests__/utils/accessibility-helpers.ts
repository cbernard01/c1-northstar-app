import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

// Common accessibility test helper
export async function testAccessibility(container: Element) {
  const results = await axe(container)
  expect(results).toHaveNoViolations()
}

// Test keyboard navigation
export function testKeyboardNavigation(element: HTMLElement) {
  // Test focus
  element.focus()
  expect(document.activeElement).toBe(element)
  
  // Test tab navigation
  const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' })
  element.dispatchEvent(tabEvent)
  
  return {
    isAccessible: () => testAccessibility(element),
    isFocusable: () => expect(element).toHaveFocus(),
    hasAriaLabel: (label: string) => expect(element).toHaveAttribute('aria-label', label),
    hasRole: (role: string) => expect(element).toHaveAttribute('role', role),
  }
}

// Common ARIA patterns
export const ariaPatterns = {
  button: {
    role: 'button',
    requiredAttributes: ['aria-label'],
  },
  link: {
    role: 'link',
    requiredAttributes: ['href'],
  },
  textbox: {
    role: 'textbox',
    requiredAttributes: ['aria-label', 'id'],
  },
  checkbox: {
    role: 'checkbox',
    requiredAttributes: ['aria-checked'],
  },
  radiogroup: {
    role: 'radiogroup',
    requiredAttributes: ['aria-labelledby'],
  },
}

// Color contrast helper (simplified check)
export function hasGoodContrast(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)
  const backgroundColor = computedStyle.backgroundColor
  const color = computedStyle.color
  
  // This is a simplified check - in production you'd use a proper contrast calculation
  return backgroundColor !== color && backgroundColor !== 'transparent'
}

// Test the accessibility helpers themselves
describe('Accessibility Helpers', () => {
  it('should export test functions', () => {
    expect(typeof testAccessibility).toBe('function')
    expect(typeof testKeyboardNavigation).toBe('function')
    expect(typeof hasGoodContrast).toBe('function')
  })
})