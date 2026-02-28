//set trigger action dialog boxes;
"use client";
//Components/Gallery
//Consumed as Shots > Gallery

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Keyboard, A11y } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ShotCard } from "./ShotCard";
import { preserveScrollType } from "@/lib/usePreserveScroll";
import type {
  delShotType,
  handleViewed,
  selectedShot,
  shot,
  shotData,
} from "@/lib/types";

import "swiper/css";
import "swiper/css/navigation";
import { useMutateViewed, useQueryShots } from "@/app/(main)/reactquery";
import { setViewed } from "@/lib/actions";
import { useDownloader } from "@/lib/downloader";

interface GalleryProps {
  siteShots: shot[] | undefined;
  site: string;
  openedShot: shot | undefined;
  onOpenedShot: (shot: shot) => void;
  preserveScroll: preserveScrollType;
  onDeleteShot: ({ ids }: delShotType) => void; //deletes selectedShots when active
  delSelectedShots: number;
  downloadSelectedShots: number;
  viewSelectedShots: number;
}

function ShotSkeleton() {
  return (
    <div className="h-full animate-pulse">
      <div className="border-border/50 bg-card/50 flex h-full flex-col overflow-hidden rounded-lg border">
        <div className="bg-muted aspect-video w-full" />
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="bg-muted h-4 w-3/4 rounded" />
          <div className="bg-muted h-3 w-1/2 rounded" />
        </div>
      </div>
    </div>
  );
}

