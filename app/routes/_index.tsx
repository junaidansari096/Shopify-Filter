import { redirect, type LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const target = new URL("/app", url.origin);
  url.searchParams.forEach((val, key) => {
    target.searchParams.set(key, val);
  });
  return redirect(target.toString());
};

export default function Index() {
  return null;
}
