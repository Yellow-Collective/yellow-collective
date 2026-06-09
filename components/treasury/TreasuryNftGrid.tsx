export type TreasuryNftItem = {
  id: string;
  name: string;
  imageUrl?: string;
  explorerUrl?: string;
};

type TreasuryNftGridProps = {
  nfts: TreasuryNftItem[];
  totalCount?: number;
};

export default function TreasuryNftGrid({
  nfts,
  totalCount,
}: TreasuryNftGridProps) {
  const visibleNfts = nfts.slice(0, 8);
  const resolvedTotal = totalCount ?? nfts.length;
  const remainingCount = Math.max(resolvedTotal - visibleNfts.length, 0);

  return (
    <section className="rounded-2xl border border-skin-stroke bg-skin-muted p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl leading-none">NFTs</h2>
          <p className="mt-2 text-sm leading-snug text-secondary">
            Treasury collectibles and membership assets.
          </p>
        </div>
        <span className="font-heading text-xl leading-none">
          {resolvedTotal > 0 ? resolvedTotal : "--"}
        </span>
      </div>

      {visibleNfts.length > 0 ? (
        <div className="mt-5 grid grid-cols-4 gap-2">
          {visibleNfts.map((nft) => {
            const tile = (
              <div className="aspect-square overflow-hidden rounded-xl border border-skin-stroke bg-white">
                {nft.imageUrl ? (
                  <img
                    src={nft.imageUrl}
                    alt={nft.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#fff7bf] p-2 text-center font-heading text-sm leading-tight">
                    {nft.name}
                  </div>
                )}
              </div>
            );

            return nft.explorerUrl ? (
              <a
                key={nft.id}
                href={nft.explorerUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`View ${nft.name}`}
              >
                {tile}
              </a>
            ) : (
              <div key={nft.id}>{tile}</div>
            );
          })}

          {remainingCount > 0 && (
            <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-skin-stroke bg-white font-heading text-xl">
              +{remainingCount}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-skin-stroke bg-white p-6 text-center">
          <div className="font-heading text-xl leading-none">
            No NFTs indexed
          </div>
          <p className="mt-2 text-sm leading-snug text-secondary">
            NFT holdings will appear here once a narrow treasury NFT source is
            wired.
          </p>
        </div>
      )}
    </section>
  );
}
