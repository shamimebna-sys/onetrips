import { initialsFromName } from "./initials";

export { initialsFromName };

type CustomerAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md";
};

export function CustomerAvatar({ name, photoUrl, size = "md" }: CustomerAvatarProps) {
  const dim = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" className={`${dim} rounded-full object-cover`} />
    );
  }
  return (
    <span className={`inline-flex ${dim} items-center justify-center rounded-full bg-ink font-black text-white`} aria-hidden>
      {initialsFromName(name)}
    </span>
  );
}
