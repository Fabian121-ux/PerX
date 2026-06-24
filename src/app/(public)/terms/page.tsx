import { StandardInfoPage } from "@/components/standard-page";
import { staticPages } from "@/lib/data/static-pages";

export default function TermsPage() {
  return <StandardInfoPage {...staticPages.terms} />;
}
