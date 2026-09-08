import { GetServerSideProps } from 'next'
import { requireRole } from '../../lib/auth'

export default function DoctorDashboard() {
  return (
    <main className="container py-20">
      <h1 className="text-2xl font-semibold">Doctor Dashboard</h1>
      <p className="text-slate-600">Protected route for role: DOCTOR</p>
    </main>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return requireRole(ctx, 'DOCTOR')
}
