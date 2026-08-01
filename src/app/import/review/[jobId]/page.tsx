import { ExtractionReview } from "@/components/import/ExtractionReview";

type Props = { params: Promise<{ jobId: string }> };

export default async function ReviewJobPage({ params }: Props) {
  const { jobId } = await params;
  return <ExtractionReview jobId={jobId} />;
}
