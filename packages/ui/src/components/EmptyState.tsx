import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  plain?: boolean;
};

export function EmptyState({ title, description, action, plain = false }: EmptyStateProps) {
  return (
    <div className={plain ? "text-center" : "rounded-2xl border border-line bg-white p-8 text-center md:p-10"}>
      <h2 className="text-lg font-bold tracking-tight text-copy md:text-xl">{title}</h2>
      {description ? <p className="mt-2 text-sm font-medium text-copy-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
