import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// Mirrors lib/calculations.ts (DEFAULT_FEE_RULE) so seeded demo jobs match the
// live percent-based fee model. Inlined because the seed runs under tsx without
// the '@/...' path alias.
const MIN_DP = 20_000;
const DEFAULT_FEE = {
  platformFeePercent: 10,
  dpPercent: 30,
  minDpThresholdAmount: 2_000_000,
  highValueDpPercent: 50,
};

const providers = [
  {
    name: 'Budi Santoso',
    email: 'budi@example.com',
    phone: '628110000001',
    category: 'Tukang Ledeng',
    districts: ['Depok', 'Ngaglik', 'Mlati'],
    dailyRate: 150000,
    goPayNumber: '081234567890',
    bio: 'Spesialis instalasi & perbaikan pipa air, pompa, dan saluran. 8 tahun pengalaman menangani rumah tinggal di seputaran DIY.',
    rating: 4.9,
    ratingCount: 132,
    completedJobs: 148,
    latitude: -7.7956,
    longitude: 110.3695,
  },
  {
    name: 'Agus Pratama',
    email: 'agus@example.com',
    phone: '628110000002',
    category: 'Tukang Listrik',
    districts: ['Gondokusuman', 'Umbulharjo', 'Mergangsan'],
    dailyRate: 180000,
    goPayNumber: '081298765432',
    bio: 'Pemasangan instalasi listrik baru, penambahan daya, dan perbaikan korsleting. Bersertifikat & mengutamakan keselamatan.',
    rating: 4.8,
    ratingCount: 97,
    completedJobs: 110,
    latitude: -7.7828,
    longitude: 110.3755,
  },
  {
    name: 'Siti Rahayu',
    email: 'siti@example.com',
    phone: '628110000003',
    category: 'Pembersih Rumah',
    districts: ['Kasihan', 'Sewon', 'Banguntapan'],
    dailyRate: 120000,
    goPayNumber: '081211223344',
    bio: 'Layanan bersih-bersih menyeluruh: dapur, kamar mandi, hingga general cleaning pasca renovasi. Rapi, cepat, terpercaya.',
    rating: 5.0,
    ratingCount: 64,
    completedJobs: 71,
    latitude: -7.8012,
    longitude: 110.3642,
  },
  {
    name: 'Bambang Wijaya',
    email: 'bambang@example.com',
    phone: '628110000004',
    category: 'Tukang Kebun',
    districts: ['Ngaglik', 'Kalasan'],
    dailyRate: 110000,
    goPayNumber: '081255667788',
    bio: 'Perawatan taman, pemangkasan, dan penataan tanaman hias. Membuat halaman Anda kembali asri.',
    rating: 4.7,
    ratingCount: 41,
    completedJobs: 53,
    latitude: -7.77,
    longitude: 110.378,
  },
  {
    name: 'Eko Nugroho',
    email: 'eko@example.com',
    phone: '628110000005',
    category: 'Tukang Bangunan',
    districts: ['Gamping', 'Kasihan', 'Mlati'],
    dailyRate: 200000,
    goPayNumber: '081299887766',
    bio: 'Renovasi, pengecatan, pasang keramik, dan pekerjaan tukang umum. Hasil rapi sesuai anggaran.',
    rating: 4.6,
    ratingCount: 58,
    completedJobs: 67,
    latitude: -7.81,
    longitude: 110.355,
  },
];

/** Snapshot financials for a job, mirroring lib/calculations.ts (percent-based). */
function financials(dailyRate: number, days: number) {
  const subtotal = dailyRate * days;
  const dpPct =
    subtotal > DEFAULT_FEE.minDpThresholdAmount
      ? DEFAULT_FEE.highValueDpPercent
      : DEFAULT_FEE.dpPercent;
  const dpAmount = Math.min(subtotal, Math.max(Math.floor((subtotal * dpPct) / 100), MIN_DP));
  const platformCommission = Math.floor((subtotal * DEFAULT_FEE.platformFeePercent) / 100);
  const providerPayout = subtotal - platformCommission;
  const remainingAmount = subtotal - dpAmount;
  return { totalFee: subtotal, dpAmount, platformCommission, providerPayout, remainingAmount };
}

