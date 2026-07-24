import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-6 py-12">
      <Spinner />
    </div>
  );
}
