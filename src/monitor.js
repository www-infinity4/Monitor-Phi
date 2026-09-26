export class Monitor {
  constructor({ programs = [], logger = console } = {}) {
    this.logger = logger;
    this.programs = new Map();
    for (const program of programs) this.register(program);
  }

  register(program) {
    if (!program?.name || typeof program.handle !== "function") {
      throw new TypeError("Monitor programs require a name and handle(request, context)");
    }
    this.programs.set(program.name, program);
    return this;
  }

  list() {
    return [...this.programs.values()].map(({ name, version = "0.1.0", description = "" }) => ({
      name, version, description
    }));
  }

  async health(context = {}) {
    const programs = {};
    for (const program of this.programs.values()) {
      try {
        programs[program.name] = program.health
          ? await program.health(context)
          : { ok: true };
      } catch (error) {
        programs[program.name] = { ok: false, error: String(error?.message || error) };
      }
    }
    return { ok: Object.values(programs).every(x => x.ok !== false), programs };
  }

  async fetch(request, context = {}) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json(await this.health(context));
    }
    if (url.pathname === "/programs") {
      return json({ programs: this.list() });
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "p" || !parts[1]) {
      return json({ error: "route_not_found", hint: "/p/:program/*" }, 404);
    }

    const program = this.programs.get(parts[1]);
    if (!program) return json({ error: "program_not_found", program: parts[1] }, 404);

    const started = Date.now();
    try {
      const response = await program.handle(request, {
        ...context,
        monitor: this,
        route: "/" + parts.slice(2).join("/"),
        program: program.name
      });
      this.logger?.info?.("monitor.request", {
        program: program.name, path: url.pathname, status: response.status,
        durationMs: Date.now() - started
      });
      return response;
    } catch (error) {
      this.logger?.error?.("monitor.program_error", {
        program: program.name, path: url.pathname, error: String(error?.message || error)
      });
      return json({ error: "program_error", program: program.name }, 500);
    }
  }
}

export function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}
