// components/ShotCard.tsx
"use client";

import React, { RefObject, useEffect } from "react";
import Image from "next/image";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Eye, Download, Copy, Check, Clock, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatDate,
  formatRelativeTime,
  truncateHtml,
} from "@/lib/dateformatter";
import type {
  delShotType,
  handleViewed,
  selectedShot,
  shot,
} from "@/lib/types";
import { useDownloader } from "@/lib/downloader";

interface ShotCardProps {
  site: string;
  shot: shot;
  isOpen?: boolean;
  onOpened: (shot: shot) => void;
  onViewed: ({ id }: handleViewed) => Promise<void>;
  onDelete: ({ ids }: delShotType) => void;
  toggleSelect: ({}: selectedShot) => void;
  swiperId: number;
}

export function ShotCard({
  shot,
  isOpen = false,
  onOpened,
  onViewed,
  site,
  onDelete,
  toggleSelect,
  swiperId,
}: ShotCardProps) {
  const [markingViewed, setMarkingViewed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localViewed, setLocalViewed] = useState(shot.viewed);
  const { download, openInNewTab } = useDownloader();

  const markViewed = useCallback(
    //for manual setting of viewed -- viewed sets onOpened
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (markingViewed || localViewed) return;

      setMarkingViewed(true);
      try {
        onViewed({ id: shot.id });
        setLocalViewed(true);
      } catch (e) {
        console.error("In markViewed:", e);
      } finally {
        setMarkingViewed(false);
      }
    },
    [markingViewed, localViewed],
  );

  //done
  const downloadShot = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); //prevent click from triggering card's onClick
    const { error } = await download({ ...shot.file, date: shot.date });
  }, []);

  //done
  const copyHtml = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(shot.html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (er) {
      console.error("Failed to copy HTML:", er);
      //setError component
    }
  }, []);

  //done
  const openHtmlInNewPage = useCallback(async (e: React.MouseEvent) => {
    //call downloader passing html as text/plain or perhaps there's a type for that
    e.stopPropagation();
    try {
      const file = { fileData: shot.html, fileType: "text/plain" };
      const { error } = await openInNewTab({ ...file, fileName: "" });
      if (error) throw error;
    } catch (e) {
      console.error("Failed to open html in newpage: ", e);
      //setError
    }
  }, []);

  // ctrlClicked: is multiSelect -- will not open shot or mark viewed but set to selectedShots, else does
  const handleClicked = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey) toggleSelect({ id: shot.id, swiperId });
    else {
      toggleSelect({ id: shot.id, swiperId });
      markViewed(e);
      onOpened(shot);
    }
  }, []);

  //getting active shot on delShot not dependent on slides change, cause selectedShots will not trigger slideChange

  //create a select button
  const handleSelectShot = useCallback(() => {
    toggleSelect({ id: shot.id });
  }, []);

  const handleDelete = useCallback(() => {
    onDelete({ ids: shot.id });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      {/* hope parent clicks are not propagated to children -- ie when card is clicked both Card.onClick and Card.CardContent.(Motion.div).Button.onClick is triggered  */}
      <Card
        className={`group border-border/50 bg-card/80 hover:border-primary/50 hover:shadow-primary/10 relative h-full cursor-pointer overflow-hidden backdrop-blur-sm transition-all duration-300 hover:shadow-lg ${
          isOpen ? "ring-primary border-primary ring-2" : ""
        }`}
        onClick={handleClicked}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpened(shot);
          }
        }}
        aria-label={`Shot ${formatRelativeTime(shot.date)}`}
      >
        {/* Unviewed indicator */}
        {!localViewed && (
          <div className="bg-primary absolute top-2 right-2 z-10 h-2.5 w-2.5 animate-pulse rounded-full" />
        )}

        <CardContent className="flex h-full flex-col p-0">
          {/* Image container */}
          <div className="bg-muted relative aspect-video w-full overflow-hidden">
            {shot.file.fileType == "text/plain" ? (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold transition-transform duration-300">
                {shot.file.fileData}
              </div>
            ) : (
              <Image
                src={`data:image/png;base64,${shot.file.fileData}`}
                alt={`Screenshot from ${site} ${formatRelativeTime(shot.date)}`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                placeholder="blur"
              />
            )}

            {/* Overlay with actions on hover */}
            <motion.div
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="bg-background/80 absolute inset-0 flex items-center justify-center gap-2 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
            >
              <Button
                size="sm"
                variant="secondary"
                onClick={downloadShot}
                className="h-8 w-8 p-0"
                aria-label="Download shot"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={copyHtml}
                className="h-8 w-8 p-0"
                aria-label={copied ? "HTML copied" : "Copy HTML"}
              >
                {copied ? (
                  <Check className="text-primary h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              {!localViewed && (
                //Why mark viewed onClick of an eye button and not on click of card
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={markViewed}
                  disabled={markingViewed}
                  className="h-8 w-8 p-0"
                  aria-label="Mark as viewed"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          </div>

          {/* Content section */}
          <div className="flex flex-1 flex-col gap-2 p-3">
            {/* HTML preview */}
            <p className="text-muted-foreground line-clamp-2 flex-1 font-mono text-xs">
              {truncateHtml(shot.html, 100)}
            </p>

            {/* Date */}
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Clock className="h-3 w-3" />
              <time dateTime={new Date(shot.date).toISOString()}>
                {formatRelativeTime(shot.date)}
              </time>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
