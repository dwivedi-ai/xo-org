import { SiteHeader } from "@/components/site-header"
import { SessionView } from "./session-view"

export default async function ViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <>
      <SiteHeader title="Session" />
      <SessionView sessionId={id} />
    </>
  )
}
