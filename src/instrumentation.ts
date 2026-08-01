export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recoverAndKickExtractionWorker } = await import(
      "@/lib/extraction-worker"
    );
    await recoverAndKickExtractionWorker();
  }
}
