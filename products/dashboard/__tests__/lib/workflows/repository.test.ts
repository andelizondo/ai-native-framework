// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createWorkflowRepository } from "@/lib/workflows/repository";

// Lightweight in-memory fake of the subset of @supabase/supabase-js the
// repository touches. Keeps the tests hermetic — no Docker, no network.
//
// The fake supports the chainable query-builder shape returned by
// `client.from(table)`: select / eq / order / limit / maybeSingle / single,
// plus mutating insert/update/upsert that flow through the same shape.

interface RowMap {
  [table: string]: Record<string, unknown>[];
}

interface FilterState {
  table: string;
  rows: Record<string, unknown>[];
  filters: Array<(row: Record<string, unknown>) => boolean>;
  orderBy: Array<{ column: string; ascending: boolean }>;
  limitN?: number;
  pendingInsert?: Record<string, unknown>[];
  pendingUpdate?: Record<string, unknown>;
  pendingUpsert?: Record<string, unknown>[];
  pendingDelete: boolean;
  selecting: boolean;
}

function makeQueryBuilder(state: FilterState, store: RowMap) {
  const builder: Record<string, unknown> & { select: (_columns?: string) => typeof builder } = {
    select(_columns?: string) {
      state.selecting = true;
      return builder;
    },
    eq(column: string, value: unknown) {
      state.filters.push((row) => row[column] === value);
      return builder;
    },
    in(column: string, values: unknown[]) {
      const set = new Set(values);
      state.filters.push((row) => set.has(row[column]));
      return builder;
    },
    order(column: string, options?: { ascending?: boolean }) {
      state.orderBy.push({ column, ascending: options?.ascending ?? true });
      return builder;
    },
    limit(n: number) {
      state.limitN = n;
      return builder;
    },
    insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      state.pendingInsert = Array.isArray(rows) ? rows : [rows];
      return builder;
    },
    update(patch: Record<string, unknown>) {
      state.pendingUpdate = patch;
      return builder;
    },
    upsert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      state.pendingUpsert = Array.isArray(rows) ? rows : [rows];
      return builder;
    },
    delete() {
      state.pendingDelete = true;
      return builder;
    },
    async maybeSingle() {
      const result = applyOperation(state, store);
      const row = result[0] ?? null;
      return { data: row, error: null };
    },
    async single() {
      const result = applyOperation(state, store);
      if (result.length === 0) {
        return { data: null, error: { message: "no rows" } };
      }
      return { data: result[0], error: null };
    },
    then(resolve: (value: { data: unknown; error: null }) => unknown) {
      const result = applyOperation(state, store);
      return Promise.resolve(resolve({ data: result, error: null }));
    },
  };
  return builder;
}

let nextIdCounter = 0;
function nextId(prefix: string): string {
  nextIdCounter += 1;
  return `${prefix}-${nextIdCounter}`;
}

function applyOperation(
  state: FilterState,
  store: RowMap,
): Record<string, unknown>[] {
  const tableRows = (store[state.table] ??= []);

  if (state.pendingInsert) {
    const inserted = state.pendingInsert.map((row) => ({
      id: row.id ?? nextId(state.table),
      created_at: row.created_at ?? "2026-04-19T12:00:00Z",
      updated_at: row.updated_at ?? "2026-04-19T12:00:00Z",
      ...row,
    }));
    tableRows.push(...inserted);
    return inserted;
  }

  if (state.pendingUpsert) {
    const result: Record<string, unknown>[] = [];
    for (const row of state.pendingUpsert) {
      const existingIndex = tableRows.findIndex((r) => r.id === row.id);
      const merged = {
        created_at: tableRows[existingIndex]?.created_at ?? "2026-04-19T12:00:00Z",
        updated_at: "2026-04-19T12:00:01Z",
        ...row,
      };
      if (existingIndex >= 0) {
        tableRows[existingIndex] = { ...tableRows[existingIndex], ...merged };
        result.push(tableRows[existingIndex]);
      } else {
        tableRows.push(merged);
        result.push(merged);
      }
    }
    return result;
  }

  if (state.pendingUpdate) {
    const updated: Record<string, unknown>[] = [];
    for (const row of tableRows) {
      if (state.filters.every((f) => f(row))) {
        Object.assign(row, state.pendingUpdate, {
          updated_at: "2026-04-19T12:00:02Z",
        });
        updated.push(row);
      }
    }
    return updated;
  }

  if (state.pendingDelete) {
    const removed: Record<string, unknown>[] = [];
    const kept: Record<string, unknown>[] = [];

    for (const row of tableRows) {
      if (state.filters.every((f) => f(row))) {
        removed.push(row);
      } else {
        kept.push(row);
      }
    }

    store[state.table] = kept;
    return removed;
  }

  // Read path
  let rows = tableRows.filter((row) => state.filters.every((f) => f(row)));

  for (const ord of state.orderBy) {
    rows = [...rows].sort((a, b) => {
      const av = a[ord.column];
      const bv = b[ord.column];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (av < bv ? -1 : 1) * (ord.ascending ? 1 : -1);
    });
  }

  if (typeof state.limitN === "number") {
    rows = rows.slice(0, state.limitN);
  }

  return rows;
}

