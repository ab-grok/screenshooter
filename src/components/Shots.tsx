// Components/Shots.tsx
//refreshingSHots unused

import {
  useMutateDel,
  useMutateViewed,
  useQueryShots,
} from "@/app/(main)/reactquery";
import { useDownloader } from "@/lib/downloader";
import {
  delShotType,
  optimisticUnvieweds,
  queryData,
  shot,
  shotData,
  siteData,
  unviewedType,
} from "@/lib/types";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { motion } from "framer-motion";
import { SelectedViewer } from "./SelectedViewer";
import { Gallery } from "./Gallery";
import { preserveScrollType, usePreserveScroll } from "@/lib/usePreserveScroll";
import { delShot, getDbShots, getUnviewedCount } from "@/lib/actions";
import { formatDate } from "@/lib/dateformatter";

type state = {
  value: boolean;
  setter: (d: boolean) => void;
};

type ShotsProp = {
  refresh: string; //state var from userSites refreshShots -- why reload sites.
  site: string;
  onAddSite: () => void;
  preserveScroll: preserveScrollType;
  deleteSelectedShots: number;
  downloadlocalUnviewed: number;
  downloaddbUnviewed: number;
  downloadCurrAndNewShots: number;
  downloadShotsBeforeCurr: number;
  downloadSelectedShots: number;
  viewSelectedShots: number;
  onlocalUnviewed: (n: number) => void;
  onAllUnvieweds: ({ delCount, allUnvieweds }: optimisticUnvieweds) => void;
};

