// components/SitesTab.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Globe, Plus, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { siteData, unviewedType } from "@/lib/types";

interface SitesTabProps {
  sites: siteData[] | undefined;
  selectedSite: siteData | undefined;
  sitesLoading: boolean;
  allUnvieweds: unviewedType[];
  selectedDbUnviewed: unviewedType | undefined;
  onAddNew: () => void;
  onSelectSite: (site: siteData) => void;
}

export function SitesTab({
  sites,
  selectedSite,
  allUnvieweds,
  sitesLoading,
  selectedDbUnviewed,
  onAddNew,
  onSelectSite,
}: SitesTabProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="border-border/50 bg-card/50 hover:bg-card min-w-[180px] justify-between gap-2 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2">
            <Globe className="text-primary h-4 w-4" />
            <span className="max-w-[120px] truncate">
              {selectedSite?.site}
              {sitesLoading ? (
                <Loader2 className="text-primary h-6 w-6 animate-spin" />
              ) : (
                "Select a site"
              )}
            </span>
            {selectedDbUnviewed?.unvieweds && (
              <Badge
                variant="default"
                className="bg-primary h-5 min-w-[20px] justify-center px-1.5 text-[10px]"
              >
                {selectedDbUnviewed.unvieweds}
              </Badge>
            )}
          </div>
          <ChevronDown
            className={`text-muted-foreground h-4 w-4 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="border-border/50 bg-card/95 w-[220px] backdrop-blur-sm"
      >
        <AnimatePresence>
          {sites?.map((site, index) => {
            const thisSite = allUnvieweds.find((u) => u.site == site.site);

            return (
              <motion.div
                key={site.site}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <DropdownMenuItem
                  className={`flex cursor-pointer items-center justify-between gap-2 ${
                    site.site == selectedSite?.site ? "bg-primary/10" : ""
                  }`}
                  onClick={() => {
                    site.site != selectedSite?.site && onSelectSite(site);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="text-muted-foreground h-3.5 w-3.5" />
                    <span className="max-w-[120px] truncate text-sm">
                      {/* replace _ with . */}
                      {site.site}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {thisSite?.unvieweds! > 0 && (
                      <Badge
                        variant="secondary"
                        className="h-5 min-w-[20px] justify-center px-1.5 text-[10px]"
                      >
                        {thisSite?.unvieweds}
                      </Badge>
                    )}
                    <a
                      href={`https://${site.site.replaceAll("_", ".")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-primary"
                      aria-label={`Open ${site.site} in new tab`}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </DropdownMenuItem>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!sites?.length && (
          <div className="text-muted-foreground px-2 py-4 text-center text-sm">
            No sites configured
          </div>
        )}

        <DropdownMenuSeparator className="bg-border/50" />

        <DropdownMenuItem
          className="text-primary flex cursor-pointer items-center gap-2"
          onClick={() => {
            onAddNew?.();
            setIsOpen(false);
          }}
        >
          <Plus className="h-4 w-4" />
          <span>Add new site</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
