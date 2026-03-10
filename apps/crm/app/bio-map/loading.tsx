export default function BioMapLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-4 mb-6">
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Filter tags skeleton */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 w-20 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Search skeleton */}
        <div className="h-10 w-full max-w-md bg-gray-200 rounded animate-pulse mb-6" />

        {/* Cards grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse" />
                <div>
                  <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mt-1" />
                </div>
              </div>
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mt-2" />
              <div className="flex gap-2 mt-4">
                <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
