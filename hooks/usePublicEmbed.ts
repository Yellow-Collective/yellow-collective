import { isInMiniApp } from "@/utils/farcasterMiniApp";
import { useEffect, useState } from "react";

export const detectPublicEmbed = async (): Promise<boolean> => {
  if (typeof window === "undefined" || window.self === window.top) return false;

  try {
    if (window.parent.location.origin === window.location.origin) return false;
  } catch {
    // Reading a cross-origin parent's location is intentionally prohibited.
  }

  try {
    return !(await isInMiniApp());
  } catch {
    return true;
  }
};

export const usePublicEmbed = () => {
  const [isPublicEmbed, setIsPublicEmbed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void detectPublicEmbed().then((detected) => {
      if (!cancelled) setIsPublicEmbed(detected);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isPublicEmbed;
};
