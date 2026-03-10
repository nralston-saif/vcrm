export default function PersonDetailLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button skeleton */}
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-6" />

        {/* Profile header skeleton */}
        <div className="flex items-start gap-6 mb-8">
          <div className="h-24 w-24 bg-gray-200 rounded-full animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2" />
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mt-2" />
            <div className="flex gap-2 mt-3">
              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-10 w-20 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Bio section skeleton */}
        <div className="mb-8">
          <div className="h-5 w-16 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse mt-2" />
          <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse mt-2" />
        </div>

        {/* Contact info skeleton */}
        <div className="mb-8">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mt-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Companies section skeleton */}
        <div className="mb-8">
          <div className="h-5 w-28 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
                <div>
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tags skeleton */}
        <div>
          <div className="h-5 w-16 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
