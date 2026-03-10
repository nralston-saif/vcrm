export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mt-2" />
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>

        {/* Two column layout skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="py-3 border-b border-gray-100 last:border-0">
                  <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="py-3 border-b border-gray-100 last:border-0">
                  <div className="h-5 w-full bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mt-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
