"use client";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

type errLog = { msg: string; danger: boolean };
type rootContextType = {
  errLog: errLog;
  setErrLog: Dispatch<SetStateAction<errLog>>;
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
  const [errLog, setErrLog] = useState({} as errLog);

  return (
    <RootContext.Provider value={{ errLog, setErrLog }}></RootContext.Provider>
  );
}