function makeFakeClient(store: RowMap): SupabaseClient {
  return {
    from(table: string) {
      const state: FilterState = {
        table,
        rows: [],
        filters: [],
        orderBy: [],
        pendingDelete: false,
        selecting: false,
      };
      return makeQueryBuilder(state, store);
    },
  } as unknown as SupabaseClient;
}

describe("workflow repository", () => {
  let store: RowMap;

  beforeEach(() => {
    nextIdCounter = 0;
    store = {
      workflow_templates: [
        {
          id: "client-delivery",
          label: "Client Project Delivery",
          color: "#6366f1",
          multi_instance: true,
          stages: [
            { id: "pre-sales", label: "Pre-Sales" },
            { id: "validation", label: "Validation" },
          ],
          skills: [
            { id: "sales-ops", label: "Sales Ops", owner: "Hans / Dave" },
            { id: "pm", label: "PM", owner: "Andres" },
          ],
          task_templates: [
            {
              skillId: "sales-ops",
              stageId: "pre-sales",
              playbookId: "presales-qualification",
              notes: "",
              inputs: [],
            },
            {
              skillId: "pm",
              stageId: "validation",
              playbookId: "pdr-review",
              notes: "",
              checkpoint: true,
              inputs: [
                {
                  id: "in-1",
                  name: "After PD",
                  linkMode: "linked",
                  upstreamTaskRef: "presales-qualification",
                  upstreamOutputId: null,
                },
              ],
            },
          ],
          created_at: "2026-04-19T12:00:00Z",
          updated_at: "2026-04-19T12:00:00Z",
        },
        {
          id: "product-dev",
          label: "Product Development",
          color: "#10b981",
          multi_instance: false,
          stages: [],
          skills: [],
          task_templates: [],
          created_at: "2026-04-19T12:00:00Z",
          updated_at: "2026-04-19T12:00:00Z",
        },
      ],
      workflow_instances: [],
      workflow_tasks: [],
      workflow_events: [],
      framework_items: [
        {
          id: "sk-pm",
          type: "skill",
          name: "PM",
          description: "Product management",
          icon: "📋",
          content: "# PM Skill",
          created_at: "2026-04-19T12:00:00Z",
          updated_at: "2026-04-19T12:00:00Z",
        },
        {
          id: "pb-presales",
          type: "playbook",
          name: "presales-qualification",
          description: "Qualify clients",
          icon: "📄",
          content: "# Presales",
          created_at: "2026-04-19T12:00:00Z",
          updated_at: "2026-04-19T12:00:00Z",
        },
      ],
    };
  });

  describe("getTemplates", () => {
    it("returns all templates mapped to camelCase shape, ordered by label", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const templates = await repo.getTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0]).toMatchObject({
        id: "client-delivery",
        label: "Client Project Delivery",
        multiInstance: true,
        color: "#6366f1",
      });
      expect(templates[0].skills).toEqual([
        { id: "sales-ops", label: "Sales Ops", owners: ["Hans / Dave"] },
        { id: "pm", label: "PM", owners: ["Andres"] },
      ]);
      expect(templates[0].taskTemplates).toHaveLength(2);
      expect(templates[1].id).toBe("product-dev");
    });
  });

  describe("createInstance", () => {
    it("creates instance + materializes tasks from the template's taskTemplates", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const instance = await repo.createInstance("client-delivery", "Acme Corp");

      expect(instance.templateId).toBe("client-delivery");
      expect(instance.label).toBe("Acme Corp");
      expect(instance.status).toBe("active");
      expect(instance.stages).toEqual([
        { id: "pre-sales", label: "Pre-Sales" },
        { id: "validation", label: "Validation" },
      ]);
      expect(instance.skills).toEqual([
        { id: "sales-ops", label: "Sales Ops", owners: ["Hans / Dave"] },
        { id: "pm", label: "PM", owners: ["Andres"] },
      ]);
      expect(instance.tasks).toHaveLength(2);
      expect(instance.events).toEqual([]);

      const [first, second] = instance.tasks;
      expect(first).toMatchObject({
        instanceId: instance.id,
        skillId: "sales-ops",
        stageId: "pre-sales",
        notes: "",
        status: "not_started",
        substatus: "",
        checkpoint: false,
        playbookId: "presales-qualification",
      });
      expect(first.inputs).toEqual([]);
      expect(second.inputs).toEqual([
        {
          id: "in-1",
          name: "After PD",
          linkMode: "linked",
          upstreamTaskRef: "presales-qualification",
          upstreamOutputId: null,
        },
      ]);
      expect(second.checkpoint).toBe(true);
      expect(second.playbookId).toBe("pdr-review");

      // Tasks were persisted to the store
      expect(store.workflow_tasks).toHaveLength(2);
    });

    it("creates an instance with no tasks when the template is empty", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const instance = await repo.createInstance("product-dev", "Dashboard MVP");

      expect(instance.templateId).toBe("product-dev");
      expect(instance.tasks).toEqual([]);
      expect(store.workflow_tasks).toHaveLength(0);
    });

    it("rejects unknown template ids", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      await expect(repo.createInstance("nope", "X")).rejects.toThrow(
        /unknown template_id/i,
      );
    });

    it("snapshots stages and skills so later template edits do not mutate the instance", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const instance = await repo.createInstance("client-delivery", "Acme Corp");

      // Mutate the parent template after the instance was created.
      await repo.updateTemplate("client-delivery", {
        stages: [{ id: "delivery", label: "Delivery" }],
        skills: [{ id: "project", label: "Project Mgmt", owners: ["Patrick"] }],
      });

      const reloaded = await repo.getInstance(instance.id);
      expect(reloaded?.stages).toEqual([
        { id: "pre-sales", label: "Pre-Sales" },
        { id: "validation", label: "Validation" },
      ]);
      expect(reloaded?.skills).toEqual([
        { id: "sales-ops", label: "Sales Ops", owners: ["Hans / Dave"] },
        { id: "pm", label: "PM", owners: ["Andres"] },
      ]);
      // Tasks tied to the (now removed from template) stages are still
      // present and reachable so the operator can manage them.
      expect(reloaded?.tasks.map((t) => t.stageId).sort()).toEqual([
        "pre-sales",
        "validation",
      ]);
    });
  });

  describe("updateTask", () => {
    it("patches mutable fields and returns the updated row", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const targetTaskId = instance.tasks[0].id;

      const updated = await repo.updateTask(targetTaskId, {
        status: "in_progress",
        substatus: "Agent began work",
        notes: "Started",
      });

      expect(updated.id).toBe(targetTaskId);
      expect(updated.status).toBe("in_progress");
      expect(updated.substatus).toBe("Agent began work");
      expect(updated.notes).toBe("Started");

      // Untouched fields preserved
      expect(updated.playbookId).toBe("presales-qualification");
      expect(updated.skillId).toBe("sales-ops");
    });

    it("throws when called with an empty patch (programmer error)", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      await expect(repo.updateTask("any-id", {})).rejects.toThrow(/empty patch/i);
    });
  });

  describe("updateTemplate", () => {
    it("updates template label, color, stages, roles, and task templates", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const updated = await repo.updateTemplate("client-delivery", {
        label: "Client Delivery v2",
        color: "#14b8a6",
        stages: [
          { id: "pre-sales", label: "Pre-Sales", sub: "Qualification" },
          { id: "delivery", label: "Delivery", sub: "Execution" },
        ],
        skills: [
          { id: "sales-ops", label: "Sales Ops", owners: ["Hans / Dave"] },
          { id: "project", label: "Project Mgmt", owners: ["Patrick"] },
        ],
        taskTemplates: [
          {
            id: "tt-1",
            skillId: "sales-ops",
            stageId: "pre-sales",
            playbookId: "presales-qualification",
            notes: "Fresh intake",
          },
        ],
      });

      expect(updated.label).toBe("Client Delivery v2");
      expect(updated.color).toBe("#14b8a6");
      expect(updated.stages[1]).toMatchObject({
        id: "delivery",
        label: "Delivery",
        sub: "Execution",
      });
      expect(updated.skills[1]).toMatchObject({
        id: "project",
        owners: ["Patrick"],
      });
      expect(updated.taskTemplates[0]).toMatchObject({
        id: "tt-1",
        playbookId: "presales-qualification",
        stageId: "pre-sales",
      });
    });

    it("round-trips inputs[].upstreamOutputId through update + createInstance", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      await repo.updateTemplate("client-delivery", {
        taskTemplates: [
          {
            id: "tt-a",
            skillId: "sales-ops",
            stageId: "pre-sales",
            playbookId: "presales-qualification",
            notes: "",
            inputs: [],
          },
          {
            id: "tt-b",
            skillId: "pm",
            stageId: "validation",
            playbookId: "pdr-review",
            notes: "",
            checkpoint: true,
            inputs: [
              {
                id: "in-1",
                name: "After PD",
                linkMode: "linked",
                upstreamTaskRef: "tt-a",
                upstreamOutputId: "po-1",
              },
            ],
          },
        ],
      });

      const instance = await repo.createInstance("client-delivery", "Acme");
      const downstream = instance.tasks.find((t) => t.skillId === "pm");
      expect(downstream?.inputs).toEqual([
        {
          id: "in-1",
          name: "After PD",
          linkMode: "linked",
          upstreamTaskRef: "tt-a",
          upstreamOutputId: "po-1",
        },
      ]);
    });

    it("throws when updateTemplate receives an empty patch", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      await expect(repo.updateTemplate("client-delivery", {})).rejects.toThrow(
        /empty patch/i,
      );
    });
  });

  describe("getTask", () => {
    it("returns a single task mapped to camelCase shape", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const checkpoint = instance.tasks.find((t) => t.checkpoint)!;

      const fetched = await repo.getTask(checkpoint.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(checkpoint.id);
      expect(fetched!.checkpoint).toBe(true);
      expect(fetched!.playbookId).toBe("pdr-review");
      expect(fetched!.instanceId).toBe(instance.id);
    });

    it("returns null when the task id is unknown (RLS-hidden or missing)", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const fetched = await repo.getTask("does-not-exist");

      expect(fetched).toBeNull();
    });

    it("forward-maps legacy trigger-shaped JSONB to linked inputs on read", async () => {
      // PR 2 / AEL-60 renamed the column to `inputs` and PR 1's runtime
      // wrote canonical WorkflowInput JSONB. Defensively, rows authored
      // before PR 1 may still carry the legacy trigger shape — the
      // normalizeInputs shim maps them forward. Only `task` / `after_task`
      // map to a `linked` input; everything else is dropped.
      store.workflow_tasks.push({
        id: "legacy-task",
        instance_id: "inst-x",
        skill_id: "pm",
        stage_id: "validation",
        notes: "",
        status: "not_started",
        substatus: "",
        checkpoint: false,
        inputs: [
          { type: "manual", label: "Manual start" },
          { type: "event", eventName: "external.signal" },
          { type: "schedule", label: "Cron" },
          { type: "webhook", label: "Hook" },
          { type: "after_task", taskRef: "presales-qualification", label: "After PD" },
        ],
        playbook_id: "pdr-review",
        owners: [],
        paused_reason: null,
        paused_by: null,
        paused_at: null,
        created_at: "2026-04-19T12:00:00Z",
        updated_at: "2026-04-19T12:00:00Z",
      });

      const repo = createWorkflowRepository(makeFakeClient(store));
      const fetched = await repo.getTask("legacy-task");

      expect(fetched).not.toBeNull();
      expect(fetched!.inputs).toEqual([
        {
          id: "linked:presales-qualification",
          name: "After PD",
          linkMode: "linked",
          upstreamTaskRef: "presales-qualification",
          upstreamOutputId: null,
        },
      ]);
    });
  });

  describe("transitionPendingCheckpoint", () => {
    it("resumes a paused checkpoint task to the requested status atomically", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const checkpoint = instance.tasks.find((t) => t.checkpoint)!;

      // PR 2 routes checkpoint approval through pause/resume semantics —
      // the predicate now requires status='paused' AND paused_reason='checkpoint'.
      await repo.pauseTask(checkpoint.id, "checkpoint");

      const transitioned = await repo.transitionPendingCheckpoint(
        checkpoint.id,
        "in_progress",
      );

      expect(transitioned).not.toBeNull();
      expect(transitioned!.id).toBe(checkpoint.id);
      expect(transitioned!.status).toBe("in_progress");
      expect(transitioned!.checkpoint).toBe(true);

      const refetched = await repo.getTask(checkpoint.id);
      expect(refetched!.status).toBe("in_progress");
      expect(refetched!.pausedReason).toBeNull();
    });

    it("returns null when the task is not a checkpoint (UPDATE matches no row, no write)", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const nonCheckpoint = instance.tasks.find((t) => !t.checkpoint)!;

      await repo.pauseTask(nonCheckpoint.id, "checkpoint");

      const transitioned = await repo.transitionPendingCheckpoint(
        nonCheckpoint.id,
        "in_progress",
      );

      expect(transitioned).toBeNull();
      const refetched = await repo.getTask(nonCheckpoint.id);
      expect(refetched!.status).toBe("paused");
    });

    it("returns null when the task is not paused on a checkpoint reason", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const checkpoint = instance.tasks.find((t) => t.checkpoint)!;

      // Checkpoint exists but is still `not_started` — predicate fails.
      const transitioned = await repo.transitionPendingCheckpoint(
        checkpoint.id,
        "in_progress",
      );

      expect(transitioned).toBeNull();
      const refetched = await repo.getTask(checkpoint.id);
      expect(refetched!.status).toBe("not_started");
    });

    it("returns null when the task id is unknown", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const transitioned = await repo.transitionPendingCheckpoint(
        "does-not-exist",
        "in_progress",
      );

      expect(transitioned).toBeNull();
    });
  });

  describe("createTask + updateTaskIfStatus", () => {
    it("creates instance tasks with an explicit not_started state", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");

      const created = await repo.createTask({
        instanceId: instance.id,
        skillId: "sales-ops",
        stageId: "pre-sales",
        playbookId: null,
        notes: "",
      });

      expect(created.status).toBe("not_started");
      expect(created.substatus).toBe("");
    });

    it("updates a task only when the expected status still matches", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const target = instance.tasks[0]!;

      const transitioned = await repo.updateTaskIfStatus(target.id, "not_started", {
        status: "in_progress",
      });

      expect(transitioned).not.toBeNull();
      expect(transitioned!.status).toBe("in_progress");
      expect((await repo.getTask(target.id))!.status).toBe("in_progress");
    });

    it("returns null when updateTaskIfStatus sees a stale current status", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const target = instance.tasks[0]!;

      const transitioned = await repo.updateTaskIfStatus(target.id, "in_progress", {
        status: "failed",
      });

      expect(transitioned).toBeNull();
      expect((await repo.getTask(target.id))!.status).toBe("not_started");
    });
  });

  describe("addEvent + getInstance", () => {
    it("appends an event and surfaces it via getInstance", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const taskId = instance.tasks[0].id;

      const event = await repo.addEvent(taskId, {
        name: "task.started",
        description: "Sales Ops Agent began qualification",
        payload: { agent: "Sales Ops" },
      });

      expect(event.taskId).toBe(taskId);
      expect(event.instanceId).toBe(instance.id);
      expect(event.payload).toEqual({ agent: "Sales Ops" });

      const detail = await repo.getInstance(instance.id);
      expect(detail).not.toBeNull();
      expect(detail!.events).toHaveLength(1);
      expect(detail!.events[0].name).toBe("task.started");
    });
  });

  describe("framework items", () => {
    it("listFrameworkItems filters by type", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const skills = await repo.getFrameworkItems("skill");
      const playbooks = await repo.getFrameworkItems("playbook");

      expect(skills).toHaveLength(1);
      expect(skills[0].id).toBe("sk-pm");
      expect(playbooks).toHaveLength(1);
      expect(playbooks[0].id).toBe("pb-presales");
    });

    it("upsertFrameworkItem replaces existing rows", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const updated = await repo.upsertFrameworkItem({
        id: "sk-pm",
        type: "skill",
        name: "PM",
        description: "Updated description",
        icon: "📋",
        content: "# Updated PM Skill",
      });

      expect(updated.description).toBe("Updated description");
      expect(updated.content).toBe("# Updated PM Skill");
      expect(store.framework_items).toHaveLength(2);
    });

    it("deleteFrameworkItem removes the row", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      await repo.deleteFrameworkItem("sk-pm");

      expect(store.framework_items).toHaveLength(1);
      expect(store.framework_items[0]?.id).toBe("pb-presales");
    });
  });

  // The in-memory fake doesn't enforce the (playbook_id, name) UNIQUE
  // constraint. We cover the friendly-error path for unique-name conflicts
  // in the playbook-outputs-editor component test instead.
  describe("playbook outputs", () => {
    beforeEach(() => {
      store.playbook_outputs = [
        {
          id: "po-1",
          playbook_id: "pb-presales",
          name: "report",
          description: "Initial report",
          kind: "file",
          api_check: null,
          position: 0,
          created_at: "2026-04-19T12:00:00Z",
        },
        {
          id: "po-2",
          playbook_id: "pb-presales",
          name: "deck",
          description: null,
          kind: "media",
          api_check: null,
          position: 1,
          created_at: "2026-04-19T12:00:00Z",
        },
      ];
      store.task_outputs = [
        {
          id: "to-1",
          task_id: "task-a",
          output_id: "po-1",
          status: "produced",
          artifact_url: null,
          artifact_meta: null,
          produced_by: null,
          produced_at: null,
          created_at: "2026-04-19T12:00:00Z",
        },
        {
          id: "to-2",
          task_id: "task-b",
          output_id: "po-1",
          status: "pending",
          artifact_url: null,
          artifact_meta: null,
          produced_by: null,
          produced_at: null,
          created_at: "2026-04-19T12:00:00Z",
        },
      ];
    });

    describe("listOutputsForTemplate", () => {
      it("returns outputs grouped per attached playbook, sorted by playbook name", async () => {
        store.workflow_templates.push({
          id: "tpl-wired",
          label: "Wired Template",
          color: "#fff",
          multi_instance: false,
          stages: [],
          skills: [],
          task_templates: [
            {
              id: "t1",
              skillId: "sk-pm",
              stageId: "s1",
              playbookId: "pb-presales",
              notes: "",
              inputs: [],
            },
            {
              id: "t2",
              skillId: "sk-pm",
              stageId: "s2",
              playbookId: "pb-empty",
              notes: "",
              inputs: [],
            },
          ],
          created_at: "2026-04-19T12:00:00Z",
          updated_at: "2026-04-19T12:00:00Z",
        });
        store.framework_items.push({
          id: "pb-empty",
          type: "playbook",
          name: "ada-onboard",
          description: "",
          icon: null,
          color: null,
          content: "",
          created_at: "2026-04-19T12:00:00Z",
          updated_at: "2026-04-19T12:00:00Z",
        });

        const repo = createWorkflowRepository(makeFakeClient(store));
        const groups = await repo.listOutputsForTemplate("tpl-wired");

        expect(groups.map((g) => g.playbookName)).toEqual([
          "ada-onboard",
          "presales-qualification",
        ]);
        const presales = groups.find((g) => g.playbookId === "pb-presales");
        expect(presales?.outputs.map((o) => o.name)).toEqual(["report", "deck"]);
        const empty = groups.find((g) => g.playbookId === "pb-empty");
        expect(empty?.outputs).toEqual([]);
      });

      it("returns an empty list when the template has no playbooks attached", async () => {
        store.workflow_templates.push({
          id: "tpl-bare",
          label: "Bare",
          color: "#fff",
          multi_instance: false,
          stages: [],
          skills: [],
          task_templates: [{ id: "t1", skillId: "sk-pm", stageId: "s1", playbookId: null, notes: "", inputs: [] }],
          created_at: "2026-04-19T12:00:00Z",
          updated_at: "2026-04-19T12:00:00Z",
        });
        const repo = createWorkflowRepository(makeFakeClient(store));
        const groups = await repo.listOutputsForTemplate("tpl-bare");
        expect(groups).toEqual([]);
      });

      it("returns an empty list when the template id is unknown", async () => {
        const repo = createWorkflowRepository(makeFakeClient(store));
        const groups = await repo.listOutputsForTemplate("nope");
        expect(groups).toEqual([]);
      });
    });

    it("listPlaybookOutputs returns rows for the playbook ordered by position", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const outputs = await repo.listPlaybookOutputs("pb-presales");
      expect(outputs.map((o) => o.name)).toEqual(["report", "deck"]);
      expect(outputs[0].position).toBe(0);
      expect(outputs[1].position).toBe(1);
    });

    it("createPlaybookOutput auto-positions to (max + 1) when omitted", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const created = await repo.createPlaybookOutput({
        playbookId: "pb-presales",
        name: "summary",
        kind: "manual",
      });
      expect(created.position).toBe(2);
      expect(created.kind).toBe("manual");
      expect(created.description).toBeNull();
      expect(store.playbook_outputs).toHaveLength(3);
    });

    it("createPlaybookOutput on a playbook with no outputs starts at position 0", async () => {
      store.playbook_outputs = [];
      const repo = createWorkflowRepository(makeFakeClient(store));
      const created = await repo.createPlaybookOutput({
        playbookId: "pb-presales",
        name: "first",
        kind: "file",
      });
      expect(created.position).toBe(0);
    });

    it("updatePlaybookOutput patches only provided fields", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const updated = await repo.updatePlaybookOutput("po-1", {
        name: "report-v2",
        kind: "link",
      });
      expect(updated.name).toBe("report-v2");
      expect(updated.kind).toBe("link");
      expect(updated.description).toBe("Initial report");
    });

    it("updatePlaybookOutput rejects empty patches", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      await expect(repo.updatePlaybookOutput("po-1", {})).rejects.toThrow(/empty patch/);
    });

    it("deletePlaybookOutput removes the row", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      await repo.deletePlaybookOutput("po-2");
      expect(store.playbook_outputs.map((r) => r.id)).toEqual(["po-1"]);
    });

    it("reorderPlaybookOutputs writes positions in declaration order", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      await repo.reorderPlaybookOutputs("pb-presales", ["po-2", "po-1"]);
      const reread = await repo.listPlaybookOutputs("pb-presales");
      expect(reread.map((o) => o.id)).toEqual(["po-2", "po-1"]);
      expect(reread[0].position).toBe(0);
      expect(reread[1].position).toBe(1);
    });

    it("reorderPlaybookOutputs tolerates ids that no longer exist", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      await repo.reorderPlaybookOutputs("pb-presales", ["po-2", "po-deleted", "po-1"]);
      const reread = await repo.listPlaybookOutputs("pb-presales");
      expect(reread.map((o) => o.id)).toEqual(["po-2", "po-1"]);
      // No phantom row was inserted.
      expect(store.playbook_outputs).toHaveLength(2);
    });

    it("countTaskOutputsForPlaybookOutput returns the matching count", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      expect(await repo.countTaskOutputsForPlaybookOutput("po-1")).toBe(2);
      expect(await repo.countTaskOutputsForPlaybookOutput("po-2")).toBe(0);
    });
  });
});
