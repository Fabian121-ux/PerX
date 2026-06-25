export type TemporaryImage = {
  alt: string;
  src: string;
};

export const temporaryImages = {
  opportunityDesign: {
    alt: "Designer reviewing a product interface on a laptop",
    src: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
  },
  opportunityEngineering: {
    alt: "Software engineer working on a secure application dashboard",
    src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  },
  opportunityStartup: {
    alt: "Startup collaborators planning a product roadmap",
    src: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  },
  opportunityOperations: {
    alt: "Operations team reviewing business workflows",
    src: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80",
  },
} satisfies Record<string, TemporaryImage>;

const opportunityImageOrder = [
  temporaryImages.opportunityDesign,
  temporaryImages.opportunityEngineering,
  temporaryImages.opportunityStartup,
  temporaryImages.opportunityOperations,
];

export function getTemporaryOpportunityImage(seed: string) {
  const hash = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  return opportunityImageOrder[hash % opportunityImageOrder.length];
}
