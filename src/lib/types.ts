export type shot = {
  id: number;
  html: string;
  file: file;
  date: string; //sql timestamptz
  viewed: boolean;
};

export type downloadProps = {
  unviewed?: boolean;
  user?: string;
  site?: string;
  id?: number;
  next?: boolean;
};

export type multiShots = {
  site: string;
  shots: shotData[];
};

export type file = {
  fileName: string;
  fileData: string; //base64 or text
  fileType: string;
  date?: string | Date; //date is not defined when used in getShots
};

export type deletionAttempt = {
  due: Date;
  message: string;
};

export type shotData = {
  shots: shot[];
  nextCursor: number;
  prevCursor: number;
  noMoreNext: boolean;
  noMorePrev: boolean;
  // error: string;
};

export type siteData = {
  cron: string;
  site: string;
  range: { start: number; end: number };
  active: boolean;
};

export type unviewedType = {
  site: string;
  unvieweds: number;
};

export type handleViewed = {
  id?: number;
  viewSelectedShots?: boolean;
};

export type optimisticUnvieweds = {
  delCount?: number;
  allUnvieweds?: unviewedType[];
};

export type selectedShot = {
  id?: number;
  swiperId?: number;
};

export type delShotType = {
  ids: number | number[];
  site?: string;
};

export type range = { start: number; end: number } | null;

export type userSites = {
  sites: siteData;
}[];

export type queryData = {
  pages: shotData[];
  pageParam: { id: number; next: boolean };
};
