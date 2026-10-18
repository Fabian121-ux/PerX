import {
  BriefcaseBusiness,
  Handshake,
  MessageSquareText,
  Rocket,
  Wrench,
} from "lucide-react";

/** One set of valid destinations for mobile, desktop and the Create hub. */
export const createOptions = [
  {
    href: "/app/posts/new",
    label: "Share an update",
    description: "Post progress, questions or ideas with your community.",
    icon: MessageSquareText,
    commercial: false,
  },
  {
    href: "/app/opportunities/new?type=FREELANCE_PROJECT",
    label: "Post an opportunity",
    description: "Find people for a project or an open role.",
    icon: BriefcaseBusiness,
    commercial: true,
  },
  {
    href: "/app/opportunities/new?type=SERVICE",
    label: "Offer a service",
    description: "Show what you can help others accomplish.",
    icon: Wrench,
    commercial: true,
  },
  {
    href: "/app/opportunities/new?type=PARTNERSHIP",
    label: "Find a partner",
    description: "Start a collaboration with the right people.",
    icon: Handshake,
    commercial: true,
  },
  {
    href: "/app/opportunities/new?type=STARTUP&category=startups",
    label: "Create a startup listing",
    description: "Introduce a startup to the ecosystem.",
    icon: Rocket,
    commercial: true,
  },
] as const;