export function Gallery({
  siteShots,
  site,
  openedShot,
  onOpenedShot, //unneeded: will select shots here and pass to selected shot -- false need in parent for selectedViewer
  preserveScroll,
  onDeleteShot,
  delSelectedShots,
  downloadSelectedShots,
  viewSelectedShots,
}: GalleryProps) {
  // const [shots, setShots] = useState<Shot[]>(initialShots);
  // const [isLoadingOlder, setIsLoadingOlder] = useState(false); //replace with fetchingPrevShots
  // const [isLoadingNewer, setIsLoadingNewer] = useState(false); //replace with fetchingNextShots
  // const [noMorePrev, setNoMorePrev] = useState(false);
  // const [noMoreNext, setNoMoreNext] = useState(false);
  // const [hasMoreOlder, setHasMoreOlder] = useState(true); //repllace with noMoreOlder
  // const [hasMoreNewer, setHasMoreNewer] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [selectedShots, setSelectedShots] = useState([] as selectedShot[]); //will be passed to shotCard to acc selects and used for dl
  const [addedCount, setAddedCount] = useState(0); //will be passed to shotCard to acc selects and used for dl
  const [firstShotDeled, setFirstShotDeled] = useState<number | null>(null); //holds id of first shot in selectedShots when deled

  const { shots, fetchNextShots, fetchPrevShots, ...r } = useQueryShots(site);
  const { fetchingNextShots, fetchingPrevShots, shotsRefetch } = r;
  const { mutateViewed, resetViewed, ...v } = useMutateViewed(site);
  const { mutateViwedErr, mutatingViewed } = v; // set loader or sth
  const { capturePosition, restorePosition, swiperRefs } = preserveScroll;
  const galleryRef = useRef<HTMLDivElement | null>(null); //unused
  const { download } = useDownloader();

  const noMorePrev = useMemo(() => {
    if (!shots?.pages?.length) return true;
    return shots.pages[0].noMorePrev;
  }, [shots]);

  const noMoreNext = useMemo(() => {
    if (!shots?.pages?.length) return true;
    return shots.pages[shots.pages.length - 1].noMoreNext;
  }, [shots]);

  //global effect for restorePositon on shot change -- position captured per slide change.
  // Uses firstShotDeled for restoring to previous id after delShot -- may need change if grid layout / manual scroll
  //on delShot fail: effect retriggers refixing optimstically deled shots and setting to activeIndex in capturePosition -- good.
  // Else block: non delshot shots change: uses addedCount ( only useful for prepended shots);
  useEffect(() => {
    if (!shots?.pages?.length) return;

    if (Number(firstShotDeled)) {
      if (!selectedShots.length) return;

      let prevId =
        Math.min(...selectedShots.map((s) => s.swiperId!).filter(Boolean)) - 1;
      prevId = prevId >= 0 ? prevId : 0;

      setSelectedShots([]); //runs after optiistic del
      setFirstShotDeled(null);

      //at this point shots have been deled -- no need for requestAnimationFrame to wait for another DOM update -- correct ?
      const restored = restorePosition({ site, prevId });
      if (!restored) console.error("Failed to restore ");
    } else {
      restorePosition({ site, addedCount });
      setAddedCount(0);
    }
  }, [shots]);

  useEffect(() => {
    if (!viewSelectedShots) return;
    handleViewed({ viewSelectedShots: true });
  }, [viewSelectedShots]);

  useEffect(() => {
    //effect for delShot trigger (from Navbar) and context menu -- do context menu
    if (!delSelectedShots) return;
    handleDeleteShot2({} as delShotType);
  }, [delSelectedShots]);

  useEffect(() => {
    if (!downloadSelectedShots || !selectedShots.length) return;
    handleDownloadSelectedShots();
  }, [downloadSelectedShots]);

  const handleDownloadSelectedShots = useCallback(async () => {
    try {
      const selIds = selectedShots.map((s) => s.id!);
      const downloadShots = siteShots
        ?.filter((s) => selIds.includes(s.id))
        .map((s) => ({ ...s.file, date: s.date }))!;

      const { error } = await download(downloadShots);
      if (error) throw error;
    } catch (e) {
      console.error("in Gallery handleDownloadSelShots: ", e);
    }
  }, []);

  // Optimistically mods shots.viewed, can call by selectedShots; captures curr slide pos; -- pos is restored on shots mod in global cap effect
  const handleViewed = useCallback(
    async ({ id, viewSelectedShots }: handleViewed) => {
      try {
        let ids = [id!];

        if (viewSelectedShots && selectedShots?.length) {
          ids = selectedShots.map((s) => s.id!);
        }

        const captured = capturePosition(site);
        if (!captured)
          console.error("in Gallery handleViewed: Failed to capture position");

        const { error } = await mutateViewed({ ids }); //before await resolves, shots refresh optimistically
        if (error) throw error;
      } catch (e: any) {
        console.error("in Gallery handleViewed: ", e);
        setError(e);
      }
    },
    [selectedShots],
  );

  //Multishots: !id: passes [...], called from Navbar trigger and passed to Shots.handleDeleteShot
  const handleDeleteShot2 = useCallback(
    async ({ ids }: delShotType) => {
      try {
        capturePosition(site);
        if (!ids) {
          if (!selectedShots.length) return;
          setFirstShotDeled(selectedShots[0].swiperId!);

          ids = selectedShots.map((s) => s.id!);

          onDeleteShot({ ids });
        } else {
          onDeleteShot({ ids });
        }
        return;
      } catch (e: any) {
        console.error("in Gallery handleDeleteShot: ", e);
        setError(e);
      }
    },
    [selectedShots],
  );

  //initialise swiperRefs (array) with swiper instance.
  const pushSwiper = useCallback(
    (swiper: SwiperType) => {
      const savedSwiper = swiperRefs.current?.find((s) => s.site == site);
      if (savedSwiper) return;

      const thisSwiper = { swiper, site };
      swiperRefs.current = [...swiperRefs.current, thisSwiper];
    },
    [site],
  );

  const onScrollDownEdge = useCallback(async () => {
    try {
      if (noMorePrev) throw "No more prev shots!";
      if (fetchingPrevShots) throw "Fetching prev shots!";

      const { error, data } = await fetchPrevShots();
      if (error) throw error;

      //Prepended shots which means orginal position shifted forwards (or upwards when grid layout)
      setAddedCount(data?.pages[0].shots.length!);
    } catch (e: any) {
      console.error("In onScrollDown: ", e);
      setError(e);
    }
  }, [noMorePrev, fetchingPrevShots]);

  const onScrollUpEdge = useCallback(async () => {
    try {
      if (noMoreNext) throw "You're up to date.";
      if (fetchingNextShots) throw "Fetching next shots.";

      const { error, data } = await fetchNextShots();
      if (error) throw error;

      //no Need to setAddedCount -- as appended shots may not shift activeIndex (but may for manual scroll position seeking in grid layout);
      // effect is triggered by shots change
    } catch (e) {
      console.error("In onScrollUp: ", e);
    }
  }, [noMoreNext, fetchingNextShots]);

  //computes the onEnd/onStartReached of the slides and fetches old/new on either -- will change to a scrollTop reached fn
  //Logic change after implementing slides as grid?: get container height and calc container top reached and loading next and container bottom reached and load prev shots (use requestAnimFrame);
  const handleSlideChange = useCallback(
    async (swiper: SwiperType) => {
      capturePosition(site);
      try {
        if (swiper.activeIndex < 5 && !noMorePrev && !fetchingPrevShots)
          await onScrollDownEdge();
        else {
          const pageEnd = swiper.activeIndex > swiper.slides.length - 6;
          if (pageEnd && !noMoreNext && !fetchingNextShots) {
            await onScrollUpEdge();
          }
        }
      } catch (e: any) {
        console.error("In handleSlidesChange: ", e);
        setError(e);
      }
    },
    [noMorePrev, noMoreNext, fetchingNextShots, fetchingPrevShots],
  );

  //Updates selectedShots array to include or uninclude passed shot.id
  const toggleSelectShot = useCallback(({ id, swiperId }: selectedShot) => {
    setSelectedShots((shot) => {
      const wasSelected = shot.find((s) => s.id == id);
      if (wasSelected) return shot.filter((s) => s.id != id);
      return [...shot, { id, swiperId }];
    });
  }, []);

  if (siteShots?.length == 0 && !fetchingNextShots && !fetchingPrevShots) {
    return (
      <div className="border-border bg-card/50 flex h-64 items-center justify-center rounded-lg border border-dashed">
        <p className="text-muted-foreground">No screenshots available</p>
      </div>
    );
  }

  return (
    <div ref={galleryRef} className="relative w-full">
      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-destructive/10 text-destructive absolute top-0 right-0 left-0 z-10 rounded-lg p-2 text-center text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading indicators */}
      <AnimatePresence>
        {fetchingPrevShots && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/2 left-4 z-10 -translate-y-1/2"
          >
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fetchingNextShots && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/2 right-4 z-10 -translate-y-1/2"
          >
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation buttons */}
      <Button
        variant="secondary"
        size="icon"
        className="gallery-prev bg-background/80 hover:bg-background absolute top-1/2 left-0 z-10 -translate-y-1/2 rounded-full backdrop-blur-sm"
        aria-label="Previous screenshots"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <Button
        variant="secondary"
        size="icon"
        className="gallery-next bg-background/80 hover:bg-background absolute top-1/2 right-0 z-10 -translate-y-1/2 rounded-full backdrop-blur-sm"
        aria-label="Next screenshots"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      {/* Swiper */}
      <div className="px-12">
        <Swiper //explain each props
          modules={[Navigation, Keyboard, A11y]}
          // spaceBetween={16} //- Can be responsive: spaceBetween={{ 640: 8, 1024: 16 }}.
          slidesPerView={1}
          navigation={{
            prevEl: ".gallery-prev",
            nextEl: ".gallery-next",
          }}
          keyboard={{
            enabled: true,
            onlyInViewport: true,
          }}
          breakpoints={{
            640: { slidesPerView: 2, spaceBetween: 12 },
            1024: { slidesPerView: 3, spaceBetween: 14 },
            1280: { slidesPerView: 4, spaceBetween: 16 },
          }}
          onSwiper={pushSwiper}
          onSlideChange={handleSlideChange}
          className="py-4"
        >
          {siteShots &&
            siteShots.map((shot, id) => (
              <SwiperSlide key={shot.id} className="h-auto">
                <ShotCard
                  shot={shot}
                  isOpen={openedShot?.id === shot.id}
                  onOpened={onOpenedShot}
                  onViewed={handleViewed}
                  onDelete={handleDeleteShot2}
                  site={site}
                  toggleSelect={toggleSelectShot}
                  swiperId={id}
                />
              </SwiperSlide>
            ))}

          {/* Skeleton placeholders when loading -- may need to fix positions optimistically then fix to new position on fetch success or fail */}
          {fetchingNextShots ||
            (!siteShots &&
              Array.from({ length: 5 }).map((_, i) => (
                <SwiperSlide key={`skeleton-newer-${i}`} className="h-auto">
                  <ShotSkeleton />
                </SwiperSlide>
              )))}
        </Swiper>
      </div>

      {/* Load more buttons for manual control */}
      <div className="mt-4 flex justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onScrollDownEdge}
          disabled={fetchingPrevShots || noMorePrev}
          className="bg-transparent text-xs"
        >
          {fetchingPrevShots ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : null}
          Load older
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onScrollUpEdge}
          disabled={fetchingNextShots || noMoreNext}
          className="bg-transparent text-xs"
        >
          {fetchingNextShots ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : null}
          Load newer
        </Button>
      </div>
    </div>
  );
}
