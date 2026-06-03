import { ConnectButton } from "@rainbow-me/rainbowkit";
import Button from "./Button";
import { Address, useDisconnect } from "wagmi";
import clsx from "clsx";
import Link from "next/link";
import WalletInfo from "./WalletInfo";
import { useEffect, useRef, useState } from "react";
import { useMiniAppWalletConnect } from "@/hooks/useMiniAppWalletConnect";

export type CustomConnectButtonProps = {
  className: string;
  menuPlacement?: "top" | "bottom";
};

const CustomConnectButton = ({
  className,
  menuPlacement = "bottom",
}: CustomConnectButtonProps) => {
  const { disconnect } = useDisconnect();
  const {
    connectMiniAppWallet,
    isConnectingMiniApp,
    isMiniApp,
    openInBrowser,
    openInRainbow,
  } = useMiniAppWalletConnect();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMiniAppOptionsOpen, setIsMiniAppOptionsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const connectButtonClassName = clsx("yc-connect-wallet-button", className);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsMiniAppOptionsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
    };
  }, []);

  return (
    <ConnectButton.Custom>
      {({ account, chain, openChainModal, openConnectModal, mounted }) => {
        return (
          <div
            {...(!mounted && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!mounted || !account || !chain) {
                if (isMiniApp) {
                  return (
                    <div className="relative" ref={menuRef}>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setIsMiniAppOptionsOpen((isOpen) => !isOpen)
                        }
                        className={connectButtonClassName}
                        aria-haspopup="menu"
                        aria-expanded={isMiniAppOptionsOpen}
                      >
                        Connect
                      </Button>
                      <div
                        className={clsx(
                          "absolute right-0 z-50 flex w-[250px] flex-col gap-2 rounded-2xl border border-skin-stroke bg-skin-muted p-2 shadow-lg",
                          menuPlacement === "top"
                            ? "bottom-full mb-2"
                            : "top-full mt-2",
                          isMiniAppOptionsOpen ? "visible" : "invisible"
                        )}
                        role="menu"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setIsMiniAppOptionsOpen(false);
                            openInRainbow();
                          }}
                          className="rounded-xl px-4 py-3 text-left font-bold text-primary transition hover:bg-[#fff7bf]"
                          role="menuitem"
                        >
                          Open in Rainbow
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMiniAppOptionsOpen(false);
                            openInBrowser();
                          }}
                          className="rounded-xl px-4 py-3 text-left font-bold text-primary transition hover:bg-[#fff7bf]"
                          role="menuitem"
                        >
                          Open in browser
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMiniAppOptionsOpen(false);
                            connectMiniAppWallet();
                          }}
                          disabled={isConnectingMiniApp}
                          className="rounded-xl bg-skin-button-accent px-4 py-3 text-left font-bold text-skin-inverted transition hover:bg-skin-button-accent-hover disabled:opacity-60"
                          role="menuitem"
                        >
                          {isConnectingMiniApp
                            ? "Connecting..."
                            : "Continue with Farcaster Wallet"}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <Button
                    variant="secondary"
                    onClick={openConnectModal}
                    className={connectButtonClassName}
                  >
                    Connect
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button
                    variant="negative"
                    onClick={openChainModal}
                    className={className}
                  >
                    Wrong network
                  </Button>
                );
              }
              return (
                <div className="group relative" ref={menuRef}>
                  <Button
                    variant="secondary"
                    className={clsx(
                      "flex flex-row gap-2",
                      connectButtonClassName
                    )}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
                  >
                    <WalletInfo
                      address={account.address as Address}
                      size="sm"
                    />
                  </Button>
                  <div
                    className={clsx(
                      "absolute right-0 z-50 flex min-w-[190px] translate-y-2 flex-col rounded-2xl border border-skin-stroke bg-skin-muted p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
                      menuPlacement === "top"
                        ? "bottom-full mb-2"
                        : "top-full mt-2",
                      isMenuOpen
                        ? "visible translate-y-0 opacity-100"
                        : "invisible"
                    )}
                  >
                    <Link
                      href={`/profile/${account.address}`}
                      onClick={() => setIsMenuOpen(false)}
                      className="header-dropdown-item rounded-xl px-4 py-3 font-bold text-primary transition hover:bg-[#fff7bf]"
                    >
                      <h6>View profile</h6>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        disconnect();
                        setIsMenuOpen(false);
                      }}
                      className="rounded-xl px-4 py-3 text-left font-bold text-negative transition hover:bg-negative hover:text-white"
                    >
                      <h6>Disconnect wallet</h6>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default CustomConnectButton;
