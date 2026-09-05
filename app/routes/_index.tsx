import { redirect, type LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const host = url.searchParams.get("host");
  const target = new URL("/app", url.origin);
  if (host) {
    target.searchParams.set("host", host);
  }
  return redirect(target.toString());
};

export default function Index() {
  return null;
}
