import type { ReactNode } from "react";

type ErrorStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-[2.5rem] border border-red-100 bg-red-50 p-10 text-center">
      <h2 className="text-xl font-black uppercase tracking-tighter text-red-700">{title}</h2>
      {description ? <p className="mt-3 text-sm font-medium text-red-600">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
