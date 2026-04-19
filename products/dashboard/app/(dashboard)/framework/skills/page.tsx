import { ShellEvents } from "@/components/shell-events";

/**
 * Skills — placeholder.
 *
 * Real Skills library lands in PR 13 (AEL-56). This page exists so the
 * sidebar's Framework → Skills link doesn't 404 and so shell events
 * fire on the route during PR 3.
 */
export default function SkillsPage() {
  return (
    <>
      <ShellEvents route="/framework/skills" />
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <h1 className="text-[16px] font-semibold text-t1">Skills</h1>
        <p className="max-w-md text-[12.5px] text-t3">
          The Skills library will live here. Skill authoring, listing, and the
          Markdown editor land in a follow-up PR.
        </p>
      </div>
    </>
  );
}
