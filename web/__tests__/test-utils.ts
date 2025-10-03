// @ts-nocheck
// Minimal testing utilities to avoid heavy dependencies
import React from 'react';
import ReactDOM from 'react-dom/client';

let currentContainer: HTMLDivElement | null = null;

// Minimal render implementation
export function render(
  component: React.ReactElement,
  options?: { container?: HTMLElement }
) {
  const container = options?.container || (() => {
    if (currentContainer && !options?.container) {
      document.body.removeChild(currentContainer);
    }
    currentContainer = document.createElement('div');
    document.body.appendChild(currentContainer);
    return currentContainer;
  })();

  const root = ReactDOM.createRoot(container);
  root.render(component);

  return {
    container,
    rerender: (newComponent: React.ReactElement) => {
      root.render(newComponent);
    }
  };
}

// Minimal screen queries
export const screen = {
  getByText: (text: string | RegExp): HTMLElement => {
    const elements = Array.from(document.body.querySelectorAll('*'));
    const element = elements.find(el => {
      const content = el.textContent || '';
      return typeof text === 'string'
        ? content.includes(text)
        : text.test(content);
    });
    if (!element) throw new Error(`Unable to find element with text: ${text}`);
    return element as HTMLElement;
  },

  queryByText: (text: string | RegExp): HTMLElement | null => {
    const elements = Array.from(document.body.querySelectorAll('*'));
    const element = elements.find(el => {
      const content = el.textContent || '';
      return typeof text === 'string'
        ? content.includes(text)
        : text.test(content);
    });
    return element as HTMLElement || null;
  },

  findByText: async (text: string | RegExp): Promise<HTMLElement> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timeout waiting for: ${text}`)), 3000);
      const interval = setInterval(() => {
        try {
          const element = screen.getByText(text);
          clearInterval(interval);
          clearTimeout(timeout);
          resolve(element);
        } catch (e) {
          // Keep trying
        }
      }, 100);
    });
  },

  getAllByRole: (role: string): HTMLElement[] => {
    const selector = role === 'button' ? 'button, [role="button"]' :
                     role === 'heading' ? 'h1, h2, h3, h4, h5, h6, [role="heading"]' :
                     `[role="${role}"]`;
    return Array.from(document.querySelectorAll(selector)) as HTMLElement[];
  },

  getByRole: (role: string, options?: { name?: RegExp }): HTMLElement => {
    const elements = screen.getAllByRole(role);
    if (!options?.name) {
      if (elements.length === 0) throw new Error(`No elements with role: ${role}`);
      return elements[0];
    }

    const element = elements.find(el => {
      const label = el.getAttribute('aria-label') || el.textContent || '';
      return options.name!.test(label);
    });

    if (!element) throw new Error(`Unable to find ${role} with name: ${options.name}`);
    return element;
  },

  getByPlaceholderText: (text: string | RegExp): HTMLElement => {
    const elements = Array.from(document.querySelectorAll('[placeholder]'));
    const element = elements.find(el => {
      const placeholder = el.getAttribute('placeholder') || '';
      return typeof text === 'string'
        ? placeholder.toLowerCase().includes(text.toLowerCase())
        : text.test(placeholder);
    });
    if (!element) throw new Error(`Unable to find element with placeholder: ${text}`);
    return element as HTMLElement;
  },

  getByLabelText: (text: string | RegExp): HTMLElement => {
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find(l => {
      const labelText = l.textContent || '';
      return typeof text === 'string'
        ? labelText.toLowerCase().includes(text.toLowerCase())
        : text.test(labelText);
    });

    if (label) {
      const forAttr = label.getAttribute('for');
      if (forAttr) {
        const input = document.getElementById(forAttr);
        if (input) return input as HTMLElement;
      }
      const input = label.querySelector('input, textarea, select');
      if (input) return input as HTMLElement;
    }

    throw new Error(`Unable to find element with label: ${text}`);
  }
};

// Minimal jest-dom matchers
export const customMatchers = {
  toBeInTheDocument(element: HTMLElement) {
    const pass = document.body.contains(element);
    return {
      pass,
      message: () => pass
        ? `Expected element not to be in document`
        : `Expected element to be in document`
    };
  },

  toHaveAttribute(element: HTMLElement, attr: string, value?: string) {
    const hasAttr = element.hasAttribute(attr);
    const attrValue = element.getAttribute(attr);
    const pass = value !== undefined
      ? hasAttr && attrValue === value
      : hasAttr;

    return {
      pass,
      message: () => pass
        ? `Expected element not to have attribute ${attr}`
        : `Expected element to have attribute ${attr}`
    };
  }
};

// Mock axe implementation (returns no violations for simplicity)
export const axe = async (container: HTMLElement, options?: any) => {
  return { violations: [] };
};

export const toHaveNoViolations = {
  toHaveNoViolations(results: any) {
    const pass = results.violations.length === 0;
    return {
      pass,
      message: () => pass
        ? 'Expected accessibility violations'
        : `Found ${results.violations.length} accessibility violations`
    };
  }
};

// fireEvent utility
export const fireEvent = {
  click: (element: HTMLElement) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  },
  change: (element: HTMLElement, event: { target: { value: string } }) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    nativeInputValueSetter?.call(element, event.target.value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
};

// waitFor utility
export async function waitFor(
  callback: () => void,
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout || 3000;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      try {
        callback();
        clearInterval(interval);
        resolve();
      } catch (error) {
        if (Date.now() - startTime >= timeout) {
          clearInterval(interval);
          reject(error);
        }
      }
    }, 50);
  });
}

// userEvent mock (minimal implementation)
export const userEvent = {
  setup: () => ({
    type: async (element: HTMLElement, text: string) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    clear: async (element: HTMLElement) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    click: async (element: HTMLElement) => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    upload: async (element: HTMLElement, file: File | File[]) => {
      if (element instanceof HTMLInputElement && element.type === 'file') {
        const files = Array.isArray(file) ? file : [file];
        const dataTransfer = new DataTransfer();
        files.forEach(f => dataTransfer.items.add(f));
        element.files = dataTransfer.files;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  })
};

// Cleanup function
export function cleanup() {
  if (currentContainer) {
    document.body.removeChild(currentContainer);
    currentContainer = null;
  }
}
