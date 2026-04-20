import { ShellEvents } from "@/components/shell-events";

/**
 * Playbooks — placeholder.
 *
 * Real Playbooks library lands in PR 13 (AEL-57). This page exists so
 * the sidebar's Framework → Playbooks link doesn't 404 and so shell
 * events fire on the route during PR 3.
 */
export default function PlaybooksPage() {
  return (
    <>
      <ShellEvents route="/framework/playbooks" />
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <h1 className="text-[16px] font-semibold text-t1">Playbooks</h1>
        <p className="max-w-md text-[12.5px] text-t3">
          The Playbooks library will live here. Authoring, listing, and the
          Markdown editor land in a follow-up PR.
        </p>
      </div>
    </>
  );
}
