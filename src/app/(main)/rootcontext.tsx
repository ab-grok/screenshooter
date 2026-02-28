"use client";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

// Each component can render a site having it's own state, no need for general storage in context

type errBox = { msg: string; danger: boolean };
type rootContextType = {
  errBox: errBox;
  setErrBox: Dispatch<SetStateAction<errBox>>;
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

  return (
    <RootContext.Provider value={{ errBox, setErrBox }}>
      {" "}
      {children}
    </RootContext.Provider>
  );
}
