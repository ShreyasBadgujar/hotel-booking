import React, { useEffect, useState } from 'react'
import { assets } from '../../assets/assets'
import Title from '../../components/Title';
import { useAppContext } from '../../context/AppContext';
import aiApi from '../../api/ai';

const Dashboard = () => {

    const { currency, user, getToken, toast, axios, formatPrice } = useAppContext();

    const [dashboardData, setDashboardData] = useState({
        bookings: [],
        totalBookings: 0,
        totalRevenue: 0,
    });

    const [housekeeping, setHousekeeping] = useState({ loading: false, plan: [], params: null });

    const fetchDashboardData = async () => {
        try {
            const { data } = await axios.get('/api/bookings/hotel', { headers: { Authorization: `Bearer ${await getToken()}` } })
            if (data.success) {
                setDashboardData(data.dashboardData)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    useEffect(() => {
        if (user) {
            fetchDashboardData();
            (async () => {
                try {
                    setHousekeeping((s) => ({ ...s, loading: true }));
                    const res = await aiApi.getHousekeepingPlan({ days: 7 });
                    if (res.success) {
                        setHousekeeping({ loading: false, plan: res.plan, params: res.params });
                    } else {
                        setHousekeeping({ loading: false, plan: [], params: null });
                    }
                } catch (e) {
                    setHousekeeping({ loading: false, plan: [], params: null });
                }
            })();
        }
    }, [user]);

    return (
        <div>
            <Title align='left' font='outfit' title='Dashboard' subTitle='Monitor your room listings, track bookings and analyze revenue—all in one place. Stay updated with real-time insights to ensure smooth operations.' />
            <div className='flex gap-4 my-8'>
                <div className='bg-primary/3 border border-primary/10 rounded flex p-4 pr-8'>
                    <img className='max-sm:hidden h-10' src={assets.totalBookingIcon} alt="" />
                    <div className='flex flex-col sm:ml-4 font-medium'>
                        <p className='text-blue-500 text-lg'>Total Bookings</p>
                        <p className='text-neutral-400 text-base'>{ dashboardData.totalBookings }</p>
                    </div>
                </div>
                <div className='bg-primary/3 border border-primary/10 rounded flex p-4 pr-8'>
                    <img className='max-sm:hidden h-10' src={assets.totalRevenueIcon} alt="" />
                    <div className='flex flex-col sm:ml-4 font-medium'>
                        <p className='text-blue-500 text-lg'>Total Revenue</p>
                        <p className='text-neutral-400 text-base'>{formatPrice(dashboardData.totalRevenue)}</p>
                    </div>
                </div>
            </div>

            <h2 className='text-xl text-blue-950/70 font-medium mb-5'>Recent Bookings</h2>
            {/* Table with heads User Name, Room Name, Amount Paid, Payment Status */}
            <div className='w-full max-w-3xl text-left border border-gray-300 rounded-lg max-h-80 overflow-y-scroll'>
                <table className='w-full' >
                    <thead className='bg-gray-50'>
                        <tr>
                            <th className='py-3 px-4 text-gray-800 font-medium'>User Name</th>
                            <th className='py-3 px-4 text-gray-800 font-medium max-sm:hidden'>Room Name</th>
                            <th className='py-3 px-4 text-gray-800 font-medium text-center'>Total Amount</th>
                            <th className='py-3 px-4 text-gray-800 font-medium text-center'>Payment Status</th>
                        </tr>
                    </thead>
                    <tbody className='text-sm'>
                        {
                            dashboardData.bookings.map((item, index) => (
                                <tr key={index}>
                                    <td className='py-3 px-4 text-gray-700 border-t border-gray-300'>{item.user.username}</td>
                                    <td className='py-3 px-4 text-gray-400 border-t border-gray-300 max-sm:hidden'>{item.room.roomType}</td>
                                    <td className='py-3 px-4 text-gray-400 border-t border-gray-300 text-center'>{formatPrice(item.totalPrice)}</td>
                                    <td className='py-3 px-4  border-t border-gray-300 flex'>
                                        <button className={`py-1 px-3 text-xs rounded-full mx-auto ${item.isPaid ? "bg-green-200 text-green-600" : "bg-amber-200 text-yellow-600"}`}>
                                            {item.isPaid ? "Completed" : "Pending"}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>

            {/* Housekeeping & Staffing Plan */}
            <div className='mt-8'>
                <h2 className='text-xl text-blue-950/70 font-medium mb-3'>Housekeeping & Staffing (Next 7 days)</h2>
                <div className='w-full max-w-3xl border border-gray-300 rounded-lg p-4'>
                    {housekeeping.loading ? (
                        <p className='text-gray-500 text-sm'>Loading plan…</p>
                    ) : housekeeping.plan.length === 0 ? (
                        <p className='text-gray-500 text-sm'>No plan available.</p>
                    ) : (
                        <ul className='space-y-3'>
                            {housekeeping.plan.map((d) => (
                                <li key={d.date} className='border-b last:border-b-0 pb-3'>
                                    <div className='flex items-center justify-between'>
                                        <p className='font-medium'>{d.date}</p>
                                        <p className='text-sm text-gray-600'>Staff needed: {d.totals.staffNeeded}</p>
                                    </div>
                                    <p className='text-sm text-gray-700 mt-1'>
                                        Checkouts: {d.totals.checkouts} · Stayovers: {d.totals.stayovers} · Checkins: {d.totals.checkins} · Workload: {Math.round(d.totals.workloadMinutes)} min
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

        </div>
    )
}

export default Dashboard
