import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { ToastProvider } from "@/lib/toast";

function WithToast({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

/** RTL render wrapped in ToastProvider for components that call useToast. */
export function renderWithToast(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: WithToast, ...options });
}
