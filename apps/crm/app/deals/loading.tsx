export default function DealsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>

        {/* Cards skeleton */}
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2" />
                  <div className="h-4 w-full bg-gray-200 rounded animate-pulse mt-3" />
                </div>
                <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
