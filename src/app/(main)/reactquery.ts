"use client";

import {
  delShot,
  getShots,
  getSites,
  setViewed,
  shotProp,
} from "@/lib/actions";
import { shot, shotData, siteData } from "@/lib/types";
import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

//Optimistically Deletes ids from shots and will trigger shots update, then runs delShot();
export function useMutateDel(site: string) {
  const queryClient = useQueryClient();

  const mutateShot = useMutation<
    { error: null },
    { error: string },
    number[],
    { prevData: any }
  >({
    mutationFn: async (ids) => await delShot({ ids }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: [site, "shots"] });
      const prevData = await queryClient.getQueryData([site, "shots"]);

      queryClient.setQueryData<InfiniteData<shotData, unknown>>(
        [site, "shots"],
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              shots: page.shots.filter((s) => !ids.includes(s.id)),
            })),
          };
        },
      );

      return { prevData };
    },
    onError: (err, variable, context) => {
      queryClient.setQueryData([site, "shots"], context?.prevData);
      return err;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [site, "shots"] });
    },
  });

  return {
    mutateDelErr: mutateShot.error?.error ?? mutateShot.error,
    mutatingDel: mutateShot.isPending,
    delReset: mutateShot.reset,
    mutateDel: mutateShot.mutateAsync,
  };
}

//Calls setViewed when a shot is opened
export function useMutateViewed(site: string) {
  const queryClient = useQueryClient();

  const mutateViewed = useMutation<
    { error: null },
    { error: string },
    { ids: number[] },
    { prevData: any }
  >({
    mutationFn: async ({ ids }) => await setViewed({ ids, site }),
    onMutate: async ({ ids }) => {
      await queryClient.cancelQueries({ queryKey: [site, "shots"] });
      const prevData = await queryClient.getQueryData([site, "shots"]);

      queryClient.setQueryData<InfiniteData<shotData, unknown>>(
        [site, "shots"],
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              shots: page.shots.map((s: shot) =>
                ids.includes(s.id) ? { ...s, viewed: true } : s,
              ),
            })),
          };
        },
      );

      return { prevData };
    },
    onError: async (err, vars, context) => {
      await queryClient.setQueryData([site, "shots"], context?.prevData);
      return err;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [site, "shots"] });
    },
  });

  return {
    mutateViewed: mutateViewed.mutateAsync,
    mutateViwedErr: mutateViewed.error,
    mutatingViewed: mutateViewed.isPending,
    resetViewed: mutateViewed.reset, //clears flags: errors and prevData
  };
}

// Set Confirm Dialog before deleting sites -- as fn drops column including all shots and cron.
export function useMutateSites() {
  //use to delete or add sites and update cache
}

//Updating viewed per shot in other function, and then, also set state to viewed in client state. -- run refetch to check change speed (expensive).
export function useQueryShots(site: string) {
  const shotQuery = useInfiniteQuery<
    shotData,
    string,
    InfiniteData<shotData>,
    [string, string],
    { id: any; next: boolean }
  >({
    queryKey: [site, "shots"],
    queryFn: async ({ pageParam }) => {
      const { id, next } = pageParam;
      //when error: all props besides error will be null;
      const shotData = await getShots({ id, next, site });
      return shotData;
    },
    getNextPageParam: (lastPage) => ({
      id: lastPage.nextCursor,
      next: true,
    }),
    getPreviousPageParam: (firstPage) => ({
      id: firstPage.prevCursor,
      next: false,
    }),
    initialPageParam: { id: null, next: true },
    staleTime: 60000 * 10, //increasing staleTime -- refetches do not need to be performed in auto -- will use refetch to handle viewed.
  });

  return {
    shotsFetching: shotQuery.isFetching, //(true for any request ) -- fetchingNextShots suffices for that.
    shotsRefetching: shotQuery.isRefetching,
    shotsLoading: shotQuery.isLoading,
    shotsError: shotQuery.error,
    fetchNextShots: shotQuery.fetchNextPage,
    fetchPrevShots: shotQuery.fetchPreviousPage,
    fetchingNextShots: shotQuery.isFetchingNextPage,
    fetchingPrevShots: shotQuery.isFetchingPreviousPage,
    shots: shotQuery.data,
    shotsRefetch: shotQuery.refetch,
  };
}

export function useQuerySites() {
  //isFetching = true when fetching in background.
  const { isLoading, error, data, isFetching, refetch } = useQuery<
    siteData[],
    string
  >({
    queryKey: ["sites"],
    queryFn: async () => {
      const userSites = (await getSites()).userSites as siteData[];
      return userSites;
    },
    staleTime: Infinity,
  });

  return {
    sitesLoading: isLoading,
    sitesError: error,
    sites: data,
    sitesFetching: isFetching,
    sitesRefetch: refetch,
  };
}
