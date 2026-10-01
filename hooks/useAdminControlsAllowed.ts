import { detectPublicEmbed } from "@/hooks/usePublicEmbed";
import { useEffect, useState } from "react";

export const detectAdminControlsAllowed = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  return !(await detectPublicEmbed());
};

export const useAdminControlsAllowed = () => {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void detectAdminControlsAllowed().then((detected) => {
      if (!cancelled) setAllowed(detected);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return allowed;
};
