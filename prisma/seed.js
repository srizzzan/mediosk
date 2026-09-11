const { PrismaClient, Role } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const demoAccounts = [
  {
    email: 'patient@mediosk.demo',
    password: 'Patient@123',
    name: 'Demo Patient',
    role: Role.PATIENT,
    profile: (userId) =>
      prisma.patient.upsert({
        where: { userId },
        update: {},
        create: { userId }
      })
  },
  {
    email: 'doctor@mediosk.demo',
    password: 'Doctor@123',
    name: 'Demo Doctor',
    role: Role.DOCTOR,
    profile: (userId) =>
      prisma.doctor.upsert({
        where: { userId },
        update: {},
        create: { userId }
      })
  },
  {
    email: 'hospital@mediosk.demo',
    password: 'Hospital@123',
    name: 'Demo Hospital',
    role: Role.HOSPITAL,
    profile: (userId) =>
      prisma.hospital.upsert({
        where: { userId },
        update: {},
        create: { userId }
      })
  }
]

async function main() {
  for (const account of demoAccounts) {
    const hashedPassword = await bcrypt.hash(account.password, 12)
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        role: account.role,
        hashedPassword
      },
      create: {
        email: account.email,
        name: account.name,
        role: account.role,
        hashedPassword
      }
    })

    await account.profile(user.id)
  }
}

main()
  .then(() => console.log('Demo accounts seeded.'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
