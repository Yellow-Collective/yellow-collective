import AddressLink from "@/components/AddressLink";
import Layout from "@/components/Layout";
import {
  getExplorerAddressUrl,
  YELLOW_COLLECTIVE_CONTRACT_LIST,
} from "data/contracts";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

const githubUrl = "https://github.com/BuilderOSS";

export default function ContractsPage() {
  const router = useRouter();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [clipboardUnavailableAddress, setClipboardUnavailableAddress] =
    useState<string | null>(null);

  const copyAddress = async (address: string) => {
    setCopiedAddress(null);
    setClipboardUnavailableAddress(null);
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress(null), 1400);
    } catch {
      setClipboardUnavailableAddress(address);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Smart Contracts | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 pb-12">
        <div className="flex max-w-[980px] flex-col gap-7">
          <h1 className="text-[36px] leading-none md:text-[44px]">
            Smart Contracts
          </h1>
          <p className="text-base leading-snug text-skin-base md:text-lg">
            You can find the latest information on the Nouns Builder protocol on{" "}
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="font-bold underline decoration-2 underline-offset-4"
            >
              Github
            </a>{" "}
            <ArrowTopRightOnSquareIcon className="mb-1 inline h-4 w-4" />.
            Upgrades to these smart contracts can be completed by submitting a
            proposal to the DAO, and requires a successful vote to execute.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {YELLOW_COLLECTIVE_CONTRACT_LIST.map((contract) => (
            <div
              key={contract.address}
              className="grid items-center gap-4 md:grid-cols-[240px_1fr]"
            >
              <h2 className="font-heading text-2xl leading-none">
                {contract.name === "Collective Nouns NFT"
                  ? "NFT"
                  : contract.name}
              </h2>

              <div className="flex min-h-[88px] items-center justify-between gap-4 rounded-2xl border border-skin-stroke bg-skin-muted px-6 py-5 shadow-sm">
                <div className="min-w-0 select-text break-all text-base text-skin-base md:text-lg">
                  <AddressLink
                    address={contract.address}
                    fallback="full"
                    link={false}
                  />
                </div>

                <div className="flex shrink-0 items-center gap-4 text-secondary">
                  <a
                    href={getExplorerAddressUrl(contract.address)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${contract.name} on explorer`}
                    className="transition hover:text-skin-base"
                  >
                    <ArrowTopRightOnSquareIcon className="h-6 w-6" />
                  </a>
                  <button
                    type="button"
                    onClick={() => copyAddress(contract.address)}
                    aria-label={`Copy ${contract.name} address`}
                    className="relative transition hover:text-skin-base"
                  >
                    <ClipboardDocumentIcon className="h-6 w-6" />
                    {copiedAddress === contract.address && (
                      <span className="absolute right-0 top-9 rounded-md border border-skin-stroke bg-skin-muted px-2 py-1 text-sm text-skin-base shadow-sm">
                        Copied
                      </span>
                    )}
                  </button>
                </div>
              </div>
              {clipboardUnavailableAddress === contract.address && (
                <div
                  role="status"
                  className="rounded-xl border border-skin-stroke bg-skin-muted p-4 text-sm text-skin-base md:col-start-2"
                >
                  <p>
                    Copy is unavailable in this browser or embedded view. Select
                    the address to copy it manually, or open this page in a new
                    tab.
                  </p>
                  <a
                    href={router.asPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-bold underline underline-offset-4"
                  >
                    Open Yellow Collective
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
