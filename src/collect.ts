import { Readable as NodeReadable, Writable as NodeWritable } from 'stream';
import { spawn } from 'child_process';
import { setTimeout } from "timers/promises";
import * as z from "zod";

import type { ItemRecord } from './types';

const SearchQueryResult = z.object({
  "total_count": z.number(),
  "incomplete_results": z.boolean(),
});

const RateLimitResult = z.object({
  "resources": z.object({
    "search": z.object({
      "reset": z.number(),
    }),
  }),
});

const Readable = NodeReadable as typeof NodeReadable & {
  toWeb(readable: NodeReadable): ReadableStream<Uint8Array>,
};

const Writable = NodeWritable as typeof NodeWritable & {
  toWeb(writable: NodeWritable): WritableStream<Uint8Array>,
}

const SearchCodeFailed = new Error("search/code failed.");
const IncompleteResults = new Error("incomplete results.");

async function count(fragment: string): Promise<number> {
  const [ command, ...args ] = ["gh", "api", "-X", "GET", "search/code", "-f", `q=${fragment}`, "-f", "per_page=1"];
  const proc = spawn(command, args, {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const buf = [] as string[];
  await Readable.toWeb(proc.stdout).pipeThrough(new TextDecoderStream()).pipeTo(new WritableStream({
    write(chunk) {
      buf.push(chunk);
    },
  }));

  await new Promise<void>((resolve) => {
    if (typeof proc.exitCode === "number") {
      return resolve();
    }
    proc.once("exit", resolve);
  });

  switch (proc.exitCode) {
    case 0:
      break;

    case 1:
      throw SearchCodeFailed;

    default:
      throw new Error(`exit code: ${proc.exitCode}`);
  }

  const data = SearchQueryResult.parse(JSON.parse(buf.join("")));
  if (data.incomplete_results) {
    throw IncompleteResults;
  }
  return data.total_count;
}

async function wait(): Promise<void> {
  const [ command, ...args ] = ["gh", "api", "-X", "GET", "rate_limit"];
  const proc = spawn(command, args, {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const buf = [] as string[];
  await Readable.toWeb(proc.stdout).pipeThrough(new TextDecoderStream()).pipeTo(new WritableStream({
    write(chunk) {
      buf.push(chunk);
    },
  }));

  await new Promise<void>((resolve) => {
    if (typeof proc.exitCode === "number") {
      return resolve();
    }
    proc.once("exit", resolve);
  });

  switch (proc.exitCode) {
    case 0:
      break;

    default:
      throw new Error(`exit code: ${proc.exitCode}`);
  }

  const data = RateLimitResult.parse(JSON.parse(buf.join("")));
  await setTimeout((data.resources.search.reset * 1000) - new Date().getTime());
}

async function tryCount(fragment: string): Promise<number> {
  for (let _ of Array.from({ length: 8 })) {
    try {
      return await count(fragment);
    } catch (e) {
      if (e !== SearchCodeFailed && e !== IncompleteResults) {
        throw e;
      }
    }
    await wait();
  }
  throw new Error();
}

async function write(dest: WritableStreamDefaultWriter<string>, item: ItemRecord): Promise<void> {
  await dest.ready;
  await dest.write(JSON.stringify(item) + "\n");
}

const encoder = new TextEncoderStream();
encoder.readable.pipeTo(Writable.toWeb(process.stdout));
const stdout = encoder.writable.getWriter();

const now = new Date().toISOString();
const fragments = ['💩', '\\u{1f4a9}'];
for (const fragment of fragments) {
  const val = await tryCount(fragment);
  const record: ItemRecord = {
    version: "v1",
    fragment,
    val,
    timestamp: now,
  };
  await write(stdout, record);
}
await stdout.close();
