import { StandardInfoPage } from "@/components/standard-page";
import { staticPages } from "@/lib/data/static-pages";

export default function HelpPage() {
  return <StandardInfoPage {...staticPages.help} />;
}
