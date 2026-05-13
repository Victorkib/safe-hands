'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function ListingDetail() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [listing, setListing] = useState(null);
  const [relatedListings, setRelatedListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/listings/${id}`);
      const result = await response.json();

      if (result.success) {
        setListing(result.listing);
        if (result.listing.seller_id) {
          fetchRelatedListings(result.listing.seller_id, id);
        }
      } else {
        setError(result.error || 'Listing not found');
      }
    } catch (fetchError) {
      console.error('Error fetching listing:', fetchError);
      setError('Failed to load listing');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedListings = async (sellerId, currentListingId) => {
    try {
      const response = await fetch('/api/listings?limit=4');
      const result = await response.json();
      if (result.success) {
        const related = result.listings
          .filter((listingItem) => listingItem.seller_id === sellerId && listingItem.id !== currentListingId && listingItem.status === 'active')
          .slice(0, 4);
        setRelatedListings(related);
      }
    } catch (fetchError) {
      console.error('Error fetching related listings:', fetchError);
    }
  };

  const handleBuyNow = () => {
    const listingDescription = listing.description?.trim() || listing.title;
    const transactionData = {
      seller_email: listing.seller.email,
      amount: listing.price,
      description: listingDescription,
    };

    localStorage.setItem('prefillTransaction', JSON.stringify(transactionData));
    router.push('/dashboard/transactions/create');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading listing...</p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error || 'Listing not found'}</p>
          <Link href="/dashboard/marketplace" className="text-blue-600 hover:text-blue-700">
            Browse Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const images = listing.images || [];
  const hasImages = images.length > 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/marketplace" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
          ← Back to Marketplace
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {hasImages ? (
              <div>
                <img
                  src={images[currentImageIndex]}
                  alt={listing.title}
                  className="w-full h-96 object-cover"
                />
                {images.length > 1 && (
                  <div className="flex gap-2 p-4">
                    {images.map((img, index) => (
                      <img
                        key={index}
                        src={img}
                        alt={`Thumbnail ${index + 1}`}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-20 h-20 object-cover rounded-lg cursor-pointer border-2 ${
                          currentImageIndex === index ? 'border-blue-600' : 'border-transparent'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-96 bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400">No images available</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-2xl font-bold text-gray-900">{listing.title}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {listing.status}
              </span>
            </div>

            <p className="text-3xl font-bold text-blue-600 mb-4">
              KES {parseFloat(listing.price).toLocaleString()}
            </p>

            <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
              {listing.category && (
                <span className="bg-gray-100 px-3 py-1 rounded-full">
                  {listing.category.name}
                </span>
              )}
              {listing.condition && (
                <span className="bg-gray-100 px-3 py-1 rounded-full capitalize">
                  {listing.condition.replace('_', ' ')}
                </span>
              )}
            </div>

            <div className="border-t border-b py-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold">
                    {listing.seller?.full_name?.charAt(0) || 'S'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {listing.seller?.full_name || 'Seller'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Seller since {new Date(listing.seller?.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{listing.description}</p>
            </div>

            {listing.location && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">Location</h3>
                <p className="text-gray-600">{listing.location}</p>
              </div>
            )}

            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">Listing Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Posted</p>
                  <p className="text-gray-900">{new Date(listing.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Views</p>
                  <p className="text-gray-900">{listing.view_count || 0}</p>
                </div>
              </div>
            </div>

            {listing.status === 'active' && (
              <button
                onClick={handleBuyNow}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Buy Now - Create Transaction
              </button>
            )}

            {listing.status === 'sold' && (
              <div className="w-full bg-gray-300 text-gray-700 px-6 py-3 rounded-lg text-center font-medium">
                This item has been sold
              </div>
            )}
          </div>
        </div>
      </div>

      {relatedListings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">More from this seller</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {relatedListings.map((related) => (
              <Link
                key={related.id}
                href={`/dashboard/marketplace/${related.id}`}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition"
              >
                {related.images && related.images.length > 0 ? (
                  <img
                    src={related.images[0]}
                    alt={related.title}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate">{related.title}</h3>
                  <p className="text-lg font-bold text-blue-600 mt-2">
                    KES {parseFloat(related.price).toLocaleString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-medium text-yellow-900 mb-2">Safety Tips</h3>
        <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
          <li>Use Safe Hands Escrow for secure transactions</li>
          <li>Verify the item before confirming delivery</li>
          <li>Communicate through the platform</li>
          <li>Report suspicious activity to support</li>
        </ul>
      </div>
    </div>
  );
}
