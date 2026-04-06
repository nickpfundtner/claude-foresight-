'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useOverview } from '@/lib/hooks/useOverview'
import { useCustomers, CustomerSummary } from '@/lib/hooks/useCustomers'
import StatCard from '@/components/dashboard/StatCard'
import LineChart from '@/components/dashboard/LineChart'
import BarChart from '@/components/dashboard/BarChart'
import DonutChart from '@/components/dashboard/DonutChart'
import SpendBarChart from '@/components/dashboard/SpendBarChart'
import CustomerTable from '@/components/dashboard/CustomerTable'
import UrgencyStrip from '@/components/dashboard/UrgencyStrip'
import OutreachDrawer from '@/components/outreach/OutreachDrawer'
import Toast from '@/components/ui/Toast'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, type: 'spring' as const, stiffness: 300, damping: 30 },
  }),
}

export default function DashboardPage() {
  const { data: overview, isLoading: overviewLoading } = useOverview()
  const { data: customers = [], isLoading: customersLoading } = useCustomers()
  const [drawerCustomer, setDrawerCustomer] = useState<CustomerSummary | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const highRiskCount = customers.filter((c) => c.churn_risk === 'High').length
  const mediumCount = customers.filter((c) => c.churn_risk === 'Medium').length
  const lowCount = customers.filter((c) => c.churn_risk === 'Low').length

  return (
    <>
      <div className="space-y-6 max-w-7xl">
        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          className="text-2xl font-bold text-ftext"
        >
          Dashboard
        </motion.h1>

        {!customersLoading && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            <UrgencyStrip count={highRiskCount} />
          </motion.div>
        )}

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          className="grid grid-cols-2 xl:grid-cols-4 gap-4"
        >
          <StatCard label="Total Customers" value={overview?.total_customers ?? 0} maxValue={500} color="var(--p0)" loading={overviewLoading} />
          <StatCard label="High Churn Risk" value={overview?.high_risk_count ?? 0} maxValue={overview?.total_customers ?? 1} color="var(--pd1)" thresholdPct={0.8} loading={overviewLoading} />
          <StatCard label="Total Revenue" value={overview?.total_revenue ?? 0} maxValue={50000} color="var(--p1)" prefix="$" loading={overviewLoading} />
          <StatCard label="Avg Visits" value={overview?.avg_visits_per_customer ?? 0} maxValue={20} color="var(--p2)" decimals={1} loading={overviewLoading} />
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
          className="grid grid-cols-1 xl:grid-cols-2 gap-6"
        >
          <LineChart />
          <BarChart />
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={4}
          className="grid grid-cols-1 xl:grid-cols-2 gap-6"
        >
          <DonutChart low={lowCount} medium={mediumCount} high={highRiskCount} />
          <SpendBarChart />
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={5}
          className="bg-surface rounded-2xl border border-white/5 p-6"
        >
          <h2 className="text-sm font-semibold text-ftext mb-4">Customers</h2>
          <CustomerTable
            customers={customers}
            loading={customersLoading}
            onOutreach={setDrawerCustomer}
          />
        </motion.div>
      </div>

      <OutreachDrawer
        isOpen={drawerCustomer !== null}
        customer={drawerCustomer}
        onClose={() => setDrawerCustomer(null)}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
