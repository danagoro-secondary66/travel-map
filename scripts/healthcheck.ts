const { existsSync, readFileSync } = require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");
type CheckResult = {
  name: string;
  passed: boolean;
  detail: string;
};

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const file = readFileSync(envPath, "utf8");

  for (const rawLine of file.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function printResult(result: CheckResult) {
  const status = result.passed ? "PASS" : "FAIL";
  console.log(`[${status}] ${result.name} - ${result.detail}`);
}

async function checkEnvironmentVariables(): Promise<CheckResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const gemini = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();

  const missing: string[] = [];

  if (!url) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!anonKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const geminiStatus = gemini ? "Gemini: configured" : "Gemini: not configured yet";

  if (missing.length > 0) {
    return {
      name: "Environment variables",
      passed: false,
      detail: `Missing ${missing.join(", ")}. ${geminiStatus}`,
    };
  }

  return {
    name: "Environment variables",
    passed: true,
    detail: `Supabase env vars found. ${geminiStatus}`,
  };
}

function getSupabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

async function querySupabaseTable(table: string) {
  const credentials = getSupabaseCredentials();

  if (!credentials) {
    return {
      error: "Missing Supabase environment variables.",
      ok: false,
    } as const;
  }

  const url = new URL(`/rest/v1/${table}`, credentials.url);
  url.searchParams.set("select", "*");
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        apikey: credentials.anonKey,
        Authorization: `Bearer ${credentials.anonKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        error: `${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`,
        ok: false,
      } as const;
    }

    return {
      ok: true,
    } as const;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      ok: false,
    } as const;
  }
}

async function checkSupabasePlaces(): Promise<CheckResult> {
  const result = await querySupabaseTable("places");

  if (!result.ok) {
    return {
      name: "Supabase connection",
      passed: false,
      detail: result.error,
    };
  }

  return {
    name: "Supabase connection",
    passed: true,
    detail: "Fetched from places table successfully.",
  };
}

async function checkSupabaseCollections(): Promise<CheckResult> {
  const result = await querySupabaseTable("collections");

  if (!result.ok) {
    return {
      name: "Supabase collections",
      passed: false,
      detail: result.error,
    };
  }

  return {
    name: "Supabase collections",
    passed: true,
    detail: "Fetched from collections table successfully.",
  };
}

async function checkNominatim(): Promise<CheckResult> {
  try {
    const response = await fetch(
      "https://nominatim.openstreetmap.org/search?q=tel+aviv&format=json&limit=1",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "travel-map-healthcheck/1.0",
        },
      },
    );

    if (!response.ok) {
      return {
        name: "Nominatim API",
        passed: false,
        detail: `HTTP ${response.status}`,
      };
    }

    const results = (await response.json()) as unknown[];

    if (!Array.isArray(results) || results.length === 0) {
      return {
        name: "Nominatim API",
        passed: false,
        detail: "No results returned for test query.",
      };
    }

    return {
      name: "Nominatim API",
      passed: true,
      detail: "Returned at least one result for Tel Aviv.",
    };
  } catch (error) {
    return {
      name: "Nominatim API",
      passed: false,
      detail: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function main() {
  loadDotEnvLocal();

  const checks = await Promise.all([
    checkEnvironmentVariables(),
    checkSupabasePlaces(),
    checkSupabaseCollections(),
    checkNominatim(),
  ]);

  checks.forEach(printResult);

  const passedCount = checks.filter((check) => check.passed).length;
  console.log(`\n${passedCount}/${checks.length} checks passed.`);

  if (passedCount !== checks.length) {
    process.exitCode = 1;
  }
}

void main();
