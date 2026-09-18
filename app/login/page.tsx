import Auth from "@/components/Auth";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return <Auth initialError={error === "confirm" || error === "auth" ? error : undefined} />;
}