export default function Shots({
  refresh,
  site,
  onAddSite,
  preserveScroll,
  deleteSelectedShots,
  downloadlocalUnviewed,
  downloaddbUnviewed,
  downloadCurrAndNewShots,
  downloadShotsBeforeCurr,
  downloadSelectedShots,
  viewSelectedShots,
  onlocalUnviewed,
  onAllUnvieweds,
}: ShotsProp) {
  // const [siteShots, setSiteShots] = useState<shot[]>();
  const [openedShot, setOpenedShot] = useState<shot>(); //send setter to gallery>shotCard
  const [prevOpenedShotId, setPrevOpenedShotId] = useState<number>();
  const [delCount, setDelCount] = useState(0);
  const [newShots, setNewShots] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  //hooks
  const { download, openInNewTab } = useDownloader(); //custom downloader
  const { shotsLoading, shotsError, shots, ...r } = useQueryShots(site);
  const { shotsRefetch, shotsRefetching, fetchNextShots, fetchPrevShots } = r;
  const { mutateDelErr, mutateDel, delReset, mutatingDel } = useMutateDel(site); //setShots deleting

  const { swiperRefs } = preserveScroll;

  //siteShots will update when shots is defined; useMemo prevents recomputation on [non shots changed] rerenders
  const siteShots = useMemo(
    () => shots?.pages.flatMap((shotData: shotData) => shotData?.shots ?? []),
    [shots],
  );

  const localUnviewed = useMemo(
    () => shots?.pages.flatMap((p) => p.shots).filter((s) => !s.viewed).length,
    [shots],
  );

  //updates localUnviewed used in Navbar
  useEffect(() => {
    if (!shots) return;

    onlocalUnviewed(
      shots?.pages.flatMap((p) => p.shots).filter((s) => !s.viewed).length,
    );
  }, [localUnviewed]);

  //Effect retrieving shots from db every 1 min; Throws when !rows
  //Should fetch if noMoreShots -- else the user hasn't scrolled to latest;
  useEffect(() => {
    timerRef.current = setInterval(async () => {
      try {
        if (!shots) throw "Shots haven't loaded. Will rerun in one Minute";
        const noMoreNext = shots?.pages?.at(-1)?.noMoreNext;
        if (!noMoreNext) throw "User is behind on stored shots";
        const { error } = await fetchNextShots();
        if (error) throw error;

        setNewShots(Date.now());
        const time = formatDate(Date.now());
        console.log("in Shots timeoutManager. Ran fetch on: ", time);
      } catch (e) {
        setNewShots(0);
        console.error("Attempted new shots fetch: ", e);
      }
    }, 1000 * 60);

    return () => {
      clearInterval(timerRef.current!);
    };
  }, []);

  //used in SelectedViewer -- for?
  const getPrevShot = useCallback(
    (id: number) => {
      //this render-glitch free? -- is passed to selectedViewer > ...?
      if (!siteShots) return undefined;

      return siteShots.find((s) => s.id == id);
    },
    [siteShots],
  );

  const refreshShots = useCallback(async () => {
    try {
      const { error } = await shotsRefetch();
      if (error) throw error;
    } catch (e) {
      console.error("in refreshShots, Problem with refresh: ", e);
      //setError
    }
  }, []);

  //Gets unviewedCount: if() filters out shots change from onPrevShot or refetch
  // notOpenedShot: the current openedshot is not new; mutatingDel: true while deleting; newShots: true when fetched new shots; shotsLoading: true for init shots fetch;
  useEffect(() => {
    const notOpenedShot = !openedShot || openedShot?.id == prevOpenedShotId;
    if (notOpenedShot && !mutatingDel && !newShots && !shotsLoading) return;

    //optimisically reduces unviewedcount on del
    if (mutatingDel) {
      onAllUnvieweds({ delCount });
    }

    try {
      (async () => {
        const { error, allUnvieweds } = await getUnviewedCount(); // Main.Page filters for site unvieweds
        if (error || !allUnvieweds) throw error;

        onAllUnvieweds({ allUnvieweds });
        if (openedShot) setPrevOpenedShotId(openedShot?.id);
      })();
    } catch (e) {
      console.error("In Shots getUnviewedCount: ", e);
    }
  }, [shots, shotsLoading]);

  //tracks ctrl + R for refresh
  useEffect(() => {
    const ctrlR = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() == "r") {
        e.preventDefault();
        refreshShots();
        return;
      }
    };

    if (refresh.includes(site)) refreshShots(); //random string trigger from parent

    window.addEventListener("keydown", ctrlR);
    return () => window.removeEventListener("keydown", ctrlR);
  }, [refresh]);

  //effects for download triggers called in NavBar or context menu -- create context menu
  useEffect(() => {
    if (!downloadlocalUnviewed) return;
    handleDownloadLocalUnviewed();
  }, [downloadlocalUnviewed]);

  useEffect(() => {
    if (!downloaddbUnviewed) return;
    handleDownloadDbUnviewed();
  }, [downloaddbUnviewed]);

  useEffect(() => {
    if (!downloadShotsBeforeCurr) return;
    handleDownloadShotsBeforeCurrent();
  }, [downloadShotsBeforeCurr]);

  useEffect(() => {
    if (!downloadCurrAndNewShots) return;
    handleDownloadCurrentAndNewShots();
  }, [downloadCurrAndNewShots]);
  //downloadSelectedShots fn in Gallery

  useEffect(() => {
    if (!mutateDelErr) return;
    console.log("in Shots: Error trying to del multiShots!", mutateDelErr);
    //setError
  }, [mutateDelErr]);

  const handleDownloadDbUnviewed = useCallback(async () => {
    //rateLimit?
    try {
      const props = { unviewed: true, site };
      const { error: e1, downloadShots } = await getDbShots(props);
      if (e1 || !downloadShots) throw e1;

      const dbUnviewedhots = downloadShots.map((s) => ({
        ...s.file,
        date: s.date,
      }));

      const { error: e2 } = await download(dbUnviewedhots);
      if (e2) throw e2;
    } catch (e) {
      console.error("in handleDownloadDbUnviewed: ", e);
    }
  }, [site]);

  //Downloads retrieved unviewd shots -- will need one that seeks db for all unvieweds shots.
  const handleDownloadLocalUnviewed = useCallback(async () => {
    try {
      if (!siteShots?.length) return;

      const unviewedShots = siteShots
        ?.filter((s) => s.viewed == false)
        .map((s) => ({ ...s.file, date: s.date })); //returning an object with date -- used for naming in downloader;

      const { error } = await download(unviewedShots);
      if (error) throw error;
    } catch (e) {
      console.error("in handleDownloadLocalUnviewed: ", e);
    }
  }, [siteShots]);

  const handleDownloadCurrentAndNewShots = useCallback(async () => {
    try {
      const swiperRef = swiperRefs.current.find((s) => (s.site = site));

      if (!swiperRef)
        throw { error: "swiperRef unintialised", swiperRef, swiperRefs };
      if (!siteShots?.length)
        throw { error: "No shots found", shotsLength: siteShots?.length };

      const newShots = siteShots
        .slice(swiperRef.swiper.activeIndex)
        .map((s) => ({ ...s.file, date: s.date }));

      const { error } = await download(newShots);
      throw error;
    } catch (e) {
      console.error("in downloadShotsAfterCurrent: ", JSON.stringify(e));
    }
  }, [siteShots]);

  const handleDownloadShotsBeforeCurrent = useCallback(async () => {
    try {
      const swiperRef = swiperRefs.current.find((s) => (s.site = site));

      if (!swiperRef)
        throw { error: "swiperRef unintialised", swiperRef, swiperRefs };
      if (!siteShots?.length)
        throw { error: "No shots found", shotsLength: siteShots?.length };

      const oldShots = siteShots
        .slice(0, swiperRef.swiper.activeIndex)
        .map((s) => ({ ...s.file, date: s.date }));

      const { error } = await download(oldShots);
    } catch (e) {
      console.error("in downloadShotsBeforeCurrent: ", JSON.stringify(e));
    }
  }, [siteShots]);

  //HandleDelShot -- handles del in both gallery and selectedViewer
  const handleDeleteShot = useCallback(async ({ ids }: delShotType) => {
    try {
      ids = Array.isArray(ids) ? ids : [ids];

      setDelCount(ids.length);
      const { error } = await mutateDel(ids); //calls mutateShots fn
      if (error) throw error;

      // delReset(); //sets errors to zero null unneeded;
    } catch (e: any) {
      console.error("in handleDeleteShot: ", e);
      //setError -- timeOut
    }
  }, []);

  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      {/* Loading State */}
      {(shotsLoading || shotsRefetching) &&
        !siteShots?.length && ( //will not wok for shotsRefetching as siteShots is defined.
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              {/* Show card skeletons instead */}
              <p className="text-muted-foreground font-black">
                Loading Shots...
              </p>
            </div>
          </div>
        )}

      {/* no Shots Error State */}
      {shotsError && !shotsLoading && !shotsRefetching && (
        <div className="flex flex-1 items-center justify-center p-8">
          <Alert
            variant="destructive"
            className="border-destructive/50 bg-destructive/10 max-w-md"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3">
              <span>{shotsError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshShots}
                className="w-fit gap-2 bg-transparent"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* No shots */}
      {!shotsLoading && !shotsError && !siteShots?.length && (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold">No shots here</h2>
            <p className="text-muted-foreground mt-2">Schedule one!</p>
            <Button className="mt-4" onClick={onAddSite}>
              Set Cron
            </Button>
          </div>
        </div>
      )}

      {/* Content Layout */}
      {!shotsLoading && !shotsError && siteShots?.length! > 0 && (
        <>
          {/* Mobile: Stacked Layout */}
          <div className="flex flex-col lg:hidden">
            {/* Selected Viewer - Top Half on Mobile */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-border/50 h-[50vh] border-b p-4"
            >
              <SelectedViewer
                shot={openedShot}
                onClose={() => setOpenedShot(undefined)}
                getPrevShot={getPrevShot}
                onDeleteShot={handleDeleteShot}
              />
            </motion.div>

            {/* Gallery - Bottom Half on Mobile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 p-4"
            >
              <Gallery
                siteShots={siteShots}
                site={site || ""}
                openedShot={openedShot}
                onOpenedShot={setOpenedShot}
                preserveScroll={preserveScroll}
                onDeleteShot={handleDeleteShot}
                delSelectedShots={deleteSelectedShots}
                downloadSelectedShots={downloadSelectedShots}
                viewSelectedShots={viewSelectedShots}
              />
            </motion.div>
          </div>

          {/* Desktop: Side by Side Layout */}
          <div className="hidden flex-1 lg:flex">
            {/* Gallery - Center */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="border-border/50 flex-1 border-r p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Shots</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshShots}
                  disabled={shotsLoading || shotsRefetching}
                  className="gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${shotsLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
              <Gallery
                siteShots={siteShots}
                site={site || ""}
                openedShot={openedShot}
                onOpenedShot={setOpenedShot}
                preserveScroll={preserveScroll}
                onDeleteShot={handleDeleteShot}
                delSelectedShots={deleteSelectedShots}
                downloadSelectedShots={downloadSelectedShots}
                viewSelectedShots={viewSelectedShots}
              />
            </motion.div>

            {/* Selected Viewer - Right Column */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-[45%] max-w-2xl p-6"
            >
              <SelectedViewer
                shot={openedShot}
                onClose={() => setOpenedShot(undefined)}
                getPrevShot={getPrevShot}
                onDeleteShot={handleDeleteShot}
              />
            </motion.div>
          </div>
        </>
      )}
    </main>
  );
}
