import { getSession } from 'next-auth/react'
import { GetServerSidePropsContext } from 'next'

export async function requireRole(ctx: GetServerSidePropsContext, role: string) {
  const session = await getSession(ctx)
  if (!session || (session as any).user?.role !== role) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return { props: { session } }
}
