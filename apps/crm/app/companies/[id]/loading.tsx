export default function CompanyDetailLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button skeleton */}
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-6" />

        {/* Company header skeleton */}
        <div className="flex items-start gap-6 mb-8">
          <div className="h-20 w-20 bg-gray-200 rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mt-2" />
            <div className="flex gap-2 mt-3">
              <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Description skeleton */}
        <div className="mb-8">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse mt-2" />
          <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mt-2" />
        </div>

        {/* Details grid skeleton */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mt-1" />
            </div>
          ))}
        </div>

        {/* Team section skeleton */}
        <div className="mb-8">
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
                <div>
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investment section skeleton */}
        <div>
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mt-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
