import Layout from "@/components/Layout";
import { getProfilePath } from "@/utils/profile/identity";
import { getDaoMembers, type DaoMember } from "data/members";
import type { GetStaticPropsResult, InferGetStaticPropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";

type MembersPageProps = {
  members: DaoMember[];
};

const MEMBERS_STATIC_GENERATION_TIMEOUT_MS = 20_000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("DAO members request timed out.")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

type SortMode =
  | "name"
  | "tokens"
  | "votingPower"
  | "noundry"
  | "proposalVotes";

const sortOptions: { label: string; value: SortMode }[] = [
  { label: "Name", value: "name" },
  { label: "Tokens owned", value: "tokens" },
  { label: "Voting power", value: "votingPower" },
  { label: "Noundry submissions", value: "noundry" },
  { label: "Proposals voted", value: "proposalVotes" },
];

const hasPrimaryEthName = (member: DaoMember) =>
  Boolean(member.ensName?.toLowerCase().endsWith(".eth"));

const sortMembers = (members: DaoMember[], sort: SortMode) =>
  [...members].sort((first, second) => {
    const nameSort = () => {
      const firstHasEthName = hasPrimaryEthName(first);
      const secondHasEthName = hasPrimaryEthName(second);

      if (firstHasEthName !== secondHasEthName) {
        return firstHasEthName ? -1 : 1;
      }

      if (
        firstHasEthName &&
        secondHasEthName &&
        first.ensName &&
        second.ensName
      ) {
        return first.ensName.localeCompare(second.ensName);
      }

      return first.displayName.localeCompare(second.displayName);
    };

    if (sort === "tokens") {
      return second.tokenCount - first.tokenCount || nameSort();
    }

    if (sort === "votingPower") {
      return second.votingPower - first.votingPower || nameSort();
    }

    if (sort === "noundry") {
      return (
        second.noundrySubmissionCount - first.noundrySubmissionCount ||
        nameSort()
      );
    }

    if (sort === "proposalVotes") {
      return second.proposalVoteCount - first.proposalVoteCount || nameSort();
    }

    return nameSort();
  });

export const getStaticProps = async (): Promise<
  GetStaticPropsResult<MembersPageProps>
> => {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return {
      props: {
        members: [],
      },
      revalidate: 1,
    };
  }

  try {
    return {
      props: {
        members: await withTimeout(
          getDaoMembers(),
          MEMBERS_STATIC_GENERATION_TIMEOUT_MS
        ),
      },
      revalidate: 300,
    };
  } catch (error) {
    console.warn("Unable to load DAO members", error);

    return {
      props: {
        members: [],
      },
      revalidate: 60,
    };
  }
};

export default function MembersPage({
  members,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const [sort, setSort] = useState<SortMode>("name");
  const sortedMembers = useMemo(
    () => sortMembers(members, sort),
    [members, sort]
  );

  return (
    <Layout>
      <Head>
        <title>Members | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 pb-12">
        <section className="yc-dark-yellow-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="text-center md:text-left">
              <h1 className="font-heading text-[42px] leading-none text-skin-base md:text-[58px]">
                Members
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-snug text-[#212529] md:text-lg">
                Current Collective Noun holders. Members with resolved primary
                .eth names are listed first, followed by wallet addresses.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
              <label className="block min-w-[220px]">
                <span className="font-heading text-sm text-secondary">
                  Sort by
                </span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                  className="mt-2 h-12 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 font-heading text-base text-skin-base outline-none transition focus:border-skin-base focus:bg-white"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="yc-members-count-button h-12 w-fit whitespace-nowrap rounded-[18px] bg-accent px-5 font-heading text-xl text-skin-base shadow-[0px_4.02px_0px_0px_#454a4e] transition active:translate-y-1 active:shadow-none"
              >
                {members.length} {members.length === 1 ? "member" : "members"}
              </button>
            </div>
          </div>
        </section>

        {sortedMembers.length > 0 ? (
          <section className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-6">
            {sortedMembers.map((member) => (
              <MemberCard key={member.address} member={member} />
            ))}
          </section>
        ) : (
          <section className="yc-dark-yellow-surface rounded-2xl border border-skin-stroke bg-white p-8 text-center text-base text-secondary shadow-sm md:text-lg">
            Member data is not available right now.
          </section>
        )}
      </div>
    </Layout>
  );
}

const MemberCard = ({ member }: { member: DaoMember }) => {
  const imageUrl = member.avatarUrl || member.firstTokenImage;

  return (
    <Link
      href={getProfilePath({
        address: member.address,
        ensName: member.ensName,
      })}
      className="yc-dark-yellow-surface group flex min-h-full flex-col overflow-hidden rounded-2xl border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none"
    >
      <div className="aspect-square w-full overflow-hidden bg-[#ffcc00]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={member.displayName}
            className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-heading text-5xl text-skin-base">
            YC
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2 sm:gap-3 sm:p-4">
        <div className="min-w-0">
          <h2 className="truncate font-heading text-sm leading-none text-skin-base sm:text-2xl">
            {member.displayName}
          </h2>
          {member.ensName && member.username && (
            <p className="mt-1 truncate text-[11px] leading-tight text-secondary sm:text-sm">
              {member.username}
            </p>
          )}
        </div>
        <div className="-mx-2 -mb-2 mt-auto grid w-[calc(100%+1rem)] grid-cols-4 gap-0 border-t border-skin-stroke text-center sm:-mx-4 sm:-mb-4 sm:w-[calc(100%+2rem)]">
          <MemberStat label="Tokens" value={member.tokenCount} />
          <MemberStat label="Power" value={member.votingPower} />
          <MemberStat label="Traits" value={member.noundrySubmissionCount} />
          <MemberStat label="Votes" value={member.proposalVoteCount} />
        </div>
      </div>
    </Link>
  );
};

const MemberStat = ({ label, value }: { label: string; value: number }) => (
  <span className="border-r border-skin-stroke bg-[#fff7bf] px-1 py-2 last:border-r-0 sm:px-2 sm:py-3">
    <span className="block font-heading text-xs leading-none text-skin-base sm:text-lg">
      {value}
    </span>
    <span className="mt-1 block text-[9px] leading-none text-secondary sm:text-[11px]">
      {label}
    </span>
  </span>
);
