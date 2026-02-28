// app/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { optimisticUnvieweds, shot, siteData, unviewedType } from "@/lib/types";
import { useQuerySites } from "./reactquery";
import Shots from "@/components/Shots";
import { usePreserveScroll } from "@/lib/usePreserveScroll";

export default function HomePage() {
  // const [error, setError] = useState<string | null>(null); //Replaced by useQuerySites.sitesError
  const [selectedSite, setSelectedSite] = useState<siteData>(); //unlogged users have no sites, if selectedSite = undefined set to visitor site/cnn.com
  const [refreshingSites, setRefreshingSites] = useState<string>(); //when manual loading getShots

  //used boolean but needed to pass setter to consumer to get false after execution.
  // -- Instead can use a random string, which changes per invokation -- will still trigger the state and needs not be false;
  const [deleteSelectedShots, setDeleteSelectedShots] = useState(0);
  const [viewSelectedShots, setViewSelectedShots] = useState(0);
  const [downloadSelectedShots, setDownloadSelectedShots] = useState(0);
  const [downloadShotsBeforeCurr, setDownloadShotsBeforeCurr] = useState(0);
  const [downloadCurrAndNewShots, setDownloadCurrAndNewShots] = useState(0);
  const [downloadlocalUnviewed, setDownloadLocalUnviewed] = useState(0); //downloads from rendered shots
  const [downloaddbUnviewed, setDownloaddbUnviewed] = useState(0);
  const [userData, setUserData] = useState<userData>(); //will serve as logged indicator and display user info: create type
  // const localUnviewed = useRef<shot[]|null>(null) //Updates on shots mod -- useRef non-reactive will be render glitch free for passing to navbar (than shots)

  const preserveScroll = usePreserveScroll(); // passed down to shots>gallery
  const { sitesLoading, sitesError, sitesRefetch, sites } = useQuerySites(); //sitesRefetch => {data, error, isError, isSuccess}

  //stores db unvieweds for all sites. Is altered in Shots when shot is viewed or deleted -- no need for local but still can count local unvieweds and expose on dlLocalUnviewed
  const [allUnvieweds, setAllUnvieweds] = useState([] as unviewedType[]);
  const [localUnviewed, setlocalUnviewed] = useState(0);

  const thisUnvieweds = allUnvieweds.find((s) => s.site == selectedSite?.site);

  //recomputes per site or allUnviewed.unvieweds change -- useMemo prevents irrelevant recomputes from comp rerenders and other allUnviewed change
  //pass to navBar
  const selectedDbUnviewed = useMemo(() => {
    return thisUnvieweds;
  }, [selectedSite?.site, thisUnvieweds?.unvieweds]);

  // called in shots change effect
  const handleAllUnvieweds = useCallback(
    ({ delCount, allUnvieweds }: optimisticUnvieweds) => {
      setAllUnvieweds((prev) => {
        return delCount
          ? [
              ...prev.filter((s) => s.site != selectedSite?.site),
              {
                ...thisUnvieweds!,
                unvieweds: thisUnvieweds!.unvieweds - delCount,
              },
            ]
          : allUnvieweds!;
      });
    },
    [],
  );

  // decrement optimisticViewed by 1 when shot viewed or unvieweds when multiShots are deleted
  // -- will pass to components which view shots
  // Old  -- Will del
  // const handleOptimisticViewed = useCallback(
  //   ({ site, unvieweds }: unviewedType) => {
  //     if (!site || !selectedSite?.site) {
  //       console.error(
  //         "In handleOptimisticViewed. params missing: ",
  //         site,
  //         selectedSite,
  //       );
  //       return;
  //     }

  //     setAllUnvieweds((unvArr) => {
  //       const site = selectedSite.site;
  //       const thisUnv = unvArr.find((u) => u.site == site);
  //       if (!thisUnv || thisUnv.unvieweds! < 1)
  //         return [
  //           ...unvArr.filter((u) => u.site != site),
  //           { site, unvieweds: 0 },
  //         ]; //setting unvieweds:0 should trigger a refetch of unviewedCount
  //       return [
  //         ...unvArr.filter((u) => u.site != site),
  //         { site, unvieweds: thisUnv.unvieweds! - (unvieweds ?? 1) }, //it should accept unvieweds = 0 when passed;
  //       ];
  //     });
  //   },
  //   [selectedSite?.site],
  // );

  useEffect(() => {
    if (!sites?.length) return;
    handleSelectSite(sites[0]);
    //can load userSettings.lastSite
  }, []);

  //Old and inneficient: Gets the real value of site's unvieweds shots upon optimisiticUnviewed change, then updates if different -- shots may be incomplete (can only get count from db and then alter)
  // useEffect(() => {
  //   if (!sites?.length || !selectedSite?.site) {
  //     console.error("in Homepage: Missing params: ", { sites, selectedSite });
  //     return;
  //   }

  //   let cancel = false; //will stop assignment if effect refires during fetch.

  //   (async () => {
  //     const { sitesUnvieweds: dbUnv, error } = await getUnviewedCount(); //queries db -- need rateLimit?
  //     if (error || !dbUnv) {
  //       console.error("in Homepage, unviewedCount: ", error, dbUnv);
  //       return;
  //     }

  //     if (cancel) return;
  //     const thisUnvieweds = dbUnv.find((u) => u.site == selectedSite.site);

  //     requestAnimationFrame(() => {
  //       if (unvieweds?.unvieweds == thisUnvieweds?.unvieweds) return;
  //       setAllUnvieweds(dbUnv!);
  //     });
  //   })();

  //   return () => {
  //     cancel = true;
  //   };
  // }, [selectedSite, sites, unvieweds?.unvieweds]); //potential loop: why use unvieweds -- unvieweds recomputes when setAllUnvieweds and this setsAllUnvieweds

  //----> WILL USE sites and siteLoading as is, no need for useEffect for setSites

  // Fetch sites on mount
  // useEffect(() => {
  //   async function loadSites() {
  //     try {
  //       const sitesData = await getSites();
  //       setSites(sitesData);
  //       if (sitesData.length > 0) {
  //         setSelectedSite(sitesData[0].site); //from userSites dropdown menu
  //       }
  //     } catch (err) {
  //       setError(parseApiError(err));
  //     } finally {
  //       setSitesLoading(false);
  //     }
  //   }
  //   loadSites();
  // }, []);

  // Fetch shots when site changes
  // useEffect(() => {
  //   //flat map the reactQuery data into a single shots array, Or append to an array of shots[] where each corresponds to a page -- although this still alters the state -- triggering a rerendering. How do I append new sites without triggering a rerendering or causing flickers

  //   async function loadShots() {
  //     // if (!selectedSite) return; // nope: if !selectedSite, will load visitorShots

  //     setShotsLoading(true);
  //     setError(null);
  //     setSelectedShot(null);

  //     try {
  //       //finds:
  //       // prefer this script which only auto loads new sites when user is active, than mapping shots component each with auto load effects -- loadin while the user is active gives a freshness sense

  //       //this script's useEffect>loadShots overwrites loaded sites (setShots) when user switches between sites -- solved with reactQuery: not so, will still load cache -- change to shots component mapped to each site.
  //       //  this will map shots component to each site and only display active one -- dynamic pages?: if component unmounts useState will fail, will then need context and loading that may undifferent from current implementation; Or are there hooks for preserving states in dynamic routes?

  //       //slide position: will have to set current slide index per shot component, set usePreserveScroll to array.
  //       //  Slide position: will be captured before on every fetch: new addition (nextPage) or old addition (prevPage).

  //       //instead of gallery showing slides swipable from left to right, prefer a scrollable gallery component with square containers (images) grouped by date, Is there a swiper variant for this (so I might keep its swiper instance effects), or do I just style the swiper containers ?
  //       //Heard something about next js now memoising functions, is useCallback obsolete?
  //       const shotsData = await getShots(selectedSite);
  //       setShots(shotsData);

  //       if (shotsData.length > 0) {
  //         setSelectedShot(shotsData[0]); //auto selecting firstShot from retrieved 20 unvieweds -- ok?
  //       }
  //     } catch (err) {
  //       setError(parseApiError(err)); //not so.
  //       setShots([]);
  //     } finally {
  //       setShotsLoading(false);
  //     }
  //   }
  //   loadShots();
  // }, [selectedSite]);

  const handleSelectSite = useCallback((site: siteData) => {
    setSelectedSite(site);
  }, []);

  //place in navbar
  const handleRefresh = useCallback(async () => {
    if (!selectedSite) return;

    //triggers refresh effect in Shots.
    setRefreshingSites(selectedSite.site + Math.random());
    try {
      const { error } = await sitesRefetch();
      if (error) throw error;
    } catch (e) {
      console.error("Error refetching sites: ", e);
    } finally {
      setRefreshingSites("");
    }
  }, [selectedSite?.site]);

  const handleAddSite = useCallback(() => {
    // Navigate to cron scheduler to add a new site -- change to overlaid component
    window.location.href = "/cron";
  }, []);

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* Navbar */}
      <Navbar
        sites={sites}
        selectedSite={selectedSite}
        onSelectSite={handleSelectSite}
        sitesLoading={sitesLoading}
        handleRefresh={handleRefresh}
        onAddSite={handleAddSite}
        allUnvieweds={allUnvieweds}
        //create contextMenu for these functions in Shots > gallery
        selectedDbUnviewed={selectedDbUnviewed}
        localUnviewed={localUnviewed}
        onDownloadCurrAndNewShots={setDownloadCurrAndNewShots}
        onDownloadShotsBeforeCurr={setDownloadShotsBeforeCurr}
        onDownloadSelectedShots={setDownloadSelectedShots}
        onDownloadLocalUnviewed={setDownloadLocalUnviewed}
        onDownloaddbUnviewed={setDownloaddbUnviewed}
        onDeleteSelectedShots={setDeleteSelectedShots}
        onSelectedShotsViewed={setViewSelectedShots}
      />

      {/* Main Content */}
      <Shots
        refresh={refreshingSites!}
        site={selectedSite?.site || ""}
        onAddSite={handleAddSite}
        preserveScroll={preserveScroll}
        downloaddbUnviewed={downloaddbUnviewed}
        downloadlocalUnviewed={downloadlocalUnviewed}
        downloadCurrAndNewShots={downloadCurrAndNewShots}
        downloadShotsBeforeCurr={downloadShotsBeforeCurr}
        downloadSelectedShots={downloadSelectedShots}
        deleteSelectedShots={deleteSelectedShots}
        viewSelectedShots={viewSelectedShots}
        onlocalUnviewed={setlocalUnviewed}
        onAllUnvieweds={handleAllUnvieweds}
      />

      {/* Footer gradient accent */}
      <div className="from-primary/50 via-accent/50 to-primary/50 h-1 bg-gradient-to-r" />
    </div>
  );
}
