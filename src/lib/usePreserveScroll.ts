"use client";
// lib/usePreserveScroll.ts
import { useCallback, useRef } from "react";
import type { Swiper as SwiperType } from "swiper";

type swiperRef = {
  swiper: SwiperType;
  site: string;
  id?: number;
};

type restore = {
  addedCount?: number;
  site: string; // if prepended then added shots upward, but not prepended so index stays same
  prevId?: number;
};

export type preserveScrollType = {
  capturePosition: (site: string) => swiperRef[] | null;
  restorePosition: (object: restore) => boolean; //this will be for older shots since same count when added  newer shots?
  swiperRefs: React.RefObject<swiperRef[] | []>;
};

//must call in parent component to share same swiperRefs instance with children.
export function usePreserveScroll(): preserveScrollType {
  const swiperRefs = useRef<swiperRef[]>([]);

  const capturePosition = useCallback((site: string): swiperRef[] | null => {
    //gets the matching swiper
    const thisSwiper = swiperRefs.current?.find((s) => s.site == site);
    if (thisSwiper) {
      const tS = { ...thisSwiper, id: thisSwiper.swiper.activeIndex };
      swiperRefs.current = [
        ...swiperRefs.current.filter((s) => s.site != site),
        tS,
      ];
    } else return null;

    return swiperRefs.current; //returns whole swiper array
  }, []);

  //prevId is passed when the scrollTo id is known and is used instead of snapped index (+ addedCount)
  const restorePosition = useCallback(
    ({ addedCount, site, prevId }: restore): boolean => {
      const thisSwiper = swiperRefs.current.find((s) => s.site == site);

      if (thisSwiper) {
        const newIndex = prevId ? prevId : thisSwiper.id! + (addedCount || 0);
        thisSwiper.swiper.slideTo(newIndex, 100); //second arg is anim duration
      } else return false;

      return true;
    },
    [],
  );

  return {
    capturePosition,
    restorePosition,
    swiperRefs,
  };
}

//Hook component by pushing components local ref to swiperRefs;
//I assume swiperRefs points to the same ref regardless of usePreserveScroll being called in sibling components. -- or do I call in parent and pass as props.
// Then I push the swiper instance to swiperRefs.

//I assume addedCount is only effective when shots are prepended ie the index has been shifted forwards else the index stays same
