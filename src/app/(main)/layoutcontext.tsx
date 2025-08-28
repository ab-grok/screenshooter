"use client";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

type shotFields = "cHtml" | "cShot" | "eHtml" | "eShot";

export type shot = Record<shotFields, string | file>;
export type multiShots = Record<number, shot[]>;
export type file = {
  fileName: string;
  fileData: string;
  fileType: string;
};

type errBox = { msg: string; danger: boolean };
type rootContextType = {
  errBox: errBox;
  setErrBox: Dispatch<SetStateAction<errBox>>;
  shots: multiShots;
  setShots: Dispatch<SetStateAction<multiShots>>;
};

const RootContext = createContext({} as rootContextType);

export function useRootContext() {
  return useContext(RootContext);
}

type RootLayoutType = {
  // error: string;
};

export function RootLayoutContext({
  children,
}: React.PropsWithChildren<RootLayoutType>) {
  const [errBox, setErrBox] = useState({} as errBox);
  const [shots, setShots] = useState({} as multiShots);

  return (
    <RootContext.Provider value={{ errBox, setErrBox, shots, setShots }}>
      {" "}
      {children}
    </RootContext.Provider>
  );
}
