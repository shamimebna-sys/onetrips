import { SkeletonBlock } from "@onetrips/ui";

export default function AccountLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <SkeletonBlock rows={5} />
    </div>
  );
}
