import fs from "node:fs";
import path from "node:path";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

const graphqlDirectory = path.join(process.cwd(), "app", "graphql");

const operationsCache = new Map<string, string>();

function loadOperation(filename: string): string {
  const safeFilename = path.basename(filename);
  const cached = operationsCache.get(safeFilename);
  if (cached) {
    return cached;
  }
  const fullPath = path.join(graphqlDirectory, safeFilename);
  const contents = fs.readFileSync(fullPath, "utf8");
  operationsCache.set(safeFilename, contents);
  return contents;
}

type GraphQLResult<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

/**
 * Runs a GraphQL mutation/query from a .graphql file against the admin API
 * using the provided admin context. Reads the operation from disk so the
 * queries are colocated and reviewable.
 */
export async function graphqlRequest<T>(
  admin: AdminApiContext["graphql"],
  filename: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const operation = loadOperation(filename);
  const response = await admin(operation, { variables });

  const body = (await response.json()) as GraphQLResult<T>;

  if (body.errors && body.errors.length > 0) {
    throw new Error(`GraphQL request ${filename} failed: ${body.errors.map((e) => e.message).join("; ")}`);
  }

  if (!body.data) {
    throw new Error(`GraphQL request ${filename} returned no data.`);
  }

  return body.data;
}
