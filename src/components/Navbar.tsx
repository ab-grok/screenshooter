// components/Navbar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera,
  Clock,
  Download,
  LogIn,
  UserPlus,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SitesTab } from "./SitesTab";
import type { siteData, unviewedType } from "@/lib/types";
import Image from "next/image";

interface NavbarProps {
  sites: siteData[] | undefined;
  selectedSite: siteData | undefined;
  allUnvieweds: unviewedType[];
  selectedDbUnviewed?: unviewedType;
  localUnviewed: number;
  sitesLoading: boolean;
  onSelectSite: (site: siteData) => void;
  onAddSite: () => void;
  handleRefresh: () => void;
  onDownloadLocalUnviewed: (n: number) => void;
  onDownloadCurrAndNewShots: (n: number) => void;
  onDownloadShotsBeforeCurr: (n: number) => void;
  onDownloadSelectedShots: (n: number) => void;
  onDownloaddbUnviewed: (n: number) => void;
  onDeleteSelectedShots: (n: number) => void;
  onSelectedShotsViewed: (n: number) => void;
  isLoggedIn?: boolean;
  // TODO: Add user info prop when auth is implemented
}

export function Navbar({
  sites,
  selectedDbUnviewed,
  allUnvieweds,
  localUnviewed, //unvieweds from rendered shots -- used when downloading
  selectedSite,
  isLoggedIn,
  sitesLoading,
  onAddSite,
  onSelectSite,
  onDownloadLocalUnviewed,
  onDownloadCurrAndNewShots,
  onDownloadShotsBeforeCurr,
  onDownloadSelectedShots,
  onDownloaddbUnviewed,
  onDeleteSelectedShots,
  onSelectedShotsViewed,
}: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-border/50 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-lg">
            <Camera className="text-primary h-5 w-5" />
            <Image src="/screenshooter.png" alt="ScreenShooter logo" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Shooter</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-4 md:flex">
          {/* Site Switcher */}
          <SitesTab
            sites={sites}
            selectedSite={selectedSite}
            onSelectSite={onSelectSite}
            allUnvieweds={allUnvieweds}
            sitesLoading={sitesLoading}
            selectedDbUnviewed={selectedDbUnviewed}
            onAddNew={onAddSite}
          />

          {/* Quick Actions */}
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link href="/cron">
              <Clock className="h-4 w-4" />
              <span>Scheduler</span>
            </Link>
          </Button>

          {(selectedDbUnviewed?.unvieweds || 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownloaddbUnviewed(Date.now())}
              className="border-primary/50 text-primary hover:bg-primary/10 gap-2 bg-transparent"
            >
              <Download className="h-4 w-4" />
              <span>Download {selectedDbUnviewed?.unvieweds} db unviewed</span>
            </Button>
          )}

          {/* set download buttons */}

          {/* Auth Buttons */}
          {!isLoggedIn ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="gap-2">
                <Link href="/login">
                  <LogIn className="h-4 w-4" />
                  <span>Log in</span>
                </Link>
              </Button>
              <Button size="sm" asChild className="gap-2">
                <Link href="/signup">
                  <UserPlus className="h-4 w-4" />
                  <span>Sign up</span>
                </Link>
              </Button>
            </div>
          ) : (
            // TODO: Replace with UserControlsOverlay trigger
            <Button variant="ghost" size="sm">
              Account
            </Button>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="border-border/50 bg-card/95 w-[280px] backdrop-blur-md"
          >
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Camera className="text-primary h-5 w-5" />
                Screen Shooter
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 flex flex-col gap-4">
              {/* Site Switcher */}
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                  Sites
                </p>
                <SitesTab
                  sites={sites}
                  selectedSite={selectedSite}
                  sitesLoading={sitesLoading}
                  selectedDbUnviewed={selectedDbUnviewed}
                  allUnvieweds={allUnvieweds}
                  onSelectSite={(site) => {
                    onSelectSite(site);
                    setIsMobileMenuOpen(false);
                  }}
                  onAddNew={onAddSite}
                />
              </div>

              {/* Navigation Links */}
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                  Navigation
                </p>
                <Button
                  variant="ghost"
                  className="justify-start gap-2"
                  asChild
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Link href="/cron">
                    <Clock className="h-4 w-4" />
                    Cron Scheduler
                  </Link>
                </Button>

                {(selectedDbUnviewed?.unvieweds || 0) > 0 && (
                  <Button
                    variant="ghost"
                    className="text-primary justify-start gap-2"
                    onClick={() => {
                      onDownloaddbUnviewed(Date.now());
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Download {selectedDbUnviewed?.unvieweds} db unviewed
                  </Button>
                )}
              </div>

              {/* Auth Section */}
              <div className="border-border/50 flex flex-col gap-2 border-t pt-4">
                {!isLoggedIn ? (
                  <>
                    <Button
                      variant="ghost"
                      className="justify-start gap-2"
                      asChild
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {/* Change to hover + popover card */}
                      <Link href="/login">
                        <LogIn className="h-4 w-4" />
                        Log in
                      </Link>
                    </Button>
                    <Button
                      className="justify-start gap-2"
                      asChild
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Link href="/signup">
                        <UserPlus className="h-4 w-4" />
                        Sign up
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" className="justify-start">
                    Account Settings
                  </Button>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </motion.header>
  );
}
