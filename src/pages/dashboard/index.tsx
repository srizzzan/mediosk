import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'

export default function DashboardRedirect() {
  return null
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  const role = (session as any).user?.role
  if (role === 'PATIENT') return { redirect: { destination: '/dashboard/patient', permanent: false } }
  if (role === 'DOCTOR') return { redirect: { destination: '/dashboard/doctor', permanent: false } }
  if (role === 'HOSPITAL') return { redirect: { destination: '/dashboard/hospital', permanent: false } }
  return { redirect: { destination: '/login', permanent: false } }
}
