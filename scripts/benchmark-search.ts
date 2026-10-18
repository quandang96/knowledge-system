import { promises as fs } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import os from "node:os";
import { createServer } from "../apps/api/src/server";
import { metadataSchema } from "../packages/schemas/src/index";
import { serialize } from "../apps/api/src/services/markdown";
import { atomicWrite } from "../apps/api/src/services/filesystem";

const counts = process.argv.slice(2).length
  ? process.argv.slice(2).map(Number)
  : [100, 1000, 5000];
if (counts.some((n) => !Number.isInteger(n) || n < 1 || n > 10000))
  throw new Error("Provide corpus sizes from 1 to 10000.");
const base = path.resolve(".cache/benchmarks");
await fs.mkdir(base, { recursive: true });
const results = [];
for (const count of counts) {
  const root = await fs.mkdtemp(path.join(base, "search-"));
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    const source = path.join(root, "staging/release-benchmark/published");
    for (let index = 1; index <= count; index++) {
      const metadata = metadataSchema.parse({
        doc_id: `REF-BENCH-${String(index).padStart(5, "0")}`,
        type: "reference",
        project_id: "benchmark",
        module: "billing",
        title: `Quy trình phê duyệt thanh toán ${index}`,
        summary: "Điều kiện thanh toán và kiểm tra dữ liệu.",
        owner: "Benchmark",
        status: "published",
      });
      const folder = path.join(source, "references/billing", metadata.doc_id);
      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(
        path.join(folder, "index.md"),
        serialize(
          metadata,
          `# ${metadata.title}\n\n## Nội dung\n\n${"Quy tắc phê duyệt, kiểm tra hạn mức và đối chiếu hóa đơn. ".repeat(30)}\n`,
        ),
      );
    }
    await atomicWrite(
      path.join(root, ".knowledge-state/active.json"),
      JSON.stringify({ release: "release-benchmark", revision: "benchmark" }),
    );
    // Separate fixture root, no real build or changes to the user's knowledge.
    server = await createServer({
      root,
      auth: {
        mode: "local",
        passwords: { reader: { password: "benchmark", role: "Reader" } },
      },
    });
    const login = await server.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "reader", password: "benchmark" },
    });
    const cookie = String(login.headers["set-cookie"]).split(";")[0];
    const samples = [];
    for (let i = 0; i < 30; i++) {
      const started = performance.now();
      const response = await server.app.inject({
        url: "/api/catalog?project_id=benchmark&q=phe%20duyet&page_size=25",
        headers: { cookie },
      });
      if (response.statusCode !== 200) throw new Error(response.body);
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    const row = {
      documents: count,
      samples: samples.length,
      warm_p50_ms: Number(samples[Math.floor(samples.length * 0.5)].toFixed(2)),
      warm_p95_ms: Number(
        samples[Math.floor(samples.length * 0.95)].toFixed(2),
      ),
    };
    results.push(row);
    console.log(JSON.stringify(row));
  } finally {
    await server?.app.close();
    if (path.resolve(root).startsWith(base + path.sep))
      await fs.rm(root, { recursive: true, force: true });
  }
}
const report = {
  measured_at: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    cpu: os.cpus()[0]?.model,
    logical_cpus: os.cpus().length,
    memory_gb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
  },
  scope:
    "Local Fastify inject, warm immutable release cache, synthetic Markdown (~2 KB/document), no network/browser latency. Not a production capacity claim.",
  results,
};
await fs.writeFile(
  path.join(base, "latest.json"),
  JSON.stringify(report, null, 2),
);
