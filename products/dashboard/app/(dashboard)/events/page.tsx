import { ShellEvents } from "@/components/shell-events";

/**
 * Event Feed — placeholder.
 *
 * The real audit event feed lands in a follow-up PR (AEL-31). This
 * page exists so the sidebar's Workspace → Event Feed link doesn't
 * 404 and so shell events fire on the route during PR 3.
 */
export default function EventsPage() {
  return (
    <>
      <ShellEvents route="/events" />
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <h1 className="text-[16px] font-semibold text-t1">Event Feed</h1>
        <p className="max-w-md text-[12.5px] text-t3">
          A live, filterable feed of dashboard, auth, and workflow events
          will land here in a follow-up PR.
        </p>
      </div>
    </>
  );
}
