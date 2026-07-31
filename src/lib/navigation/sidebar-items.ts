import type { LucideIcon } from "lucide-react";

import {
  canAccessFeature,
  featureGroups,
  featureRegistry,
  type FeatureDefinition,
  type FeatureGroupId,
} from "@/lib/navigation/feature-registry";
import { isNavigationItemActive } from "@/lib/navigation/navigation-state";

export type SidebarGroup = FeatureGroupId;

export type SidebarItem = {
  activePaths?: readonly string[];
  exact?: boolean;
  group: SidebarGroup;
  href: string;
  icon: LucideIcon;
  label: string;
  requiredRoles?: readonly string[];
};

export const sidebarItems: SidebarItem[] = (
  featureRegistry as readonly FeatureDefinition[]
)
  .filter((feature) => feature.showInSidebar)
  .map((feature) => ({
    activePaths: feature.activePaths,
    exact: feature.exact,
    group: feature.group,
    href: feature.href,
    icon: feature.icon,
    label: feature.label,
    requiredRoles: feature.requiredRoles,
  }));

export const sidebarGroups: Array<{ key: SidebarGroup; label: string }> =
  featureGroups.map((group) => ({ key: group.id, label: group.label }));

export function canShowSidebarItem(
  item: SidebarItem,
  userRoles: readonly string[] = [],
) {
  return canAccessFeature(item, userRoles);
}

export function isSidebarItemActive(pathname: string, item: SidebarItem) {
  return isNavigationItemActive(pathname, item.href, {
    aliases: item.activePaths,
    exact: item.exact,
  });
}
