import React, { useEffect, useState } from 'react'
import { assets, roomCommonData } from '../assets/assets'
import { useAppContext } from '../context/AppContext';
import { useParams } from 'react-router-dom';
import StarRating from '../components/StarRating';
import toast from 'react-hot-toast';
import aiApi from '../api/ai';

const RoomDetails = () => {
    const { id } = useParams();
    const { facilityIcons, rooms, getToken, axios, navigate, formatPrice } = useAppContext();

    const [room, setRoom] = useState(null);
    const [mainImage, setMainImage] = useState(null);
    const [checkInDate, setCheckInDate] = useState(null);
    const [checkOutDate, setCheckOutDate] = useState(null);
    const [guests, setGuests] = useState(1);

    const [isAvailable, setIsAvailable] = useState(false);
    const [ragPreview, setRagPreview] = useState(null);
    const [ragLoading, setRagLoading] = useState(false);

    const handleRagPreview = async () => {
        try {
            setRagLoading(true);
            console.log('Starting RAG preview...', { room: room?.hotel?.city });
            
            const sampleQuery = `family suite with wifi in ${room?.hotel?.city || 'your city'}`;
            console.log('Sample query:', sampleQuery);
            
            const res = await aiApi.ragSearch(sampleQuery);
            console.log('RAG search response:', res);
            
            if (res.success) {
                setRagPreview({ query: sampleQuery, context: res.context, sources: res.sources });
                console.log('RAG preview set successfully');
                toast.success('RAG context loaded successfully!');
            } else {
                console.error('RAG search failed:', res.message);
                toast.error(res.message || 'RAG search failed');
            }
        } catch (err) {
            console.error('RAG preview error:', err);
            toast.error(err.message || 'Failed to load RAG context');
        } finally {
            setRagLoading(false);
        }
    }

    // Check if the Room is Available
    const checkAvailability = async () => {
        try {

            //  Check is Check-In Date is greater than Check-Out Date
            if (checkInDate >= checkOutDate) {
                toast.error('Check-In Date should be less than Check-Out Date')
                return;
            }

            const { data } = await axios.post('/api/bookings/check-availability', { room: id, checkInDate, checkOutDate })
            if (data.success) {
                if (data.isAvailable) {
                    setIsAvailable(true)
                    toast.success('Room is available')
                } else {
                    setIsAvailable(false)
                    toast.error('Room is not available')
                }
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // onSubmitHandler function to check availability & book the room
    const onSubmitHandler = async (e) => {
        try {
            e.preventDefault();
            if (!isAvailable) {
                return checkAvailability();
            } else {
                const { data } = await axios.post('/api/bookings/book', { room: id, checkInDate, checkOutDate, guests, paymentMethod: "Pay At Hotel" }, { headers: { Authorization: `Bearer ${await getToken()}` } })
                if (data.success) {
                    toast.success(data.message)
                    navigate('/my-bookings')
                    scrollTo(0, 0)
                } else {
                    toast.error(data.message)
                }
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    useEffect(() => {
        const room = rooms.find(room => room._id === id);
        room && setRoom(room);
        room && setMainImage(room.images[0]);
    }, [rooms]);

    return room && (
        <div className='py-28 md:py-35 px-4 md:px-16 lg:px-24 xl:px-32'>

            {/* Room Details */}
            <div className='flex flex-col md:flex-row items-start md:items-center gap-2'>
                <h1 className='text-3xl md:text-4xl font-playfair'>{room.hotel.name} <span className='font-inter text-sm'>({room.roomType})</span></h1>
                <p className='text-xs font-inter py-1.5 px-3 text-white bg-orange-500 rounded-full'>20% OFF</p>
            </div>
            <div className='flex items-center gap-1 mt-2'>
                <StarRating />
                <p className='ml-2'>200+ reviews</p>
            </div>
            <div className='flex items-center gap-1 text-gray-500 mt-2'>
                <img src={assets.locationIcon} alt='location-icon' />
                <span>{room.hotel.address}</span>
            </div>

            {/* Room Images */}
            <div className='flex flex-col lg:flex-row mt-6 gap-6'>
                <div className='lg:w-1/2 w-full'>
                    <img className='w-full rounded-xl shadow-lg object-cover'
                        src={mainImage} alt='Room Image' />
                </div>

                <div className='grid grid-cols-2 gap-4 lg:w-1/2 w-full'>
                    {room?.images.length > 1 && room.images.map((image, index) => (
                        <img key={index} onClick={() => setMainImage(image)}
                            className={`w-full rounded-xl shadow-md object-cover cursor-pointer ${mainImage === image && 'outline-3 outline-orange-500'}`} src={image} alt='Room Image' />
                    ))}
                </div>
            </div>

            {/* Room Highlights */}
            <div className='flex flex-col md:flex-row md:justify-between mt-10'>
                <div className='flex flex-col'>
                    <h1 className='text-3xl md:text-4xl font-playfair'>Experience Luxury Like Never Before</h1>
                    <div className='flex flex-wrap items-center mt-3 mb-6 gap-4'>
                        {room.amenities.map((item, index) => (
                            <div key={index} className='flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100'>
                                <img src={facilityIcons[item]} alt={item} className='w-5 h-5' />
                                <p className='text-xs'>{item}</p>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Room Price */}
                <p className='text-2xl font-medium'>{formatPrice(room.pricePerNight)}/night</p>
            </div>

            {/* CheckIn CheckOut Form */}
            <form onSubmit={onSubmitHandler} className='flex flex-col md:flex-row items-start md:items-center justify-between bg-white shadow-[0px_0px_20px_rgba(0,0,0,0.15)] p-6 rounded-xl mx-auto mt-16 max-w-6xl'>
                <div className='flex flex-col flex-wrap md:flex-row items-start md:items-center gap-4 md:gap-10 text-gray-500'>
                    <div className='flex flex-col'>
                        <label htmlFor='checkInDate' className='font-medium'>Check-In</label>
                        <input onChange={(e) => setCheckInDate(e.target.value)} id='checkInDate' type='date' min={new Date().toISOString().split('T')[0]} className='w-full rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none' placeholder='Check-In' required />
                    </div>
                    <div className='w-px h-15 bg-gray-300/70 max-md:hidden'></div>
                    <div className='flex flex-col'>
                        <label htmlFor='checkOutDate' className='font-medium'>Check-Out</label>
                        <input onChange={(e) => setCheckOutDate(e.target.value)} id='checkOutDate' type='date' min={checkInDate} disabled={!checkInDate} className='w-full rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none' placeholder='Check-Out' required />
                    </div>
                    <div className='w-px h-15 bg-gray-300/70 max-md:hidden'></div>
                    <div className='flex flex-col'>
                        <label htmlFor='guests' className='font-medium'>Guests</label>
                        <input onChange={(e) => setGuests(e.target.value)} value={guests} id='guests' type='number' className='max-w-20 rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none' placeholder='0' required />
                    </div>
                </div>
                <button type='submit' className='bg-primary hover:bg-primary-dull active:scale-95 transition-all text-white rounded-md max-md:w-full max-md:mt-6 md:px-25 py-3 md:py-4 text-base cursor-pointer'>{isAvailable ? "Book Now" : "Check Availability"}</button>
            </form>

            {/* Common Specifications */}
            <div className='mt-25 space-y-4'>                
                {roomCommonData.map((spec, index) => (
                    <div key={index} className='flex items-start gap-2'>
                        <img className='w-6.5' src={spec.icon} alt={`${spec.title}-icon`} />
                        <div>
                            <p className='text-base'>{spec.title}</p>
                            <p className='text-gray-500'>{spec.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className='max-w-3xl border-y border-gray-300 my-15 py-10 text-gray-500'>
                <p>Guests will be allocated on the ground floor according to availability. You get a comfortable Two bedroom apartment has a true city feeling. The price quoted is for two guest, at the guest slot please mark the number of guests to get the exact price for groups. The Guests will be allocated ground floor according to availability. You get the comfortable two bedroom apartment that has a true city feeling.</p>
            </div>

            {/* Google Maps Location */}
            <div className='mt-10 w-full'>
                <h2 className='text-xl md:text-2xl font-playfair mb-3'>Location</h2>
                <p className='text-gray-600 mb-4'>{room.hotel.address}</p>
                <div className='w-full rounded-xl overflow-hidden shadow-lg border border-gray-200'>
                    {(() => { const mapQuery = `${room.hotel.name}, ${room.hotel.address}${room.hotel.city ? ", " + room.hotel.city : ''}`; return (
                    <iframe
                        title='Hotel Location Map'
                        width='100%'
                        height='360'
                        style={{ border: 0 }}
                        loading='lazy'
                        allowFullScreen
                        referrerPolicy='no-referrer-when-downgrade'
                        src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
                    />) })()}
                </div>
                <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${room.hotel.name}, ${room.hotel.address}${room.hotel.city ? ", " + room.hotel.city : ''}`)}`}
                    target='_blank'
                    rel='noreferrer'
                    className='inline-block mt-3 text-blue-600 hover:underline'
                >
                    View on Google Maps
                </a>
            </div>

            {/* RAG Debug Tools */}
            <div className='mt-8 p-4 border border-dashed border-gray-300 rounded-lg'>
                <div className='flex items-center justify-between gap-4'>
                    <div>
                        <p className='text-sm text-gray-600'>Debug: Preview RAG context (client-side)</p>
                        <p className='text-xs text-gray-500 mt-1'>
                            Status: {ragLoading ? 'Loading...' : ragPreview ? 'Loaded' : 'Not loaded'} | 
                            Room City: {room?.hotel?.city || 'Unknown'}
                        </p>
                    </div>
                    <button onClick={handleRagPreview} disabled={ragLoading}
                        className='px-4 py-2 rounded bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-60 transition-colors'>
                        {ragLoading ? 'Running…' : 'Preview RAG Context'}
                    </button>
                </div>
                {ragPreview && (
                    <div className='mt-4 text-sm'>
                        <div className='mb-3 p-3 bg-green-50 border border-green-200 rounded-lg'>
                            <p className='text-green-800 font-medium'>✅ RAG Context Loaded Successfully!</p>
                            <p className='text-gray-700'><span className='font-medium'>Query:</span> {ragPreview.query}</p>
                            <p className='text-gray-600 text-xs mt-1'>
                                Found {ragPreview.sources?.length || 0} results
                            </p>
                        </div>
                        
                        {/* RAG Results Grouped by City */}
                        <div className='mt-4'>
                            <p className='font-medium mb-3'>Search Results (Grouped by City)</p>
                            
                            {(() => {
                                // Group sources by city
                                const cityGroups = {};
                                
                                ragPreview.sources?.forEach((source) => {
                                    let city = '';
                                    if (source.type === 'hotel') {
                                        city = source.payload.city || 'Unknown';
                                    } else if (source.type === 'room') {
                                        // For rooms, we need to find the hotel's city
                                        // This is a simplified approach - in a real app, you'd want to fetch hotel data
                                        city = 'Unknown'; // We'll need to enhance this
                                    }
                                    
                                    if (!cityGroups[city]) {
                                        cityGroups[city] = { hotels: [], rooms: [] };
                                    }
                                    
                                    if (source.type === 'hotel') {
                                        cityGroups[city].hotels.push(source);
                                    } else {
                                        cityGroups[city].rooms.push(source);
                                    }
                                });

                                return Object.entries(cityGroups)
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([city, group]) => (
                                        <div key={city} className='mb-6 border border-gray-200 rounded-lg overflow-hidden'>
                                            <div className='bg-blue-50 px-4 py-2 border-b border-gray-200'>
                                                <h4 className='font-semibold text-blue-800 text-sm'>{city.toUpperCase()}</h4>
                                            </div>
                                            
                                            <div className='p-4'>
                                                {/* Hotels in this city */}
                                                {group.hotels.length > 0 && (
                                                    <div className='mb-4'>
                                                        <h5 className='font-medium text-gray-700 mb-2 text-sm'>Hotels ({group.hotels.length})</h5>
                                                        <div className='overflow-x-auto'>
                                                            <table className='w-full border-collapse border border-gray-300 text-xs'>
                                                                <thead>
                                                                    <tr className='bg-gray-100'>
                                                                        <th className='border border-gray-300 px-3 py-2 text-left font-medium'>Hotel Name</th>
                                                                        <th className='border border-gray-300 px-3 py-2 text-left font-medium'>Address</th>
                                                                        <th className='border border-gray-300 px-3 py-2 text-left font-medium'>Contact</th>
                                                                        <th className='border border-gray-300 px-3 py-2 text-left font-medium'>Score</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {group.hotels.map((source, i) => (
                                                                        <tr key={`hotel-${source.id}-${i}`} className='hover:bg-gray-50'>
                                                                            <td className='border border-gray-300 px-3 py-2 font-medium'>{source.payload.name}</td>
                                                                            <td className='border border-gray-300 px-3 py-2'>{source.payload.address}</td>
                                                                            <td className='border border-gray-300 px-3 py-2'>{source.payload.contact}</td>
                                                                            <td className='border border-gray-300 px-3 py-2 text-center'>
                                                                                <span className='bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs'>
                                                                                    {source.score}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Rooms in this city */}
                                                {group.rooms.length > 0 && (
                                                    <div>
                                                        <h5 className='font-medium text-gray-700 mb-2 text-sm'>Rooms ({group.rooms.length})</h5>
                                                        <div className='overflow-x-auto'>
                                                            <table className='w-full border-collapse border border-gray-300 text-xs'>
                                                                <thead>
                                                                    <tr className='bg-gray-100'>
                                                                        <th className='border border-gray-300 px-3 py-2 text-left font-medium'>Room Type</th>
                                                                        <th className='border border-gray-300 px-3 py-2 text-left font-medium'>Price/Night</th>
                                                                        <th className='border border-gray-300 px-3 py-2 text-left font-medium'>Amenities</th>
                                                                        <th className='border border-gray-300 px-3 py-2 text-left font-medium'>Hotel</th>
                                                                        <th className='border border-gray-300 px-3 py-2 text-left font-medium'>Score</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {group.rooms.map((source, i) => (
                                                                        <tr key={`room-${source.id}-${i}`} className='hover:bg-gray-50'>
                                                                            <td className='border border-gray-300 px-3 py-2 font-medium'>{source.payload.roomType}</td>
                                                                            <td className='border border-gray-300 px-3 py-2 font-semibold text-green-600'>
                                                                                ${source.payload.pricePerNight}
                                                                            </td>
                                                                            <td className='border border-gray-300 px-3 py-2'>
                                                                                <div className='flex flex-wrap gap-1'>
                                                                                    {(source.payload.amenities || []).slice(0, 3).map((amenity, idx) => (
                                                                                        <span key={idx} className='bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs'>
                                                                                            {amenity}
                                                                                        </span>
                                                                                    ))}
                                                                                    {(source.payload.amenities || []).length > 3 && (
                                                                                        <span className='text-gray-500 text-xs'>+{(source.payload.amenities || []).length - 3} more</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className='border border-gray-300 px-3 py-2'>{source.title}</td>
                                                                            <td className='border border-gray-300 px-3 py-2 text-center'>
                                                                                <span className='bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs'>
                                                                                    {source.score}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ));
                            })()}

                            {/* No Results Message */}
                            {(!ragPreview.sources || ragPreview.sources.length === 0) && (
                                <div className='text-center py-8 text-gray-500'>
                                    <p>No matching hotels or rooms found for your query.</p>
                                </div>
                            )}
                        </div>

                        {/* Original Context (for debugging) */}
                        <div className='mt-4'>
                            <details className='text-xs'>
                                <summary className='font-medium cursor-pointer text-gray-600 hover:text-gray-800'>
                                    Raw Context (Debug)
                                </summary>
                                <pre className='whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200 mt-2 text-xs'>
                                    {ragPreview.context || '(empty)'}
                                </pre>
                            </details>
                        </div>
                    </div>
                )}
            </div>

            <div className='flex flex-col items-start gap-4'>
                <div className='flex gap-4'>
                    <img className='h-14 w-14 md:h-18 md:w-18 rounded-full' src={room.hotel.owner.image} alt='Host' />
                    <div>
                        <p className='text-lg md:text-xl'>Hosted by {room.hotel.name}</p>
                        <div className='flex items-center mt-1'>
                            <StarRating />
                            <p className='ml-2'>200+ reviews</p>
                        </div>
                    </div>
                </div>
                <button className='px-6 py-2.5 mt-4 rounded text-white bg-primary hover:bg-primary-dull transition-all cursor-pointer'>
                    Contact Now
                </button>
            </div>
        </div>
    )
}

export default RoomDetails