async function main() {
  console.log('🌱 Seeding database...');

  // Order matters because of FK relations.
  await prisma.auditLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany(); // cascades PaymentEvent/Payout/RefundRequest
  await prisma.job.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.fraudFlag.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.feeConfig.deleteMany();

  // Fee rules (percent-based, configurable per category). DEFAULT is the
  // platform-wide fallback; the category override demonstrates per-category fees.
  const defaultFeeConfig = await prisma.feeConfig.create({
    data: {
      category: 'DEFAULT',
      platformFeePercent: DEFAULT_FEE.platformFeePercent,
      dpPercent: DEFAULT_FEE.dpPercent,
      minDpThresholdAmount: DEFAULT_FEE.minDpThresholdAmount,
      highValueDpPercent: DEFAULT_FEE.highValueDpPercent,
    },
  });
  await prisma.feeConfig.create({
    data: {
      category: 'Tukang Bangunan',
      platformFeePercent: 8,
      dpPercent: 40,
      minDpThresholdAmount: 3_000_000,
      highValueDpPercent: 50,
    },
  });

  const createdProfiles: { id: string; dailyRate: number }[] = [];
  for (const p of providers) {
    const user = await prisma.user.create({
      data: {
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: 'PROVIDER',
        providerProfile: {
          create: {
            category: p.category,
            districts: p.districts,
            dailyRate: p.dailyRate,
            goPayNumber: p.goPayNumber,
            payoutMethod: 'gopay',
            payoutDetails: { phone: p.goPayNumber },
            isVerified: true,
            kycStatus: 'APPROVED',
            available: true,
            bio: p.bio,
            rating: p.rating,
            ratingCount: p.ratingCount,
            completedJobs: p.completedJobs,
            latitude: p.latitude,
            longitude: p.longitude,
          },
        },
      },
      include: { providerProfile: true },
    });
    if (user.providerProfile) {
      createdProfiles.push({
        id: user.providerProfile.id,
        dailyRate: user.providerProfile.dailyRate,
      });
    }
  }

  // An admin account so the KYC panel is reachable locally. Login-testable via
  // WhatsApp OTP on phone 628130000001 (role is ADMIN).
  await prisma.user.create({
    data: {
      name: 'Admin gegarap',
      email: 'admin@gegarap.id',
      phone: '628130000001',
      role: 'ADMIN',
    },
  });

  // A provider awaiting KYC, so the admin review queue isn't empty.
  await prisma.user.create({
    data: {
      name: 'Calon Tukang (Pending)',
      email: 'pending@example.com',
      phone: '628110000099',
      role: 'PROVIDER',
      providerProfile: {
        create: {
          category: 'Tukang Bangunan',
          districts: ['Depok', 'Mlati'],
          dailyRate: 175000,
          goPayNumber: '081200001111',
          payoutMethod: 'gopay',
          payoutDetails: { phone: '081200001111' },
          isVerified: false,
          kycStatus: 'PENDING',
          ktpImageUrl: 'dev/ktp-placeholder',
          bio: 'Menunggu verifikasi admin — contoh data untuk menguji alur KYC.',
        },
      },
    },
  });

  // A demo customer so the customer dashboard isn't empty. Login-testable via
  // WhatsApp OTP on phone 628120000001.
  const customer = await prisma.user.create({
    data: {
      name: 'Pak Susanto',
      email: 'susanto@example.com',
      phone: '628120000001',
      phoneNumber: '08120000001',
      role: 'CUSTOMER',
    },
  });

  const demoJobs = [
    {
      address: 'Jl. Kaliurang KM 5, Sleman',
      district: 'Ngaglik',
      description: 'Keran dapur bocor & saluran air mampet.',
      days: 2,
      timeSlot: 'pagi',
      status: 'PENDING',
      paymentStatus: 'PENDING',
    },
    {
      address: 'Perum Griya Asri No. 12, Bantul',
      district: 'Sewon',
      description: 'Pemasangan instalasi listrik tambahan di garasi.',
      days: 3,
      timeSlot: 'siang',
      status: 'IN_PROGRESS',
      paymentStatus: 'PAID',
    },
    {
      address: 'Jl. Magelang KM 7, Sleman',
      district: 'Mlati',
      description: 'General cleaning pasca renovasi.',
      days: 1,
      timeSlot: 'sore',
      status: 'COMPLETED',
      paymentStatus: 'DISBURSED',
    },
  ];

  for (let i = 0; i < demoJobs.length && i < createdProfiles.length; i++) {
    const profile = createdProfiles[i];
    const d = demoJobs[i];
    const fin = financials(profile.dailyRate, d.days);
    const scheduledDate = new Date(Date.now() + (i + 1) * 86_400_000);

    const paymentData =
      d.paymentStatus === 'PENDING'
        ? { status: 'PENDING' as const }
        : d.paymentStatus === 'PAID'
          ? { status: 'PAID' as const, paidAt: new Date(), midtransPaymentType: 'gopay' }
          : {
              status: 'DISBURSED' as const,
              paidAt: new Date(Date.now() - 2 * 86_400_000),
              midtransPaymentType: 'gopay',
              disbursedAt: new Date(),
              disbursedAmount: fin.providerPayout,
              platformFeeCharged: fin.platformCommission,
            };

    const job = await prisma.job.create({
      data: {
        customerId: customer.id,
        providerProfileId: profile.id,
        status: d.status,
        description: d.description,
        estimatedDays: d.days,
        customerAddress: d.address,
        customerWaNumber: '08120000001',
        district: d.district,
        scheduledDate,
        timeSlot: d.timeSlot,
        dailyRate: profile.dailyRate,
        totalFee: fin.totalFee,
        dpAmount: fin.dpAmount,
        platformCommission: fin.platformCommission,
        providerPayout: fin.providerPayout,
        payment: {
          create: {
            amount: fin.dpAmount,
            type: 'DP',
            customerId: customer.id,
            providerProfileId: profile.id,
            dpAmount: fin.dpAmount,
            remainingAmount: fin.remainingAmount,
            platformFee: fin.platformCommission,
            providerAmount: fin.providerPayout,
            feeConfigId: defaultFeeConfig.id,
            midtransOrderId: `GGR-SEED-${i}-${Date.now()}`,
            ...paymentData,
          },
        },
      },
    });

    // The completed job gets a review (drives the provider rating display).
    if (d.status === 'COMPLETED') {
      await prisma.review.create({
        data: {
          jobId: job.id,
          userId: customer.id,
          providerProfileId: profile.id,
          rating: 5,
          comment: 'Kerjanya rapi dan cepat, sangat memuaskan. Terima kasih!',
        },
      });
    }
  }

  console.log(
    `✅ Seed completed — ${providers.length} verified providers and ${demoJobs.length} demo jobs.`
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
