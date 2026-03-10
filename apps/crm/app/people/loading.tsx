export default function PeopleLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header skeleton */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Search and filter bar skeleton */}
        <div className="flex gap-4 mb-6">
          <div className="h-10 flex-1 max-w-md bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* People table skeleton */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Table header */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="flex gap-4">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Table rows */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="px-6 py-4 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-1" />
                </div>
                <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
