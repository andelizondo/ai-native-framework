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
          roles: [
            { id: "sales", label: "Sales", owner: "Hans / Dave" },
            { id: "product", label: "Product", owner: "Andres" },
          ],
          task_templates: [
            {
              role: "sales",
              stage: "pre-sales",
              title: "Project Description",
              desc: "Define objective",
              agent: "Sales Ops",
              skill: "sales-ops",
              playbook: "presales-qualification",
              triggers: [{ type: "manual", label: "Manual start" }],
              gates: [{ type: "playbook_done", label: "Done" }],
            },
            {
              role: "product",
              stage: "validation",
              title: "PDR Review",
              desc: "Evaluate, accept or reject",
              agent: "PM",
              skill: "pm",
              playbook: "pdr-review",
              checkpoint: true,
              triggers: [
                { type: "after_task", taskRef: "Project Description", label: "After PD" },
              ],
              gates: [{ type: "checkpoint", label: "Approve" }],
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
          roles: [],
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
      expect(templates[0].roles).toEqual([
        { id: "sales", label: "Sales", owner: "Hans / Dave" },
        { id: "product", label: "Product", owner: "Andres" },
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
      expect(instance.roles).toEqual([
        { id: "sales", label: "Sales", owner: "Hans / Dave" },
        { id: "product", label: "Product", owner: "Andres" },
      ]);
      expect(instance.tasks).toHaveLength(2);
      expect(instance.events).toEqual([]);

      const [first, second] = instance.tasks;
      expect(first).toMatchObject({
        instanceId: instance.id,
        roleId: "sales",
        stageId: "pre-sales",
        title: "Project Description",
        description: "Define objective",
        status: "not_started",
        substatus: "",
        checkpoint: false,
        agent: "Sales Ops",
        skill: "sales-ops",
        playbook: "presales-qualification",
      });
      expect(first.triggers).toEqual([{ type: "manual", label: "Manual start" }]);
      expect(second.checkpoint).toBe(true);
      expect(second.title).toBe("PDR Review");

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
  });

  describe("updateTask", () => {
    it("patches mutable fields and returns the updated row", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const targetTaskId = instance.tasks[0].id;

      const updated = await repo.updateTask(targetTaskId, {
        status: "active",
        substatus: "Agent began work",
        agent: "New Agent",
      });

      expect(updated.id).toBe(targetTaskId);
      expect(updated.status).toBe("active");
      expect(updated.substatus).toBe("Agent began work");
      expect(updated.agent).toBe("New Agent");

      // Untouched fields preserved
      expect(updated.title).toBe("Project Description");
      expect(updated.roleId).toBe("sales");
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
        roles: [
          { id: "sales", label: "Sales", owner: "Hans / Dave", color: "#6366f1" },
          { id: "project", label: "Project Mgmt", owner: "Patrick", color: "#10b981" },
        ],
        taskTemplates: [
          {
            id: "tt-1",
            role: "sales",
            stage: "pre-sales",
            title: "Updated discovery",
            desc: "Fresh intake",
            agent: "Sales Ops",
            skill: "sales-ops",
            playbook: "presales-qualification",
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
      expect(updated.roles[1]).toMatchObject({
        id: "project",
        owner: "Patrick",
        color: "#10b981",
      });
      expect(updated.taskTemplates[0]).toMatchObject({
        id: "tt-1",
        title: "Updated discovery",
        stage: "pre-sales",
      });
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
      expect(fetched!.title).toBe("PDR Review");
      expect(fetched!.instanceId).toBe(instance.id);
    });

    it("returns null when the task id is unknown (RLS-hidden or missing)", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const fetched = await repo.getTask("does-not-exist");

      expect(fetched).toBeNull();
    });
  });

  describe("transitionPendingCheckpoint", () => {
    it("flips a pending_approval checkpoint task to the requested status atomically", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const checkpoint = instance.tasks.find((t) => t.checkpoint)!;

      // Templates materialize tasks in `not_started`; promote to
      // pending_approval so the conditional UPDATE's predicates match.
      await repo.updateTask(checkpoint.id, { status: "pending_approval" });

      const transitioned = await repo.transitionPendingCheckpoint(
        checkpoint.id,
        "complete",
      );

      expect(transitioned).not.toBeNull();
      expect(transitioned!.id).toBe(checkpoint.id);
      expect(transitioned!.status).toBe("complete");
      expect(transitioned!.checkpoint).toBe(true);

      // Persisted: a re-read sees the new status.
      const refetched = await repo.getTask(checkpoint.id);
      expect(refetched!.status).toBe("complete");
    });

    it("returns null when the task is not a checkpoint (UPDATE matches no row, no write)", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const nonCheckpoint = instance.tasks.find((t) => !t.checkpoint)!;

      // Even after promoting status, the `checkpoint = TRUE` predicate
      // must fail and the UPDATE must not write — the row stays
      // untouched so subsequent flows see truthful state.
      await repo.updateTask(nonCheckpoint.id, { status: "pending_approval" });

      const transitioned = await repo.transitionPendingCheckpoint(
        nonCheckpoint.id,
        "complete",
      );

      expect(transitioned).toBeNull();
      const refetched = await repo.getTask(nonCheckpoint.id);
      expect(refetched!.status).toBe("pending_approval");
    });

    it("returns null when the task is not in pending_approval (UPDATE matches no row, no write)", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const checkpoint = instance.tasks.find((t) => t.checkpoint)!;

      // Checkpoint exists but is still `not_started` from materialization.
      const transitioned = await repo.transitionPendingCheckpoint(
        checkpoint.id,
        "complete",
      );

      expect(transitioned).toBeNull();
      const refetched = await repo.getTask(checkpoint.id);
      expect(refetched!.status).toBe("not_started");
    });

    it("returns null when the task id is unknown", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));

      const transitioned = await repo.transitionPendingCheckpoint(
        "does-not-exist",
        "complete",
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
        roleId: "sales",
        stageId: "pre-sales",
        title: "Follow up",
        description: "",
      });

      expect(created.status).toBe("not_started");
      expect(created.substatus).toBe("");
    });

    it("updates a task only when the expected status still matches", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const target = instance.tasks[0]!;

      const transitioned = await repo.updateTaskIfStatus(target.id, "not_started", {
        status: "active",
      });

      expect(transitioned).not.toBeNull();
      expect(transitioned!.status).toBe("active");
      expect((await repo.getTask(target.id))!.status).toBe("active");
    });

    it("returns null when updateTaskIfStatus sees a stale current status", async () => {
      const repo = createWorkflowRepository(makeFakeClient(store));
      const instance = await repo.createInstance("client-delivery", "Acme Corp");
      const target = instance.tasks[0]!;

      const transitioned = await repo.updateTaskIfStatus(target.id, "active", {
        status: "blocked",
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
});
