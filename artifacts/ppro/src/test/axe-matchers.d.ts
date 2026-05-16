import type { AxeResults } from "axe-core";

declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toHaveNoViolations(): void;
    }
    interface AsymmetricMatchersContaining {
      toHaveNoViolations(): void;
    }
  }
}
