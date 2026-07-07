import { getPerXDataProvider } from "./provider";

export async function getPublicProfile(username: string) {
  const provider = await getPerXDataProvider();
  return provider.profiles.getPublicProfile(username);
}
